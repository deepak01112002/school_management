'use client';

import { api } from '@/lib/api';

interface ApiEnvelope<T> {
  data: T;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  name: string;
  maxStudents: number;
  classTeacherId: string | null;
  classTeacher?: {
    id: string;
    user: { firstName: string; lastName: string } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassRecord {
  id: string;
  name: string;
  displayOrder: number;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'CORE' | 'ELECTIVE';
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  isElective: boolean;
  subject: { id: string; name: string; code: string; type: string };
  teacher: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  class: { id: string; name: string };
}

export async function listAcademicYears() {
  const response = await api.get<ApiEnvelope<AcademicYear[]>>('/academic-years');
  return response.data.data;
}

export async function createAcademicYear(payload: {
  name: string;
  startDate: string;
  endDate: string;
}) {
  const response = await api.post<ApiEnvelope<AcademicYear>>('/academic-years', payload);
  return response.data.data;
}

export async function activateAcademicYear(id: string) {
  const response = await api.patch<ApiEnvelope<AcademicYear>>(`/academic-years/${id}/activate`);
  return response.data.data;
}

export async function closeAcademicYear(id: string) {
  const response = await api.patch<ApiEnvelope<AcademicYear>>(`/academic-years/${id}/close`);
  return response.data.data;
}

export async function listClasses(academicYearId: string) {
  const response = await api.get<ApiEnvelope<ClassRecord[]>>('/classes', {
    params: { academicYearId },
  });
  return response.data.data;
}

export async function createClass(payload: {
  name: string;
  academicYearId: string;
  displayOrder?: number;
}) {
  const response = await api.post<ApiEnvelope<ClassRecord>>('/classes', payload);
  return response.data.data;
}

export async function deleteClass(id: string) {
  const response = await api.delete<ApiEnvelope<ClassRecord>>(`/classes/${id}`);
  return response.data.data;
}

export async function createSection(payload: {
  name: string;
  classId: string;
  maxStudents?: number;
}) {
  const response = await api.post<ApiEnvelope<Section>>('/sections', payload);
  return response.data.data;
}

export async function deleteSection(id: string) {
  const response = await api.delete<ApiEnvelope<Section>>(`/sections/${id}`);
  return response.data.data;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? fallback
  );
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export async function listSubjects() {
  const response = await api.get<ApiEnvelope<Subject[]>>('/subjects');
  return response.data.data;
}

export async function createSubject(payload: {
  name: string;
  code: string;
  type?: 'CORE' | 'ELECTIVE';
  description?: string;
}) {
  const response = await api.post<ApiEnvelope<Subject>>('/subjects', payload);
  return response.data.data;
}

export async function deleteSubject(id: string) {
  const response = await api.delete<ApiEnvelope<Subject>>(`/subjects/${id}`);
  return response.data.data;
}

// ─── Class Subjects ────────────────────────────────────────────────────────────

export async function listClassSubjects(classId: string) {
  const response = await api.get<ApiEnvelope<ClassSubject[]>>('/class-subjects', {
    params: { classId },
  });
  return response.data.data;
}

export async function assignSubjectToClass(payload: {
  classId: string;
  subjectId: string;
  teacherId?: string;
  isElective?: boolean;
}) {
  const response = await api.post<ApiEnvelope<ClassSubject>>('/class-subjects', payload);
  return response.data.data;
}

export async function updateClassSubject(
  id: string,
  payload: { teacherId?: string | null; isElective?: boolean },
) {
  const response = await api.patch<ApiEnvelope<ClassSubject>>(`/class-subjects/${id}`, payload);
  return response.data.data;
}

export async function removeSubjectFromClass(id: string) {
  const response = await api.delete<ApiEnvelope<ClassSubject>>(`/class-subjects/${id}`);
  return response.data.data;
}
