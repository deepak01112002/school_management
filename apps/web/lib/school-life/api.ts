'use client';

import { api } from '@/lib/api';
import { AcademicYear, ClassRecord } from '@/lib/academic/api';

interface ApiEnvelope<T> {
  data: T;
}

export interface Teacher {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  joiningDate: string;
  employmentType: string;
  isActive: boolean;
  userId: string | null;
}

export interface Student {
  id: string;
  userId: string | null;
  admissionNo: string;
  rollNo: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  admissionDate: string;
  status: string;
  classId: string | null;
  sectionId: string | null;
  academicYearId: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
}

export interface TeacherSection {
  id: string;
  name: string;
  maxStudents: number;
  class: { id: string; name: string; academicYearId: string };
  _count: { students: number };
}

export interface SectionAttendanceRoster {
  date: string;
  section: { id: string; name: string; class: { id: string; name: string } };
  students: Array<{
    id: string;
    admissionNo: string;
    rollNo: string | null;
    firstName: string;
    lastName: string;
    attendance: {
      id: string;
      studentId: string;
      status: AttendanceStatus;
      remarks: string | null;
      updatedAt: string;
    } | null;
  }>;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export async function listTeachers() {
  const response = await api.get<ApiEnvelope<Teacher[]>>('/teachers');
  return response.data.data;
}

export async function createTeacher(payload: {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  joiningDate: string;
  gender?: string;
}) {
  const response = await api.post<ApiEnvelope<Teacher>>('/teachers', payload);
  return response.data.data;
}

export async function assignClassTeacher(sectionId: string, staffId: string) {
  const response = await api.patch<ApiEnvelope<unknown>>(`/sections/${sectionId}/class-teacher`, {
    staffId,
  });
  return response.data.data;
}

export async function listStudents(sectionId?: string) {
  const response = await api.get<ApiEnvelope<Student[]>>('/students', {
    params: sectionId ? { sectionId } : undefined,
  });
  return response.data.data;
}

export async function createStudent(payload: {
  admissionNo: string;
  rollNo?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: string;
  admissionDate: string;
  classId: string;
  sectionId: string;
  academicYearId: string;
}) {
  const response = await api.post<ApiEnvelope<Student>>('/students', payload);
  return response.data.data;
}

export async function listMyTeacherSections() {
  const response = await api.get<ApiEnvelope<TeacherSection[]>>('/teachers/me/sections');
  return response.data.data;
}

export async function getSectionAttendance(sectionId: string, date: string) {
  const response = await api.get<ApiEnvelope<SectionAttendanceRoster>>(
    `/attendance/sections/${sectionId}`,
    { params: { date } },
  );
  return response.data.data;
}

export async function markSectionAttendance(payload: {
  sectionId: string;
  date: string;
  entries: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>;
}) {
  const response = await api.post<ApiEnvelope<unknown>>(
    `/attendance/sections/${payload.sectionId}`,
    { date: payload.date, entries: payload.entries },
  );
  return response.data.data;
}

export async function getMyAttendance() {
  const response = await api.get<
    ApiEnvelope<{
      student: { id: string; firstName: string; lastName: string };
      summary: Record<AttendanceStatus | 'total', number> & { percentage: number | null };
      records: Array<{
        id: string;
        date: string;
        status: AttendanceStatus;
        remarks: string | null;
        class: { id: string; name: string };
        section: { id: string; name: string };
      }>;
    }>
  >('/attendance/me');
  return response.data.data;
}

export interface StudentLeaveApplication {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  appliedAt: string;
  approvedAt: string | null;
  remarks: string | null;
  // populated on the teacher review list
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    class: { id: string; name: string } | null;
    section: { id: string; name: string } | null;
  };
  approver?: { id: string; firstName: string; lastName: string } | null;
}

export async function listMyStudentLeaves() {
  const response = await api.get<ApiEnvelope<StudentLeaveApplication[]>>('/student-leaves/me');
  return response.data.data;
}

export async function applyStudentLeave(payload: {
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const response = await api.post<ApiEnvelope<StudentLeaveApplication>>(
    '/student-leaves/me',
    payload,
  );
  return response.data.data;
}

// ── Teacher / Admin: review all student leave applications ──────────────────

export async function listAllStudentLeaves() {
  const response = await api.get<ApiEnvelope<StudentLeaveApplication[]>>('/student-leaves');
  return response.data.data;
}

export async function approveStudentLeave(id: string, remarks?: string) {
  const response = await api.patch<ApiEnvelope<StudentLeaveApplication>>(
    `/student-leaves/${id}/approve`,
    { remarks },
  );
  return response.data.data;
}

export async function rejectStudentLeave(id: string, remarks?: string) {
  const response = await api.patch<ApiEnvelope<StudentLeaveApplication>>(
    `/student-leaves/${id}/reject`,
    { remarks },
  );
  return response.data.data;
}

export function flattenSections(classes: ClassRecord[]) {
  return classes.flatMap((classRecord) =>
    classRecord.sections.map((section) => ({
      ...section,
      classId: classRecord.id,
      className: classRecord.name,
      academicYearId: classRecord.academicYearId,
    })),
  );
}

export function activeYear(years: AcademicYear[]) {
  return years.find((year) => year.isActive) ?? years[0] ?? null;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? fallback
  );
}
