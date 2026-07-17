'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Save,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  AttendanceStatus,
  applyStudentLeave,
  getApiErrorMessage,
  getMyAttendance,
  getSectionAttendance,
  listMyStudentLeaves,
  listMyTeacherSections,
  markSectionAttendance,
} from '@/lib/school-life/api';
import { useAuthStore } from '@/store/auth.store';

const statuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-500/10 text-green-700 border-green-200 hover:bg-green-500/20 dark:text-green-400 dark:border-green-900',
  ABSENT: 'bg-red-500/10 text-red-700 border-red-200 hover:bg-red-500/20 dark:text-red-400 dark:border-red-900',
  LATE: 'bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-900',
  EXCUSED: 'bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-500/20 dark:text-blue-400 dark:border-blue-900',
};

const statusActiveColors: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-500 text-white border-green-500 shadow-lg shadow-green-500/30',
  ABSENT: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30',
  LATE: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30',
  EXCUSED: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30',
};

export function AttendanceClient() {
  const user = useAuthStore((state) => state.user);
  const isStudent = user?.role.toLowerCase().includes('student');
  if (isStudent) return <StudentAttendanceView />;
  return <TeacherAttendanceView />;
}

function TeacherAttendanceView() {
  const queryClient = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionsQuery = useQuery({ queryKey: ['teacher-sections'], queryFn: listMyTeacherSections });

  useEffect(() => {
    if (!selectedSectionId && sectionsQuery.data?.[0]) {
      setSelectedSectionId(sectionsQuery.data[0].id);
    }
  }, [selectedSectionId, sectionsQuery.data]);

  const rosterQuery = useQuery({
    queryKey: ['section-attendance', selectedSectionId, date],
    queryFn: () => getSectionAttendance(selectedSectionId, date),
    enabled: Boolean(selectedSectionId && date),
  });

  useEffect(() => {
    if (!rosterQuery.data) return;
    setEntries(Object.fromEntries(
      rosterQuery.data.students.map((s) => [s.id, s.attendance?.status ?? 'PRESENT']),
    ));
    setSaved(false);
  }, [rosterQuery.data]);

  const selectedSection = useMemo(
    () => sectionsQuery.data?.find((s) => s.id === selectedSectionId) ?? null,
    [sectionsQuery.data, selectedSectionId],
  );

  const counts = Object.values(entries).reduce(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const mutation = useMutation({
    mutationFn: () =>
      markSectionAttendance({
        sectionId: selectedSectionId,
        date,
        entries: Object.entries(entries).map(([studentId, status]) => ({ studentId, status })),
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['section-attendance', selectedSectionId, date] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not save attendance')),
  });

  const markAll = (status: AttendanceStatus) => {
    setEntries((cur) => Object.fromEntries(Object.keys(cur).map((id) => [id, status])));
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
            <p className="text-sm text-muted-foreground">Mark daily attendance for your class sections.</p>
          </div>
        </div>

        {/* Section + Date selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="attendance-section" className="text-xs">Section</Label>
            <select
              id="attendance-section"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="">Select section</option>
              {sectionsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.class.name} – {s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="attendance-date" className="text-xs">Date</Label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary chips */}
      {Object.keys(entries).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.entries(counts) as [AttendanceStatus, number][]).map(([status, count]) => (
            <span key={status} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusColors[status]}`}>
              {status}: {count}
            </span>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-sm ring-1 ring-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {selectedSection
                  ? `${selectedSection.class.name} – Section ${selectedSection.name}`
                  : 'Select a section'}
              </CardTitle>
              <CardDescription>
                {rosterQuery.data?.students.length ?? 0} students · {formatDate(date)}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {sectionsQuery.data && sectionsQuery.data.length > 0 && (
                <>
                  <Button type="button" size="sm" variant="outline"
                    className="text-xs h-8 border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => markAll('PRESENT')}>
                    ✓ All present
                  </Button>
                  <Button type="button" size="sm" variant="outline"
                    className="text-xs h-8 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => markAll('ABSENT')}>
                    ✗ All absent
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {sectionsQuery.data?.length === 0 ? (
            <EmptyState icon={Users} title="No sections assigned" desc="You haven't been assigned as a class teacher to any section." />
          ) : rosterQuery.isLoading ? (
            <LoadingState label="roster" />
          ) : (rosterQuery.data?.students.length ?? 0) === 0 ? (
            <EmptyState icon={Users} title="No students" desc="No students in this section yet." />
          ) : (
            <div className="space-y-2">
              {rosterQuery.data?.students.map((student, idx) => (
                <div key={student.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent/30">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.admissionNo}{student.rollNo ? ` · Roll ${student.rollNo}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {statuses.map((status) => {
                      const active = entries[student.id] === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setEntries((cur) => ({ ...cur, [student.id]: status }))}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                            active ? statusActiveColors[status] : statusColors[status]
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">✓ Attendance saved successfully.</p>}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              disabled={!selectedSectionId || Object.keys(entries).length === 0 || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="shadow-sm"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />}
              Save attendance
            </Button>
            <p className="text-xs text-muted-foreground">
              {Object.keys(entries).length} students marked
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentAttendanceView() {
  const queryClient = useQueryClient();
  const attendanceQuery = useQuery({ queryKey: ['my-attendance'], queryFn: getMyAttendance });
  const leavesQuery = useQuery({ queryKey: ['my-student-leaves'], queryFn: listMyStudentLeaves });
  const data = attendanceQuery.data;
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState(false);

  const leaveMutation = useMutation({
    mutationFn: applyStudentLeave,
    onSuccess: async () => {
      setLeaveError(null);
      setLeaveSuccess(true);
      setLeaveForm({ startDate: '', endDate: '', reason: '' });
      await queryClient.invalidateQueries({ queryKey: ['my-student-leaves'] });
    },
    onError: (err) => setLeaveError(getApiErrorMessage(err, 'Could not apply leave')),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30">
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-sm text-muted-foreground">Track your attendance and manage leave requests.</p>
        </div>
      </div>

      {attendanceQuery.isLoading ? (
        <LoadingState label="attendance" />
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            {[
              { label: 'Attendance %', value: data.summary.percentage !== null ? `${data.summary.percentage}%` : '—', gradient: 'from-blue-500 to-blue-700', icon: TrendingUp },
              { label: 'Total Days', value: data.summary.total, gradient: 'from-slate-500 to-slate-700', icon: CalendarCheck },
              { label: 'Present', value: data.summary.PRESENT, gradient: 'from-green-500 to-emerald-700', icon: CheckCircle2 },
              { label: 'Absent', value: data.summary.ABSENT, gradient: 'from-red-500 to-rose-700', icon: CalendarCheck },
              { label: 'Late', value: data.summary.LATE, gradient: 'from-amber-500 to-amber-700', icon: CalendarCheck },
            ].map((item) => (
              <div key={item.label}
                className={`relative overflow-hidden rounded-xl p-4 text-white shadow-md bg-gradient-to-br ${item.gradient}`}>
                <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
                <p className="text-xs font-medium text-white/80">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Records */}
          <Card className="border-0 shadow-sm ring-1 ring-border/50">
            <CardHeader>
              <CardTitle className="text-base">Recent Records</CardTitle>
              <CardDescription>Last 90 attendance entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.records.length === 0 ? (
                <EmptyState icon={CalendarCheck} title="No attendance yet" desc="Your attendance will appear here once marked by your teacher." />
              ) : (
                data.records.map((record) => {
                  const statusBg =
                    record.status === 'PRESENT' ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900' :
                    record.status === 'ABSENT' ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900' :
                    record.status === 'LATE' ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900' :
                    'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900';

                  return (
                    <div key={record.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${statusBg}`}>
                      <div>
                        <p className="font-medium">{formatDate(record.date)}</p>
                        <p className="text-xs text-muted-foreground">{record.class.name} – {record.section.name}</p>
                      </div>
                      <Badge variant={
                        record.status === 'PRESENT' ? 'success' :
                        record.status === 'ABSENT' ? 'destructive' :
                        record.status === 'LATE' ? 'warning' : 'secondary'
                      }>
                        {record.status}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Leave apply + history */}
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="border-0 shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <CardTitle className="text-base">Apply for Leave</CardTitle>
                <CardDescription>Your class teacher will review your request.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); leaveMutation.mutate(leaveForm); }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="leave-start">Start date</Label>
                      <Input id="leave-start" type="date" value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm((p) => ({ ...p, startDate: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="leave-end">End date</Label>
                      <Input id="leave-end" type="date" value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="leave-reason">Reason</Label>
                    <textarea id="leave-reason" value={leaveForm.reason}
                      onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                      required placeholder="e.g. Fever, family function, medical appointment…"
                      className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  </div>
                  {leaveError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{leaveError}</p>}
                  {leaveSuccess && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Leave request submitted.</p>}
                  <Button type="submit" disabled={leaveMutation.isPending} className="w-full">
                    {leaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />}
                    Submit request
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-border/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Leave Requests</CardTitle>
                    <CardDescription>Your submitted applications.</CardDescription>
                  </div>
                  <Badge variant="outline">{leavesQuery.data?.length ?? 0} total</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {leavesQuery.isLoading ? <LoadingState label="leave requests" /> :
                  (leavesQuery.data ?? []).length === 0 ?
                    <EmptyState icon={CalendarCheck} title="No leave requests" desc="Apply for leave using the form." /> :
                    leavesQuery.data?.map((leave) => (
                      <div key={leave.id}
                        className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-accent/30">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {formatDate(leave.startDate)}
                            {leave.startDate !== leave.endDate ? ` → ${formatDate(leave.endDate)}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''} · {leave.reason}
                          </p>
                        </div>
                        <Badge variant={
                          leave.status === 'APPROVED' ? 'success' :
                          leave.status === 'REJECTED' ? 'destructive' : 'warning'
                        }>
                          {leave.status}
                        </Badge>
                      </div>
                    ))
                }
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
