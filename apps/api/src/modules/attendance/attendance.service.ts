import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { MarkSectionAttendanceDto } from './dto/mark-section-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getSectionAttendance(tenantId: string, sectionId: string, date: string) {
    const parsedDate = this.parseDate(date);

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const [students, attendance] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId, sectionId, deletedAt: null, status: 'ADMITTED' },
        orderBy: [{ rollNo: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          admissionNo: true,
          rollNo: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.attendance.findMany({
        where: { tenantId, sectionId, date: parsedDate, periodId: null },
        select: {
          id: true,
          studentId: true,
          status: true,
          remarks: true,
          markedBy: true,
          updatedAt: true,
        },
      }),
    ]);

    const attendanceByStudent = new Map(attendance.map((entry) => [entry.studentId, entry]));

    return {
      date: parsedDate,
      section,
      students: students.map((student) => ({
        ...student,
        attendance: attendanceByStudent.get(student.id) ?? null,
      })),
    };
  }

  async markSectionAttendance(
    tenantId: string,
    user: AuthUser,
    sectionId: string,
    dto: MarkSectionAttendanceDto,
  ) {
    const parsedDate = this.parseDate(dto.date);

    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      select: {
        id: true,
        classId: true,
        classTeacherId: true,
        class: { select: { id: true, name: true } },
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const permissions = user.role.permissions ?? [];
    const canManageAll = permissions.includes('academic:manage') || permissions.includes('*');
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId, userId: user.id, deletedAt: null },
      select: { id: true },
    });

    if (!canManageAll && section.classTeacherId !== staff?.id) {
      throw new ForbiddenException('Only the assigned class teacher can mark this section');
    }

    const studentIds = dto.entries.map((entry) => entry.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        id: { in: studentIds },
        sectionId,
        classId: section.classId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (students.length !== new Set(studentIds).size) {
      throw new BadRequestException('One or more students do not belong to this section');
    }

    const results = [];

    for (const entry of dto.entries) {
      const existing = await this.prisma.attendance.findFirst({
        where: {
          tenantId,
          studentId: entry.studentId,
          date: parsedDate,
          periodId: null,
        },
        select: { id: true },
      });

      if (existing) {
        results.push(
          await this.prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: entry.status,
              remarks: entry.remarks,
              markedBy: user.id,
            },
          }),
        );
      } else {
        results.push(
          await this.prisma.attendance.create({
            data: {
              tenantId,
              studentId: entry.studentId,
              classId: section.classId,
              sectionId,
              date: parsedDate,
              status: entry.status,
              remarks: entry.remarks,
              markedBy: user.id,
            },
          }),
        );
      }
    }

    await this.auditLog.log({
      tenantId,
      userId: user.id,
      action: 'attendance.section.mark',
      entity: 'Section',
      entityId: sectionId,
      newValues: { date: parsedDate, count: results.length },
    });

    return {
      date: parsedDate,
      sectionId,
      count: results.length,
      records: results,
    };
  }

  async getMyAttendance(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const records = await this.prisma.attendance.findMany({
      where: { tenantId, studentId: student.id },
      orderBy: { date: 'desc' },
      take: 90,
      select: {
        id: true,
        date: true,
        status: true,
        remarks: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    const totals = records.reduce(
      (acc, record) => {
        acc.total += 1;
        acc[record.status] += 1;
        return acc;
      },
      {
        total: 0,
        PRESENT: 0,
        ABSENT: 0,
        LATE: 0,
        EXCUSED: 0,
      } satisfies Record<AttendanceStatus | 'total', number>,
    );

    const countedPresent = totals.PRESENT + totals.LATE + totals.EXCUSED;
    const percentage = totals.total > 0 ? Math.round((countedPresent / totals.total) * 100) : null;

    return {
      student,
      summary: { ...totals, percentage },
      records,
    };
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
