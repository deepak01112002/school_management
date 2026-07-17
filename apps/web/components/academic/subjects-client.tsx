'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Loader2, Plus, Trash2, UserCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ClassSubject,
  Subject,
  assignSubjectToClass,
  createSubject,
  deleteSubject,
  getApiErrorMessage,
  listClassSubjects,
  listClasses,
  listSubjects,
  listAcademicYears,
  removeSubjectFromClass,
  updateClassSubject,
} from '@/lib/academic/api';
import { activeYear, listTeachers } from '@/lib/school-life/api';

export function SubjectsClient() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['subjects'] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
        <p className="text-muted-foreground">
          Define subjects, then assign them to classes with an optional teacher.
        </p>
      </div>

      {message ? (
        <div className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <SubjectForm
          onCreated={async (s) => {
            setMessage(`Subject "${s.name}" created.`);
            await refresh();
          }}
        />
        <SubjectList
          onDeleted={async (s) => {
            setMessage(`Subject "${s.name}" deleted.`);
            await refresh();
          }}
        />
      </div>

      <ClassSubjectAssignment
        onMessage={setMessage}
      />
    </div>
  );
}

// ─── Create subject form ──────────────────────────────────────────────────────

function SubjectForm({ onCreated }: { onCreated: (s: Subject) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', code: '', type: 'CORE' as 'CORE' | 'ELECTIVE', description: '' });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createSubject,
    onSuccess: async (s) => {
      setError(null);
      setForm({ name: '', code: '', type: 'CORE', description: '' });
      await onCreated(s);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create subject')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Subject</CardTitle>
        <CardDescription>Add a subject to this school's catalog.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Name</Label>
            <Input
              id="sub-name"
              placeholder="Mathematics"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-code">Code</Label>
              <Input
                id="sub-code"
                placeholder="MATH-01"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-type">Type</Label>
              <select
                id="sub-type"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'CORE' | 'ELECTIVE' }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="CORE">Core</option>
                <option value="ELECTIVE">Elective</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">Description (optional)</Label>
            <Input
              id="sub-desc"
              placeholder="Brief description…"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
            Create subject
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Subject list ─────────────────────────────────────────────────────────────

function SubjectList({ onDeleted }: { onDeleted: (s: Subject) => Promise<void> }) {
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects });

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: async (s) => onDeleted(s),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Subject Catalog</CardTitle>
            <CardDescription>All subjects available in this school.</CardDescription>
          </div>
          <Badge variant="outline">{subjectsQuery.data?.length ?? 0} subjects</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {subjectsQuery.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </div>
        ) : (subjectsQuery.data ?? []).length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            No subjects yet. Create the first one.
          </div>
        ) : (
          subjectsQuery.data?.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <BookMarked className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.code}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={s.type === 'CORE' ? 'default' : 'secondary'}>
                  {s.type}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(s.id)}
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Class → Subject assignment ───────────────────────────────────────────────

function ClassSubjectAssignment({ onMessage }: { onMessage: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: listAcademicYears });
  const year = useMemo(() => activeYear(yearsQuery.data ?? []), [yearsQuery.data]);

  const classesQuery = useQuery({
    queryKey: ['classes', year?.id],
    queryFn: () => listClasses(year!.id),
    enabled: Boolean(year?.id),
  });

  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: listSubjects });
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: listTeachers });

  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', selectedClassId],
    queryFn: () => listClassSubjects(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const [form, setForm] = useState({ subjectId: '', teacherId: '', isElective: false });
  const [error, setError] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: () =>
      assignSubjectToClass({
        classId: selectedClassId,
        subjectId: form.subjectId,
        teacherId: form.teacherId || undefined,
        isElective: form.isElective,
      }),
    onSuccess: async (cs) => {
      setError(null);
      setForm({ subjectId: '', teacherId: '', isElective: false });
      onMessage(`"${cs.subject.name}" assigned to ${cs.class.name}.`);
      await queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClassId] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not assign subject')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, teacherId }: { id: string; teacherId: string | null }) =>
      updateClassSubject(id, { teacherId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClassId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeSubjectFromClass,
    onSuccess: async (cs) => {
      onMessage(`"${cs.subject.name}" removed from class.`);
      await queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClassId] });
    },
  });

  const alreadyAssignedIds = new Set((classSubjectsQuery.data ?? []).map((cs) => cs.subjectId));
  const availableSubjects = (subjectsQuery.data ?? []).filter((s) => !alreadyAssignedIds.has(s.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Class → Subject Assignment</CardTitle>
        <CardDescription>
          Pick a class, add subjects from the catalog, and optionally assign a teacher to each.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Class selector */}
        <div className="space-y-1.5">
          <Label htmlFor="cs-class">Select class</Label>
          <select
            id="cs-class"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose a class…</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedClassId && (
          <>
            {/* Assign form */}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1.5">
                <Label htmlFor="cs-subject">Subject</Label>
                <select
                  id="cs-subject"
                  value={form.subjectId}
                  onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select subject…</option>
                  {availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cs-teacher">Teacher (optional)</Label>
                <select
                  id="cs-teacher"
                  value={form.teacherId}
                  onChange={(e) => setForm((p) => ({ ...p, teacherId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {(teachersQuery.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={assignMutation.isPending || !form.subjectId}
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck />
                  )}
                  Assign
                </Button>
              </div>
            </form>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {/* Assigned subjects list */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Assigned subjects ({classSubjectsQuery.data?.length ?? 0})
              </p>
              {classSubjectsQuery.isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                </div>
              ) : (classSubjectsQuery.data ?? []).length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No subjects assigned to this class yet.
                </div>
              ) : (
                classSubjectsQuery.data?.map((cs) => (
                  <ClassSubjectRow
                    key={cs.id}
                    cs={cs}
                    teachers={teachersQuery.data ?? []}
                    onTeacherChange={(teacherId) =>
                      updateMutation.mutate({ id: cs.id, teacherId })
                    }
                    onRemove={() => removeMutation.mutate(cs.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClassSubjectRow({
  cs,
  teachers,
  onTeacherChange,
  onRemove,
}: {
  cs: ClassSubject;
  teachers: { id: string; firstName: string; lastName: string }[];
  onTeacherChange: (id: string | null) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate font-medium">{cs.subject.name}</p>
        <p className="text-xs text-muted-foreground">
          {cs.subject.code}
          {cs.isElective ? ' · Elective' : ''}
        </p>
      </div>
      <div>
        <select
          value={cs.teacher?.id ?? ''}
          onChange={(e) => onTeacherChange(e.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          aria-label={`Teacher for ${cs.subject.name}`}
        >
          <option value="">Unassigned</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${cs.subject.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
