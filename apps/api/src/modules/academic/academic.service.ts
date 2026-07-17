import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { AssignSubjectDto, UpdateClassSubjectDto } from './dto/assign-subject.dto';

const academicYearSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AcademicYearSelect;

const sectionSelect = {
  id: true,
  name: true,
  maxStudents: true,
  classTeacherId: true,
  classTeacher: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SectionSelect;

const classSelect = {
  id: true,
  name: true,
  displayOrder: true,
  academicYearId: true,
  createdAt: true,
  updatedAt: true,
  sections: {
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: sectionSelect,
  },
} satisfies Prisma.ClassSelect;

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubjectSelect;

const classSubjectSelect = {
  id: true,
  classId: true,
  subjectId: true,
  isElective: true,
  subject: { select: { id: true, name: true, code: true, type: true } },
  teacher: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
  class: { select: { id: true, name: true } },
} satisfies Prisma.ClassSubjectSelect;

@Injectable()
export class AcademicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listAcademicYears(tenantId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      select: academicYearSelect,
    });
  }

  async createAcademicYear(tenantId: string, userId: string, dto: CreateAcademicYearDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Academic year dates are invalid');
    }

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    try {
      const created = await this.prisma.academicYear.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          startDate,
          endDate,
          isActive: false,
        },
        select: academicYearSelect,
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'academic-year.create',
        entity: 'AcademicYear',
        entityId: created.id,
        newValues: created,
      });

      return created;
    } catch (error) {
      this.handleUniqueConflict(error, 'Academic year already exists');
    }
  }

  async activateAcademicYear(tenantId: string, userId: string, id: string) {
    const existing = await this.findAcademicYearOrThrow(tenantId, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { tenantId, deletedAt: null, isActive: true },
        data: { isActive: false },
      });

      return tx.academicYear.update({
        where: { id },
        data: { isActive: true },
        select: academicYearSelect,
      });
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'academic-year.activate',
      entity: 'AcademicYear',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  async closeAcademicYear(tenantId: string, userId: string, id: string) {
    const existing = await this.findAcademicYearOrThrow(tenantId, id);

    const updated = await this.prisma.academicYear.update({
      where: { id },
      data: { isActive: false },
      select: academicYearSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'academic-year.close',
      entity: 'AcademicYear',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  async listClasses(tenantId: string, academicYearId?: string) {
    const resolvedAcademicYearId = academicYearId ?? (await this.getActiveAcademicYearId(tenantId));

    if (!resolvedAcademicYearId) {
      return [];
    }

    return this.prisma.class.findMany({
      where: {
        tenantId,
        academicYearId: resolvedAcademicYearId,
        deletedAt: null,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: classSelect,
    });
  }

  async createClass(tenantId: string, userId: string, dto: CreateClassDto) {
    await this.findAcademicYearOrThrow(tenantId, dto.academicYearId);

    try {
      const created = await this.prisma.class.create({
        data: {
          tenantId,
          academicYearId: dto.academicYearId,
          name: dto.name.trim(),
          displayOrder: dto.displayOrder ?? 0,
        },
        select: classSelect,
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'class.create',
        entity: 'Class',
        entityId: created.id,
        newValues: created,
      });

      return created;
    } catch (error) {
      this.handleUniqueConflict(error, 'Class already exists in this academic year');
    }
  }

  async deleteClass(tenantId: string, userId: string, id: string) {
    const existing = await this.findClassOrThrow(tenantId, id);

    const updated = await this.prisma.class.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: classSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'class.delete',
      entity: 'Class',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  async createSection(tenantId: string, userId: string, dto: CreateSectionDto) {
    await this.findClassOrThrow(tenantId, dto.classId);

    try {
      const created = await this.prisma.section.create({
        data: {
          tenantId,
          classId: dto.classId,
          name: dto.name.trim(),
          maxStudents: dto.maxStudents ?? 40,
        },
        select: sectionSelect,
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'section.create',
        entity: 'Section',
        entityId: created.id,
        newValues: created,
      });

      return created;
    } catch (error) {
      this.handleUniqueConflict(error, 'Section already exists in this class');
    }
  }

  async deleteSection(tenantId: string, userId: string, id: string) {
    const existing = await this.findSectionOrThrow(tenantId, id);

    const updated = await this.prisma.section.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: sectionSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'section.delete',
      entity: 'Section',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  // ─── Subjects ─────────────────────────────────────────────────────────────

  async listSubjects(tenantId: string) {
    return this.prisma.subject.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ name: 'asc' }],
      select: subjectSelect,
    });
  }

  async createSubject(tenantId: string, userId: string, dto: CreateSubjectDto) {
    try {
      const created = await this.prisma.subject.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          type: dto.type ?? 'CORE',
          description: dto.description?.trim(),
        },
        select: subjectSelect,
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'subject.create',
        entity: 'Subject',
        entityId: created.id,
        newValues: created,
      });

      return created;
    } catch (error) {
      this.handleUniqueConflict(error, 'Subject code already exists');
    }
  }

  async deleteSubject(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.subject.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: subjectSelect,
    });

    if (!existing) throw new NotFoundException('Subject not found');

    const updated = await this.prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: subjectSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'subject.delete',
      entity: 'Subject',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  // ─── Class Subjects ───────────────────────────────────────────────────────

  async listClassSubjects(tenantId: string, classId: string) {
    return this.prisma.classSubject.findMany({
      where: { tenantId, classId },
      select: classSubjectSelect,
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async assignSubjectToClass(tenantId: string, userId: string, dto: AssignSubjectDto) {
    // verify class and subject belong to tenant
    await this.findClassOrThrow(tenantId, dto.classId);
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, tenantId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    try {
      const created = await this.prisma.classSubject.create({
        data: {
          tenantId,
          classId: dto.classId,
          subjectId: dto.subjectId,
          teacherId: dto.teacherId ?? null,
          isElective: dto.isElective ?? false,
        },
        select: classSubjectSelect,
      });

      await this.auditLog.log({
        tenantId,
        userId,
        action: 'class-subject.assign',
        entity: 'ClassSubject',
        entityId: created.id,
        newValues: created,
      });

      return created;
    } catch (error) {
      this.handleUniqueConflict(error, 'Subject already assigned to this class');
    }
  }

  async updateClassSubject(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateClassSubjectDto,
  ) {
    const existing = await this.prisma.classSubject.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Class subject not found');

    return this.prisma.classSubject.update({
      where: { id },
      data: {
        teacherId: dto.teacherId ?? null,
        isElective: dto.isElective,
      },
      select: classSubjectSelect,
    });
  }

  async removeSubjectFromClass(tenantId: string, userId: string, id: string) {
    const existing = await this.prisma.classSubject.findFirst({
      where: { id, tenantId },
      select: classSubjectSelect,
    });
    if (!existing) throw new NotFoundException('Class subject not found');

    await this.prisma.classSubject.delete({ where: { id } });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'class-subject.remove',
      entity: 'ClassSubject',
      entityId: id,
      oldValues: existing,
    });

    return existing;
  }

  private async getActiveAcademicYearId(tenantId: string) {
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, deletedAt: null, isActive: true },
      select: { id: true },
    });

    return activeYear?.id ?? null;
  }

  private async findAcademicYearOrThrow(tenantId: string, id: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: academicYearSelect,
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return academicYear;
  }

  private async findClassOrThrow(tenantId: string, id: string) {
    const classRecord = await this.prisma.class.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: classSelect,
    });

    if (!classRecord) {
      throw new NotFoundException('Class not found');
    }

    return classRecord;
  }

  private async findSectionOrThrow(tenantId: string, id: string) {
    const section = await this.prisma.section.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: sectionSelect,
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    return section;
  }

  private handleUniqueConflict(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }

    throw error;
  }
}
