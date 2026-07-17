import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listStudents(tenantId: string, sectionId?: string) {
    return this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(sectionId && { sectionId }),
      },
      orderBy: [{ rollNo: 'asc' }, { firstName: 'asc' }],
      select: studentSelect,
    });
  }

  async createStudent(tenantId: string, userId: string, dto: CreateStudentDto) {
    const [role, classRecord, section] = await Promise.all([
      this.prisma.role.findFirst({
        where: { tenantId, name: 'Student' },
        select: { id: true },
      }),
      this.prisma.class.findFirst({
        where: {
          id: dto.classId,
          tenantId,
          academicYearId: dto.academicYearId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      this.prisma.section.findFirst({
        where: { id: dto.sectionId, tenantId, classId: dto.classId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    if (!role) {
      throw new NotFoundException('Student role not found for this school');
    }

    if (!classRecord || !section) {
      throw new BadRequestException('Class and section do not match this academic year');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const student = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId,
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            roleId: role.id,
            emailVerifiedAt: new Date(),
            passwordChangedAt: new Date(),
          },
          select: { id: true },
        });

        return tx.student.create({
          data: {
            tenantId,
            userId: user.id,
            admissionNo: dto.admissionNo.trim(),
            rollNo: dto.rollNo?.trim(),
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            dateOfBirth: new Date(dto.dateOfBirth),
            gender: dto.gender,
            admissionDate: new Date(dto.admissionDate),
            classId: dto.classId,
            sectionId: dto.sectionId,
            academicYearId: dto.academicYearId,
          },
          select: studentSelect,
        });
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'student.create',
        entity: 'Student',
        entityId: student.id,
        newValues: student,
      });

      return student;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Student email or admission number already exists');
      }
      throw error;
    }
  }

  async getMyProfile(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: studentSelect,
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }
}

const studentSelect = {
  id: true,
  userId: true,
  admissionNo: true,
  rollNo: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  admissionDate: true,
  status: true,
  classId: true,
  sectionId: true,
  academicYearId: true,
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  academicYear: { select: { id: true, name: true } },
} satisfies Prisma.StudentSelect;
