'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, UserPlus, Users } from 'lucide-react';
import { FormEvent, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listAcademicYears, listClasses } from '@/lib/academic/api';
import {
  activeYear,
  createStudent,
  flattenSections,
  getApiErrorMessage,
  listStudents,
} from '@/lib/school-life/api';

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
];

export function StudentsClient() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [search, setSearch] = useState('');

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const selectedYear = activeYear(yearsQuery.data ?? []);
  const classesQuery = useQuery({
    queryKey: ['classes', selectedYear?.id],
    queryFn: () => listClasses(selectedYear?.id as string),
    enabled: Boolean(selectedYear?.id),
  });
  const sections = useMemo(() => flattenSections(classesQuery.data ?? []), [classesQuery.data]);
  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;
  const studentsQuery = useQuery({
    queryKey: ['students', selectedSectionId],
    queryFn: () => listStudents(selectedSectionId || undefined),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (studentsQuery.data ?? []).filter(
      (s) =>
        !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q),
    );
  }, [studentsQuery.data, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Students</h1>
            <p className="text-sm text-muted-foreground">
              Add students to a class section and create their login credentials.
            </p>
          </div>
        </div>

        {/* Section filter */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="section-filter" className="text-xs">Filter by section</Label>
            <select
              id="section-filter"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">All students</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.className} – {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Total Students</p>
          <p className="mt-1 text-3xl font-bold">{studentsQuery.data?.length ?? '—'}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Sections</p>
          <p className="mt-1 text-3xl font-bold">{sections.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Academic Year</p>
          <p className="mt-1 text-xl font-bold truncate">{selectedYear?.name ?? '—'}</p>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400'
            : 'border-border bg-muted/50 text-muted-foreground'
        }`}>
          {message.type === 'success' ? '✓' : 'ℹ'} {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <StudentForm
          selectedYearId={selectedYear?.id ?? ''}
          selectedSection={selectedSection}
          sections={sections}
          onSectionChange={setSelectedSectionId}
          onCreated={async (name) => {
            setMessage({ text: `${name} student account created.`, type: 'success' });
            await queryClient.invalidateQueries({ queryKey: ['students'] });
          }}
        />

        <Card className="border-0 shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Student List</CardTitle>
                <CardDescription>
                  {selectedSection
                    ? `${selectedSection.className} – Section ${selectedSection.name}`
                    : 'All students in this school'}
                </CardDescription>
              </div>
              <Badge variant="outline">{filtered.length} students</Badge>
            </div>

            {/* Search */}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or admission no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm shadow-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {studentsQuery.isLoading ? (
              <LoadingState label="students" />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={search ? 'No matching students' : 'No students yet'}
                desc={search ? 'Try a different search term.' : 'Add the first student using the form.'}
              />
            ) : (
              filtered.map((student, idx) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/30"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColors[idx % avatarColors.length]}`}
                  >
                    {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      #{student.admissionNo}
                      {student.rollNo ? ` · Roll ${student.rollNo}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {student.class?.name ?? 'No class'}
                    {student.section ? `–${student.section.name}` : ''}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentForm({
  selectedYearId,
  selectedSection,
  sections,
  onSectionChange,
  onCreated,
}: {
  selectedYearId: string;
  selectedSection: ReturnType<typeof flattenSections>[number] | null;
  sections: ReturnType<typeof flattenSections>;
  onSectionChange: (id: string) => void;
  onCreated: (name: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    admissionNo: '', rollNo: '', firstName: '', lastName: '', email: '',
    password: 'Student@123', dateOfBirth: '', gender: 'MALE',
    admissionDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createStudent,
    onSuccess: async (student) => {
      setError(null);
      setForm((c) => ({ ...c, admissionNo: '', rollNo: '', firstName: '', lastName: '', email: '', dateOfBirth: '' }));
      await onCreated(`${student.firstName} ${student.lastName}`);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create student')),
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSection || !selectedYearId) return;
    mutation.mutate({
      ...form,
      rollNo: form.rollNo || undefined,
      academicYearId: selectedYearId,
      classId: selectedSection.classId,
      sectionId: selectedSection.id,
    });
  };

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <UserPlus className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">New Student</CardTitle>
        </div>
        <CardDescription>Creates both student profile and login account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="student-section">Class section</Label>
            <select
              id="student-section"
              value={selectedSection?.id ?? ''}
              onChange={(e) => onSectionChange(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">Select section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.className} – {s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="admissionNo" label="Admission no." value={form.admissionNo} setForm={setForm} />
            <Field id="rollNo" label="Roll no." value={form.rollNo} setForm={setForm} required={false} />
            <Field id="firstName" label="First name" value={form.firstName} setForm={setForm} />
            <Field id="lastName" label="Last name" value={form.lastName} setForm={setForm} />
            <Field id="email" label="Email" type="email" value={form.email} setForm={setForm} />
            <Field id="password" label="Password" type="text" value={form.password} setForm={setForm} />
            <Field id="dateOfBirth" label="Date of birth" type="date" value={form.dateOfBirth} setForm={setForm} />
            <Field id="admissionDate" label="Admission date" type="date" value={form.admissionDate} setForm={setForm} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="student-gender">Gender</Label>
            <select
              id="student-gender"
              value={form.gender}
              onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={mutation.isPending || !selectedSection}
            className="w-full shadow-sm"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
            Create student
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field<T extends Record<string, string>>({
  id, label, value, setForm, type = 'text', required = true,
}: {
  id: keyof T & string;
  label: string;
  value: string;
  setForm: Dispatch<SetStateAction<T>>;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id} type={type} value={value} required={required}
        onChange={(e) => setForm((c) => ({ ...c, [id]: e.target.value }))}
        className="shadow-sm"
      />
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
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
