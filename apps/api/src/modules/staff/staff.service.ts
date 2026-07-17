import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listTeachers(tenantId: string) {
    return this.prisma.staff.findMany({
      where: {
        tenantId,
        deletedAt: null,
        user: {
          role: {
            name: { in: ['Teacher', 'Class Teacher'] },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: teacherSelect,
    });
  }

  async createTeacher(tenantId: string, userId: string, dto: CreateTeacherDto) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: 'Teacher' },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundException('Teacher role not found for this school');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const staff = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone,
            roleId: role.id,
            emailVerifiedAt: new Date(),
            passwordChangedAt: new Date(),
          },
          select: { id: true },
        });

        return tx.staff.create({
          data: {
            tenantId,
            userId: user.id,
            employeeCode: dto.employeeCode.trim(),
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone,
            gender: dto.gender,
            joiningDate: new Date(dto.joiningDate),
            employmentType: dto.employmentType ?? 'FULL_TIME',
          },
          select: teacherSelect,
        });
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'staff.teacher.create',
        entity: 'Staff',
        entityId: staff.id,
        newValues: staff,
      });

      return staff;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Teacher email or employee code already exists');
      }
      throw error;
    }
  }

  async assignClassTeacher(tenantId: string, userId: string, sectionId: string, staffId: string) {
    const [section, staff] = await Promise.all([
      this.prisma.section.findFirst({
        where: { id: sectionId, tenantId, deletedAt: null },
        include: { class: { select: { id: true, name: true } } },
      }),
      this.prisma.staff.findFirst({
        where: { id: staffId, tenantId, deletedAt: null, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (!staff) {
      throw new NotFoundException('Teacher not found');
    }

    const updated = await this.prisma.section.update({
      where: { id: sectionId },
      data: { classTeacherId: staffId },
      select: {
        id: true,
        name: true,
        maxStudents: true,
        classTeacherId: true,
        classTeacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        class: {
          select: { id: true, name: true, academicYearId: true },
        },
      },
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'section.class-teacher.assign',
      entity: 'Section',
      entityId: sectionId,
      oldValues: { classTeacherId: section.classTeacherId },
      newValues: updated,
    });

    return updated;
  }

  async getMySections(tenantId: string, userId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!staff) {
      return [];
    }

    return this.prisma.section.findMany({
      where: { tenantId, classTeacherId: staff.id, deletedAt: null },
      orderBy: [{ class: { displayOrder: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        maxStudents: true,
        class: {
          select: {
            id: true,
            name: true,
            academicYearId: true,
          },
        },
        _count: {
          select: { students: true },
        },
      },
    });
  }
}

const teacherSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  joiningDate: true,
  employmentType: true,
  isActive: true,
  userId: true,
} satisfies Prisma.StaffSelect;
