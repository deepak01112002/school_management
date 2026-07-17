'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarCheck,
  ChevronDown,
  Loader2,
  Plus,
  School,
  Trash2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AcademicYear,
  ClassRecord,
  activateAcademicYear,
  closeAcademicYear,
  createAcademicYear,
  createClass,
  createSection,
  deleteClass,
  deleteSection,
  getApiErrorMessage,
  listAcademicYears,
  listClasses,
} from '@/lib/academic/api';
import { cn } from '@/lib/utils';

const yearQueryKey = ['academic-years'];
const classesQueryKey = (id: string | null) => ['classes', id];

export function AcademicSetupClient() {
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const yearsQuery = useQuery({ queryKey: yearQueryKey, queryFn: listAcademicYears });
  const years = yearsQuery.data ?? [];
  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedYearId) ?? null,
    [selectedYearId, years],
  );

  useEffect(() => {
    if (selectedYearId || years.length === 0) return;
    setSelectedYearId(years.find((y) => y.isActive)?.id ?? years[0]?.id ?? null);
  }, [selectedYearId, years]);

  const classesQuery = useQuery({
    queryKey: classesQueryKey(selectedYearId),
    queryFn: () => listClasses(selectedYearId as string),
    enabled: Boolean(selectedYearId),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: yearQueryKey });
    if (selectedYearId) await queryClient.invalidateQueries({ queryKey: classesQueryKey(selectedYearId) });
  };

  const totalSections = (classesQuery.data ?? []).reduce((s, c) => s + c.sections.length, 0);
  const assignedSections = (classesQuery.data ?? []).reduce(
    (s, c) => s + c.sections.filter((sec) => sec.classTeacherId).length, 0,
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Academic Setup</h1>
            <p className="text-sm text-muted-foreground">
              Configure academic years, classes, and sections.
            </p>
          </div>
        </div>

        {/* Year selector */}
        <div className="flex min-w-56 flex-col gap-1.5">
          <Label htmlFor="academic-year" className="text-xs">Academic year</Label>
          <select
            id="academic-year"
            value={selectedYearId ?? ''}
            onChange={(e) => { setSelectedYearId(e.target.value || null); setExpandedClassId(null); }}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            disabled={yearsQuery.isLoading || years.length === 0}
          >
            {years.length === 0 && <option value="">No academic year</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Classes</p>
          <p className="mt-1 text-3xl font-bold">{classesQuery.data?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Sections</p>
          <p className="mt-1 text-3xl font-bold">{totalSections}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Teachers Assigned</p>
          <p className="mt-1 text-3xl font-bold">{assignedSections}</p>
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

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <AcademicYearForm
            onSuccess={async (year) => {
              setSelectedYearId(year.id);
              setMessage({ text: `Academic year ${year.name} created.`, type: 'success' });
              await invalidate();
            }}
          />
          <AcademicYearPanel selectedYear={selectedYear}
            onMutate={async (text) => { setMessage({ text, type: 'success' }); await invalidate(); }} />
        </div>

        <ClassesPanel
          selectedYear={selectedYear}
          classes={classesQuery.data ?? []}
          isLoading={classesQuery.isLoading}
          expandedClassId={expandedClassId}
          setExpandedClassId={setExpandedClassId}
          onMutate={async (text) => {
            setMessage({ text, type: 'success' });
            await queryClient.invalidateQueries({ queryKey: classesQueryKey(selectedYearId) });
          }}
        />
      </div>
    </div>
  );
}

function AcademicYearForm({ onSuccess }: { onSuccess: (year: AcademicYear) => Promise<void> }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: async (year) => { setName(''); setStartDate(''); setEndDate(''); setError(null); await onSuccess(year); },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not create academic year')),
  });

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <CardTitle className="text-base">New Academic Year</CardTitle>
        <CardDescription>Create the session before adding classes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, startDate, endDate }); }}
          className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="year-name">Name</Label>
            <Input id="year-name" placeholder="2026-27" value={name}
              onChange={(e) => setName(e.target.value)} required className="shadow-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <Input id="start-date" type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} required className="shadow-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date">End date</Label>
              <Input id="end-date" type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)} required className="shadow-sm" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full shadow-sm" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
            Create year
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AcademicYearPanel({ selectedYear, onMutate }:
  { selectedYear: AcademicYear | null; onMutate: (msg: string) => Promise<void>; }) {
  const activateMutation = useMutation({
    mutationFn: activateAcademicYear,
    onSuccess: (y) => onMutate(`${y.name} is now the active year.`),
  });
  const closeMutation = useMutation({
    mutationFn: closeAcademicYear,
    onSuccess: (y) => onMutate(`${y.name} has been closed.`),
  });

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <CardTitle className="text-base">Selected Year</CardTitle>
        <CardDescription>Only one year can be active at a time.</CardDescription>
      </CardHeader>
      <CardContent>
        {selectedYear ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">{selectedYear.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selectedYear.startDate)} – {formatDate(selectedYear.endDate)}
                  </p>
                </div>
              </div>
              <Badge variant={selectedYear.isActive ? 'success' : 'secondary'}>
                {selectedYear.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 shadow-sm"
                disabled={selectedYear.isActive || activateMutation.isPending}
                onClick={() => activateMutation.mutate(selectedYear.id)}>
                Activate
              </Button>
              <Button type="button" variant="outline" className="flex-1 shadow-sm"
                disabled={!selectedYear.isActive || closeMutation.isPending}
                onClick={() => closeMutation.mutate(selectedYear.id)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CalendarCheck className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Create an academic year to begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClassesPanel({ selectedYear, classes, isLoading, expandedClassId, setExpandedClassId, onMutate }:
  { selectedYear: AcademicYear | null; classes: ClassRecord[]; isLoading: boolean;
    expandedClassId: string | null; setExpandedClassId: (id: string | null) => void;
    onMutate: (msg: string) => Promise<void>; }) {
  const [className, setClassName] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [classError, setClassError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: async (c) => {
      setClassName(''); setDisplayOrder(''); setClassError(null);
      setExpandedClassId(c.id);
      await onMutate(`${c.name} created.`);
    },
    onError: (err) => setClassError(getApiErrorMessage(err, 'Could not create class')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: (c) => onMutate(`${c.name} deleted.`),
  });

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Classes & Sections</CardTitle>
            <CardDescription>Add classes, then expand to add sections.</CardDescription>
          </div>
          <Badge variant="outline">{classes.length} classes</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Add class form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedYear) return;
            createMutation.mutate({ name: className, academicYearId: selectedYear.id,
              displayOrder: displayOrder ? Number(displayOrder) : undefined });
          }}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_120px_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="class-name">Class name</Label>
            <Input id="class-name" placeholder="Grade 1" value={className}
              onChange={(e) => setClassName(e.target.value)} disabled={!selectedYear} required className="shadow-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-order">Order</Label>
            <Input id="display-order" type="number" min={0} placeholder="1" value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)} disabled={!selectedYear} className="shadow-sm" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={!selectedYear || createMutation.isPending} className="shadow-sm">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
              Add class
            </Button>
          </div>
        </form>

        {classError && <p className="text-sm text-destructive">{classError}</p>}

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
              <School className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{selectedYear ? 'No classes yet' : 'Select a year first'}</p>
              <p className="text-xs text-muted-foreground">
                {selectedYear ? 'Add the first class above.' : 'Create or select an academic year.'}
              </p>
            </div>
          ) : (
            classes.map((c) => (
              <ClassRow key={c.id} classRecord={c}
                expanded={expandedClassId === c.id}
                onToggle={() => setExpandedClassId(expandedClassId === c.id ? null : c.id)}
                onDelete={() => deleteMutation.mutate(c.id)}
                onMutate={onMutate}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ClassRow({ classRecord, expanded, onToggle, onDelete, onMutate }:
  { classRecord: ClassRecord; expanded: boolean; onToggle: () => void; onDelete: () => void;
    onMutate: (msg: string) => Promise<void>; }) {
  const [sectionName, setSectionName] = useState('');
  const [maxStudents, setMaxStudents] = useState('40');
  const [sectionError, setSectionError] = useState<string | null>(null);

  const sectionMutation = useMutation({
    mutationFn: createSection,
    onSuccess: async (s) => {
      setSectionName(''); setMaxStudents('40'); setSectionError(null);
      await onMutate(`Section ${s.name} added to ${classRecord.name}.`);
    },
    onError: (err) => setSectionError(getApiErrorMessage(err, 'Could not create section')),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: deleteSection,
    onSuccess: (s) => onMutate(`Section ${s.name} deleted.`),
  });

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Class header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background transition-colors hover:bg-accent"
          aria-label={expanded ? 'Collapse' : 'Expand'}>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
          <School className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{classRecord.name}</p>
          <p className="text-xs text-muted-foreground">{classRecord.sections.length} sections</p>
        </div>
        <Button type="button" variant="ghost" size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete} aria-label="Delete class">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 pb-4 pt-4 space-y-4">
          {/* Add section form */}
          <form onSubmit={(e) => {
            e.preventDefault();
            sectionMutation.mutate({ classId: classRecord.id, name: sectionName, maxStudents: maxStudents ? Number(maxStudents) : undefined });
          }} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_auto]">
            <div className="space-y-1.5">
              <Label htmlFor={`sn-${classRecord.id}`}>Section name</Label>
              <Input id={`sn-${classRecord.id}`} placeholder="A" value={sectionName}
                onChange={(e) => setSectionName(e.target.value)} required className="shadow-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ms-${classRecord.id}`}>Max students</Label>
              <Input id={`ms-${classRecord.id}`} type="number" min={1} max={200} value={maxStudents}
                onChange={(e) => setMaxStudents(e.target.value)} className="shadow-sm" />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline" disabled={sectionMutation.isPending} className="shadow-sm">
                {sectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus />}
                Add section
              </Button>
            </div>
          </form>

          {sectionError && <p className="text-sm text-destructive">{sectionError}</p>}

          {/* Sections grid */}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {classRecord.sections.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground">No sections added yet.</p>
            ) : (
              classRecord.sections.map((section) => {
                const hasTeacher = Boolean(section.classTeacher?.user ?? section.classTeacherId);
                return (
                  <div key={section.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                      hasTeacher
                        ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-900/10'
                        : 'border-border bg-background'
                    }`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Section {section.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {hasTeacher
                          ? section.classTeacher?.user
                            ? `${section.classTeacher.user.firstName} ${section.classTeacher.user.lastName}`
                            : 'Teacher assigned'
                          : `Cap. ${section.maxStudents}`}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="icon"
                      className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSectionMutation.mutate(section.id)} aria-label="Delete section">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
