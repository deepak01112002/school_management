import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateStudentLeaveDto } from './dto/create-student-leave.dto';
import { ReviewStudentLeaveDto } from './dto/review-student-leave.dto';

@Injectable()
export class StudentLeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listMine(tenantId: string, userId: string) {
    const student = await this.findStudentByUser(tenantId, userId);

    return this.prisma.studentLeaveApplication.findMany({
      where: { tenantId, studentId: student.id },
      orderBy: { appliedAt: 'desc' },
      select: leaveSelect,
    });
  }

  async createMine(tenantId: string, userId: string, dto: CreateStudentLeaveDto) {
    const student = await this.findStudentByUser(tenantId, userId);
    const startDate = this.parseDate(dto.startDate);
    const endDate = this.parseDate(dto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

    const leave = await this.prisma.studentLeaveApplication.create({
      data: {
        tenantId,
        studentId: student.id,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason.trim(),
      },
      select: leaveSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId,
      action: 'student-leave.apply',
      entity: 'StudentLeaveApplication',
      entityId: leave.id,
      newValues: leave,
    });

    return leave;
  }

  async listForReview(tenantId: string) {
    return this.prisma.studentLeaveApplication.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { appliedAt: 'desc' }],
      select: leaveSelect,
    });
  }

  async review(
    tenantId: string,
    user: AuthUser,
    id: string,
    status: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>,
    dto: ReviewStudentLeaveDto,
  ) {
    const existing = await this.prisma.studentLeaveApplication.findFirst({
      where: { id, tenantId },
      select: leaveSelect,
    });

    if (!existing) {
      throw new NotFoundException('Student leave application not found');
    }

    const updated = await this.prisma.studentLeaveApplication.update({
      where: { id },
      data: {
        status,
        approvedBy: user.id,
        approvedAt: new Date(),
        remarks: dto.remarks,
      },
      select: leaveSelect,
    });

    await this.auditLog.log({
      tenantId,
      userId: user.id,
      action: `student-leave.${status.toLowerCase()}`,
      entity: 'StudentLeaveApplication',
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    return updated;
  }

  private async findStudentByUser(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  private parseDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
}

const leaveSelect = {
  id: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  status: true,
  appliedAt: true,
  approvedAt: true,
  remarks: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNo: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
  approver: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.StudentLeaveApplicationSelect;
