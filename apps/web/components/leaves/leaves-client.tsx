'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, CheckCircle2, Loader2, Save, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type StudentLeaveApplication,
  applyStudentLeave,
  approveStudentLeave,
  getApiErrorMessage,
  listAllStudentLeaves,
  listMyStudentLeaves,
  rejectStudentLeave,
} from '@/lib/school-life/api';
import { useAuthStore } from '@/store/auth.store';

export function LeavesClient() {
  const user = useAuthStore((s) => s.user);
  const isStudent = user?.role.toLowerCase().includes('student');
  const canReview =
    !isStudent &&
    (user?.permissions.includes('leave:read') ||
      user?.permissions.includes('leave:approve') ||
      user?.permissions.includes('*'));

  if (isStudent) return <StudentLeaveView />;
  if (canReview) return <TeacherLeaveReviewView />;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <CalendarOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">No access</p>
      <p className="mt-1 text-sm text-muted-foreground">You do not have permission to view leaves.</p>
    </div>
  );
}

// ─── Student view ─────────────────────────────────────────────────────────────

function StudentLeaveView() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const leavesQuery = useQuery({ queryKey: ['my-student-leaves'], queryFn: listMyStudentLeaves });

  const mutation = useMutation({
    mutationFn: applyStudentLeave,
    onSuccess: async () => {
      setError(null);
      setSuccess(true);
      setForm({ startDate: '', endDate: '', reason: '' });
      await queryClient.invalidateQueries({ queryKey: ['my-student-leaves'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not apply leave')),
  });

  const pending = (leavesQuery.data ?? []).filter((l) => l.status === 'PENDING').length;
  const approved = (leavesQuery.data ?? []).filter((l) => l.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
          <CalendarOff className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">Apply for leave and track your applications.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pending}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Approved</p>
          <p className="mt-1 text-3xl font-bold">{approved}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Total Requests</p>
          <p className="mt-1 text-3xl font-bold">{leavesQuery.data?.length ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Apply form */}
        <Card className="border-0 shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <CardTitle className="text-base">Apply for Leave</CardTitle>
            <CardDescription>Your class teacher will review the request.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); setSuccess(false); mutation.mutate(form); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="leave-start">Start date</Label>
                  <Input id="leave-start" type="date" value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required className="shadow-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="leave-end">End date</Label>
                  <Input id="leave-end" type="date" value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} required className="shadow-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leave-reason">Reason</Label>
                <textarea id="leave-reason" value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  required minLength={3} maxLength={500}
                  placeholder="e.g. Fever, family function, medical appointment…"
                  className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">✓ Leave request submitted.</p>}
              <Button type="submit" disabled={mutation.isPending} className="w-full shadow-sm">
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save />}
                Submit request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="border-0 shadow-sm ring-1 ring-border/50">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">My Applications</CardTitle>
                <CardDescription>All leave requests you have submitted.</CardDescription>
              </div>
              <Badge variant="outline">{leavesQuery.data?.length ?? 0} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {leavesQuery.isLoading ? <LoadingState label="leave requests" /> :
              (leavesQuery.data ?? []).length === 0 ?
                <EmptyState icon={CalendarOff} title="No leave requests" desc="Submit your first leave request using the form." /> :
                leavesQuery.data?.map((leave) => (
                  <StudentLeaveCard key={leave.id} leave={leave} />
                ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Teacher / Admin review ───────────────────────────────────────────────────

function TeacherLeaveReviewView() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.permissions.includes('leave:approve') || user?.permissions.includes('*');

  const [remarkMap, setRemarkMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  const leavesQuery = useQuery({ queryKey: ['all-student-leaves'], queryFn: listAllStudentLeaves });

  const approveMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) => approveStudentLeave(id, remarks),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['all-student-leaves'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) => rejectStudentLeave(id, remarks),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['all-student-leaves'] }),
  });

  const all = leavesQuery.data ?? [];
  const displayed = all.filter((l) => filter === 'ALL' || l.status === filter);
  const pendingCount = all.filter((l) => l.status === 'PENDING').length;

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'PENDING', label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
            <CalendarOff className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Student Leave Requests</h1>
            <p className="text-sm text-muted-foreground">Review and action leave applications.</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Badge className="self-start border-0 bg-amber-100 text-amber-700 sm:self-auto dark:bg-amber-900/30 dark:text-amber-400">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Pending', value: all.filter((l) => l.status === 'PENDING').length, gradient: 'from-amber-500 to-orange-600' },
          { label: 'Approved', value: all.filter((l) => l.status === 'APPROVED').length, gradient: 'from-green-500 to-emerald-700' },
          { label: 'Rejected', value: all.filter((l) => l.status === 'REJECTED').length, gradient: 'from-red-500 to-rose-700' },
          { label: 'Total', value: all.length, gradient: 'from-slate-500 to-slate-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl bg-gradient-to-br ${s.gradient} p-4 text-white shadow-md`}>
            <p className="text-xs text-white/80">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted p-1">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setFilter(tab.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all min-w-[80px] ${
              filter === tab.key
                ? 'bg-white text-foreground shadow-sm dark:bg-card'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applications list */}
      <div className="space-y-3">
        {leavesQuery.isLoading ? <LoadingState label="applications" /> :
          displayed.length === 0 ? (
            <EmptyState icon={CalendarOff} title={`No ${filter === 'ALL' ? '' : filter.toLowerCase() + ' '}applications`}
              desc="Leave applications will appear here." />
          ) : (
            displayed.map((leave) => {
              const isPending = leave.status === 'PENDING';
              const isActioning =
                (approveMutation.isPending && approveMutation.variables?.id === leave.id) ||
                (rejectMutation.isPending && rejectMutation.variables?.id === leave.id);

              return (
                <div key={leave.id}
                  className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
                  {/* Status bar */}
                  <div className={`h-1 w-full ${
                    leave.status === 'PENDING' ? 'bg-amber-400' :
                    leave.status === 'APPROVED' ? 'bg-green-500' :
                    leave.status === 'REJECTED' ? 'bg-red-500' : 'bg-border'
                  }`} />

                  <div className="space-y-4 p-4">
                    {/* Student + status */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {(leave.student?.firstName ?? '?').charAt(0)}{(leave.student?.lastName ?? '').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {leave.student?.firstName} {leave.student?.lastName}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              #{leave.student?.admissionNo}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {leave.student?.class?.name ?? '—'}
                            {leave.student?.section ? ` · Section ${leave.student.section.name}` : ''}
                          </p>
                        </div>
                      </div>
                      <LeaveStatusBadge status={leave.status} />
                    </div>

                    {/* Dates + reason */}
                    <div className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {formatDate(leave.startDate)}
                        {leave.startDate !== leave.endDate && ` → ${formatDate(leave.endDate)}`}
                        {' · '}{leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}
                      </p>
                      <p className="text-sm">{leave.reason}</p>
                    </div>

                    {leave.remarks && (
                      <div className="flex items-start gap-2 rounded-lg border-l-4 border-primary/30 bg-primary/5 px-3 py-2">
                        <p className="text-xs"><span className="font-medium">Remark:</span> {leave.remarks}</p>
                      </div>
                    )}

                    {leave.approver && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed by <span className="font-medium">{leave.approver.firstName} {leave.approver.lastName}</span>
                        {leave.approvedAt ? ` on ${formatDate(leave.approvedAt)}` : ''}
                      </p>
                    )}

                    {/* Action row */}
                    {isPending && canApprove && (
                      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <Label htmlFor={`remark-${leave.id}`} className="text-xs">Remark (optional)</Label>
                          <Input
                            id={`remark-${leave.id}`}
                            placeholder="e.g. Approved after parent confirmation."
                            value={remarkMap[leave.id] ?? ''}
                            onChange={(e) => setRemarkMap((p) => ({ ...p, [leave.id]: e.target.value }))}
                            disabled={isActioning} className="h-8 text-sm shadow-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm"
                            className="bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-500/30"
                            disabled={isActioning}
                            onClick={() => approveMutation.mutate({ id: leave.id, remarks: remarkMap[leave.id] || undefined })}>
                            {approveMutation.isPending && approveMutation.variables?.id === leave.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            disabled={isActioning}
                            onClick={() => rejectMutation.mutate({ id: leave.id, remarks: remarkMap[leave.id] || undefined })}>
                            {rejectMutation.isPending && rejectMutation.variables?.id === leave.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <XCircle className="h-3.5 w-3.5" />}
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function StudentLeaveCard({ leave }: { leave: StudentLeaveApplication }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm">
      <div className={`h-1 w-full ${
        leave.status === 'PENDING' ? 'bg-amber-400' :
        leave.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium">
            {formatDate(leave.startDate)}
            {leave.startDate !== leave.endDate ? ` → ${formatDate(leave.endDate)}` : ''}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''} · {leave.reason}
          </p>
          {leave.remarks && (
            <p className="text-xs text-muted-foreground mt-1">Remark: {leave.remarks}</p>
          )}
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>
    </div>
  );
}

function LeaveStatusBadge({ status }: { status: StudentLeaveApplication['status'] }) {
  const styles =
    status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' :
    status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400' :
    status === 'CANCELLED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
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
