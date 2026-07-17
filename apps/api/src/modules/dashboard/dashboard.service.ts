import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin / Principal / Owner ─────────────────────────────────────────────
  async getAdminStats(tenantId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [
      totalStudents,
      totalStaff,
      todayPresent,
      todayAbsent,
      pendingLeaves,
      activeClasses,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, deletedAt: null, status: 'ADMITTED' } }),
      this.prisma.staff.count({ where: { tenantId, deletedAt: null, isActive: true } }),
      this.prisma.attendance.count({
        where: { tenantId, date: today, status: 'PRESENT' },
      }),
      this.prisma.attendance.count({
        where: { tenantId, date: today, status: 'ABSENT' },
      }),
      this.prisma.studentLeaveApplication.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.class.count({ where: { tenantId, deletedAt: null } }),
    ]);

    const attendanceTotal = todayPresent + todayAbsent;
    const attendancePct =
      attendanceTotal > 0 ? Math.round((todayPresent / attendanceTotal) * 100) : null;

    return {
      totalStudents,
      totalStaff,
      todayPresent,
      todayAbsent,
      attendancePct,
      pendingLeaves,
      activeClasses,
    };
  }

  // ── Teacher ───────────────────────────────────────────────────────────────
  async getTeacherStats(tenantId: string, userId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!staff) {
      return { mySections: 0, myStudents: 0, pendingLeaves: 0, todayMarked: false };
    }

    const [sections, pendingLeaves] = await Promise.all([
      this.prisma.section.findMany({
        where: { tenantId, classTeacherId: staff.id, deletedAt: null },
        select: { id: true, _count: { select: { students: true } } },
      }),
      this.prisma.studentLeaveApplication.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    const myStudents = sections.reduce((sum, s) => sum + s._count.students, 0);

    // Check if attendance already marked today for any of their sections
    const sectionIds = sections.map((s) => s.id);
    let todayMarked = false;
    if (sectionIds.length > 0) {
      const markedCount = await this.prisma.attendance.count({
        where: { tenantId, sectionId: { in: sectionIds }, date: today },
      });
      todayMarked = markedCount > 0;
    }

    return {
      mySections: sections.length,
      myStudents,
      pendingLeaves,
      todayMarked,
    };
  }

  // ── Student ───────────────────────────────────────────────────────────────
  async getStudentStats(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });

    if (!student) return null;

    const [totalDays, presentDays, pendingLeaves, approvedLeaves] = await Promise.all([
      this.prisma.attendance.count({ where: { tenantId, studentId: student.id } }),
      this.prisma.attendance.count({
        where: { tenantId, studentId: student.id, status: 'PRESENT' },
      }),
      this.prisma.studentLeaveApplication.count({
        where: { tenantId, studentId: student.id, status: 'PENDING' },
      }),
      this.prisma.studentLeaveApplication.count({
        where: { tenantId, studentId: student.id, status: 'APPROVED' },
      }),
    ]);

    const attendancePct =
      totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    return {
      student: {
        name: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        class: student.class?.name ?? null,
        section: student.section?.name ?? null,
      },
      totalDays,
      presentDays,
      attendancePct,
      pendingLeaves,
      approvedLeaves,
    };
  }

  // ── Accountant ────────────────────────────────────────────────────────────
  async getAccountantStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalPayments, monthPayments, pendingPayments] = await Promise.all([
      this.prisma.feePayment.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.feePayment.aggregate({
        where: { tenantId, status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.feePayment.count({ where: { tenantId, status: 'PENDING' } }),
    ]);

    return {
      totalCollected: Number(totalPayments._sum.netAmount ?? 0),
      monthCollected: Number(monthPayments._sum.netAmount ?? 0),
      monthTransactions: monthPayments._count,
      pendingPayments,
    };
  }
}
