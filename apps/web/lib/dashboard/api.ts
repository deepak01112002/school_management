'use client';

import { api } from '@/lib/api';

interface ApiEnvelope<T> {
  data: T;
}

export interface AdminStats {
  totalStudents: number;
  totalStaff: number;
  todayPresent: number;
  todayAbsent: number;
  attendancePct: number | null;
  pendingLeaves: number;
  activeClasses: number;
}

export interface TeacherStats {
  mySections: number;
  myStudents: number;
  pendingLeaves: number;
  todayMarked: boolean;
}

export interface StudentStats {
  student: {
    name: string;
    admissionNo: string;
    class: string | null;
    section: string | null;
  };
  totalDays: number;
  presentDays: number;
  attendancePct: number | null;
  pendingLeaves: number;
  approvedLeaves: number;
}

export interface AccountantStats {
  totalCollected: number;
  monthCollected: number;
  monthTransactions: number;
  pendingPayments: number;
}

export type DashboardStats = AdminStats | TeacherStats | StudentStats | AccountantStats;

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<ApiEnvelope<DashboardStats>>('/dashboard/stats');
  return res.data.data;
}
