'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Loader2, Plus, UserCheck, Users } from 'lucide-react';
import { FormEvent, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listAcademicYears, listClasses } from '@/lib/academic/api';
import {
  activeYear,
  assignClassTeacher,
  createTeacher,
  flattenSections,
  getApiErrorMessage,
  listTeachers,
} from '@/lib/school-life/api';

// Color palette for teacher avatars
const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
];

export function StaffClient() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const selectedYear = activeYear(yearsQuery.data ?? []);
  const classesQuery = useQuery({
    queryKey: ['classes', selectedYear?.id],
    queryFn: () => listClasses(selectedYear?.id as string),
    enabled: Boolean(selectedYear?.id),
  });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: listTeachers });
  const sections = useMemo(() => flattenSections(classesQuery.data ?? []), [classesQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['teachers'] }),
      queryClient.invalidateQueries({ queryKey: ['classes', selectedYear?.id] }),
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/30">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Create teacher accounts and assign class teachers to sections.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Total Teachers</p>
          <p className="mt-1 text-3xl font-bold">{teachersQuery.data?.length ?? '—'}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Class Sections</p>
          <p className="mt-1 text-3xl font-bold">{sections.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Assigned Sections</p>
          <p className="mt-1 text-3xl font-bold">
            {sections.filter((s) => s.classTeacherId).length}
          </p>
        </div>
      </div>

      {message ? (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400'
            : 'border-border bg-muted/50 text-muted-foreground'
        }`}>
          {message.type === 'success' ? '✓' : 'ℹ'} {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <TeacherForm
          onCreated={async (name) => {
            setMessage({ text: `${name} teacher account created.`, type: 'success' });
            await refresh();
          }}
        />

        <div className="space-y-4">
          {/* Assignment form */}
          <Card className="border-0 shadow-sm ring-1 ring-border/50">
            <CardHeader>
              <CardTitle className="text-base">Class Teacher Assignment</CardTitle>
              <CardDescription>Assign a class teacher to a section.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ClassTeacherForm
                sections={sections}
                teachers={teachersQuery.data ?? []}
                disabled={!selectedYear}
                onAssigned={async () => {
                  setMessage({ text: 'Class teacher assigned successfully.', type: 'success' });
                  await refresh();
                }}
              />

              {/* Class/section list */}
              <div className="space-y-3">
                {(classesQuery.data ?? []).map((classRecord) => (
                  <div key={classRecord.id} className="rounded-xl border bg-card">
                    <div className="flex items-center justify-between px-4 py-3">
                      <p className="font-semibold">{classRecord.name}</p>
                      <Badge variant="outline">{classRecord.sections.length} sections</Badge>
                    </div>
                    <div className="grid gap-2 border-t px-4 pb-4 pt-3 md:grid-cols-2">
                      {classRecord.sections.map((section) => {
                        const hasTeacher = Boolean(section.classTeacher?.user ?? section.classTeacherId);
                        const teacherName = section.classTeacher?.user
                          ? `${section.classTeacher.user.firstName} ${section.classTeacher.user.lastName}`
                          : null;

                        return (
                          <div key={section.id}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                              hasTeacher
                                ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10'
                                : 'border-border bg-background'
                            }`}>
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              hasTeacher ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {section.name}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {teacherName ?? (hasTeacher ? 'Assigned' : 'No teacher')}
                              </p>
                              <p className="text-xs text-muted-foreground">Max {section.maxStudents}</p>
                            </div>
                            {hasTeacher && (
                              <div className="ml-auto shrink-0 h-2 w-2 rounded-full bg-green-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Teacher list */}
          <Card className="border-0 shadow-sm ring-1 ring-border/50">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Teachers</CardTitle>
                <Badge variant="outline">{teachersQuery.data?.length ?? 0}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {teachersQuery.isLoading ? (
                <LoadingState label="teachers" />
              ) : (teachersQuery.data ?? []).length === 0 ? (
                <EmptyState icon={Users} title="No teachers yet" desc="Create the first teacher above." />
              ) : (
                teachersQuery.data?.map((teacher, idx) => (
                  <div key={teacher.id}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColors[idx % avatarColors.length]}`}>
                      {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{teacher.firstName} {teacher.lastName}</p>
                      <p className="text-xs text-muted-foreground">{teacher.employeeCode} · {teacher.employmentType}</p>
                    </div>
                    <Badge variant={teacher.isActive ? 'success' : 'secondary'} className="shrink-0">
                      {teacher.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeacherForm({ onCreated }: { onCreated: (name: string) => Promise<void> }) {
  const [form, setForm] = useState({
    employeeCode: '', firstName: '', lastName: '', email: '',
    password: 'Teacher@123', phone: '', joiningDate: new Date().toISOString().slice(0, 10), gender: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: async (teacher) => {
      setError(null);
      setForm((c) => ({ ...c, employeeCode: '', firstName: '', lastName: '', email: '', phone: '', gender: '' }));
      await onCreated(`${teacher.firstName} ${teacher.lastName}`);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create teacher')),
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    mutation.mutate({ ...form, gender: form.gender || undefined, phone: form.phone || undefined });
  };

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <CardTitle className="text-base">New Teacher</CardTitle>
        <CardDescription>Creates both staff profile and login account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="employeeCode" label="Employee code" value={form.employeeCode} setForm={setForm} />
            <Field id="joiningDate" label="Joining date" type="date" value={form.joiningDate} setForm={setForm} />
            <Field id="firstName" label="First name" value={form.firstName} setForm={setForm} />
            <Field id="lastName" label="Last name" value={form.lastName} setForm={setForm} />
            <Field id="email" label="Email" type="email" value={form.email} setForm={setForm} />
            <Field id="phone" label="Phone" value={form.phone} setForm={setForm} required={false} />
            <Field id="password" label="Password" type="text" value={form.password} setForm={setForm} />
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select id="gender" value={form.gender}
                onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={mutation.isPending} className="w-full shadow-sm">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
            Create teacher
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ClassTeacherForm({ sections, teachers, disabled, onAssigned }:
  { sections: ReturnType<typeof flattenSections>; teachers: Awaited<ReturnType<typeof listTeachers>>; disabled: boolean; onAssigned: () => Promise<void>; }) {
  const [sectionId, setSectionId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => assignClassTeacher(sectionId, staffId),
    onSuccess: async () => { setError(null); await onAssigned(); },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not assign')),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
      className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="section">Section</Label>
        <select id="section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={disabled} required
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
          <option value="">Select section</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.className} – {s.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="teacher">Teacher</Label>
        <select id="teacher" value={staffId} onChange={(e) => setStaffId(e.target.value)} required
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm">
          <option value="">Select teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={mutation.isPending || !sectionId || !staffId} className="shadow-sm">
          <UserCheck /> Assign
        </Button>
      </div>
      {error && <p className="text-sm text-destructive lg:col-span-3">{error}</p>}
    </form>
  );
}

function Field<T extends Record<string, string>>({ id, label, value, setForm, type = 'text', required = true }:
  { id: keyof T & string; label: string; value: string; setForm: Dispatch<SetStateAction<T>>; type?: string; required?: boolean; }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} required={required}
        onChange={(e) => setForm((c) => ({ ...c, [id]: e.target.value }))} className="shadow-sm" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading {label}…
    </div>
  );
}
