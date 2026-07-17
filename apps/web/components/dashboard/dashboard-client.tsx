'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type AccountantStats,
  type AdminStats,
  type StudentStats,
  type TeacherStats,
  getDashboardStats,
} from '@/lib/dashboard/api';
import { useAuthStore } from '@/store/auth.store';

export function DashboardClient() {
  const user = useAuthStore((s) => s.user);

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 5 * 60 * 1000,
  });

  const role = user?.role.toLowerCase() ?? '';
  const permissions = user?.permissions ?? [];

  const isAdmin =
    permissions.includes('*') ||
    role.includes('owner') ||
    role.includes('principal') ||
    role.includes('admin') ||
    role.includes('vice');
  const isAccountant = role.includes('accountant');
  const isStudent = role.includes('student');

  const greeting = getGreeting();
  const firstName = user?.firstName ?? '';

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              {firstName}
            </span>{' '}
            👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <Badge variant="outline" className="self-start border-primary/20 bg-primary/5 text-primary sm:self-auto">
          {user?.role ?? 'Dashboard'}
        </Badge>
      </div>

      {/* ── KPIs ── */}
      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : statsQuery.error ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <XCircle className="h-5 w-5 shrink-0" />
          Could not load stats. Try refreshing the page.
        </div>
      ) : isAdmin ? (
        <AdminDashboard stats={statsQuery.data as AdminStats} />
      ) : isAccountant ? (
        <AccountantDashboard stats={statsQuery.data as AccountantStats} />
      ) : isStudent ? (
        <StudentDashboard stats={statsQuery.data as StudentStats} />
      ) : (
        <TeacherDashboard stats={statsQuery.data as TeacherStats} />
      )}
    </div>
  );
}

// ─── Gradient KPI card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  href,
  gradient,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href?: string;
  gradient: string;
  icon: React.ElementType;
}) {
  const inner = (
    <div
      className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg transition-transform hover:scale-[1.02] ${gradient}`}
    >
      {/* Decorative circle */}
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/5" />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white/80">{label}</p>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents} sub="admitted" href="/students"
          gradient="bg-gradient-to-br from-blue-500 to-blue-700" icon={Users} />
        <StatCard label="Total Staff" value={stats.totalStaff} sub="active" href="/staff"
          gradient="bg-gradient-to-br from-violet-500 to-violet-700" icon={Users} />
        <StatCard label="Active Classes" value={stats.activeClasses} sub="this year" href="/academic"
          gradient="bg-gradient-to-br from-cyan-500 to-cyan-700" icon={BookOpen} />
        <StatCard
          label="Pending Leaves" value={stats.pendingLeaves} sub="awaiting review" href="/leaves"
          gradient={stats.pendingLeaves > 0
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-slate-500 to-slate-700'}
          icon={CalendarOff}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AttendanceCard present={stats.todayPresent} absent={stats.todayAbsent} pct={stats.attendancePct} />
        <QuickActionsCard role="admin" />
      </div>
    </div>
  );
}

// ─── Teacher ──────────────────────────────────────────────────────────────────

function TeacherDashboard({ stats }: { stats: TeacherStats }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Sections" value={stats.mySections} sub="assigned to me" href="/attendance"
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" icon={BookOpen} />
        <StatCard label="My Students" value={stats.myStudents} sub="across sections"
          gradient="bg-gradient-to-br from-blue-500 to-blue-700" icon={Users} />
        <StatCard
          label="Pending Leaves" value={stats.pendingLeaves} sub="to review" href="/leaves"
          gradient={stats.pendingLeaves > 0
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-slate-500 to-slate-700'}
          icon={CalendarOff}
        />
        {/* Attendance status card */}
        <div className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg ${
          stats.todayMarked
            ? 'bg-gradient-to-br from-green-500 to-emerald-700'
            : 'bg-gradient-to-br from-yellow-500 to-amber-600'
        }`}>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Today's Attendance</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                {stats.todayMarked ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </div>
            </div>
            <p className="text-2xl font-bold">{stats.todayMarked ? 'Marked ✓' : 'Not marked'}</p>
            <p className="mt-1 text-xs text-white/70">
              {stats.todayMarked ? 'Attendance recorded for today' : 'Please mark before end of day'}
            </p>
          </div>
        </div>
      </div>
      <QuickActionsCard role="teacher" todayMarked={stats.todayMarked} />
    </div>
  );
}

// ─── Student ──────────────────────────────────────────────────────────────────

function StudentDashboard({ stats }: { stats: StudentStats | null }) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-medium">Student profile not set up</p>
        <p className="mt-1 text-sm text-muted-foreground">Contact your school administrator.</p>
      </div>
    );
  }

  const pct = stats.attendancePct;
  const pctColor = pct === null ? 'gray' : pct >= 75 ? 'green' : pct >= 60 ? 'yellow' : 'red';
  const pctGradient =
    pctColor === 'green' ? 'from-green-500 to-emerald-700' :
    pctColor === 'yellow' ? 'from-yellow-500 to-amber-600' :
    pctColor === 'red' ? 'from-red-500 to-rose-700' : 'from-slate-500 to-slate-700';

  return (
    <div className="space-y-6">
      {/* Profile banner */}
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 ring-1 ring-primary/10">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-lg shadow-primary/30">
          {stats.student.name.charAt(0)}
        </div>
        <div>
          <p className="text-lg font-bold">{stats.student.name}</p>
          <p className="text-sm text-muted-foreground">
            {stats.student.class ? stats.student.class : ''}
            {stats.student.section ? ` · Section ${stats.student.section}` : ''}
            {' · '}
            <span className="font-mono text-xs">#{stats.student.admissionNo}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance" value={pct !== null ? `${pct}%` : '—'}
          sub={`${stats.presentDays} / ${stats.totalDays} days`}
          href="/attendance" gradient={`bg-gradient-to-br ${pctGradient}`} icon={CalendarCheck}
        />
        <StatCard label="Present Days" value={stats.presentDays} sub="total recorded"
          gradient="bg-gradient-to-br from-green-500 to-emerald-700" icon={CheckCircle2} />
        <StatCard
          label="Pending Leaves" value={stats.pendingLeaves} sub="awaiting approval" href="/leaves"
          gradient={stats.pendingLeaves > 0
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-slate-500 to-slate-700'}
          icon={CalendarOff}
        />
        <StatCard label="Approved Leaves" value={stats.approvedLeaves} sub="this year" href="/leaves"
          gradient="bg-gradient-to-br from-teal-500 to-teal-700" icon={CalendarCheck} />
      </div>
      <QuickActionsCard role="student" />
    </div>
  );
}

// ─── Accountant ───────────────────────────────────────────────────────────────

function AccountantDashboard({ stats }: { stats: AccountantStats }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="This Month" value={fmt(stats.monthCollected)}
          sub={`${stats.monthTransactions} transactions`} href="/fees"
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" icon={TrendingUp} />
        <StatCard label="Total Collected" value={fmt(stats.totalCollected)} sub="all time" href="/fees"
          gradient="bg-gradient-to-br from-teal-500 to-teal-700" icon={CreditCard} />
        <StatCard
          label="Pending Payments" value={stats.pendingPayments} sub="unconfirmed" href="/fees"
          gradient={stats.pendingPayments > 0
            ? 'bg-gradient-to-br from-red-500 to-rose-700'
            : 'bg-gradient-to-br from-slate-500 to-slate-700'}
          icon={XCircle}
        />
      </div>
      <QuickActionsCard role="accountant" />
    </div>
  );
}

// ─── Attendance card ──────────────────────────────────────────────────────────

function AttendanceCard({ present, absent, pct }: { present: number; absent: number; pct: number | null }) {
  const total = present + absent;
  const barWidth = pct ?? 0;

  return (
    <Card className="lg:col-span-2 overflow-hidden border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Today's Attendance</CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs text-primary">
            <Link href="/attendance">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No attendance marked yet today</p>
            <p className="text-xs text-muted-foreground">Check back after teachers mark attendance</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-4xl font-bold">{pct !== null ? `${pct}%` : '—'}</span>
                <span className="ml-1 text-sm text-muted-foreground">present today</span>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="font-medium text-green-600">{present} present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="font-medium text-red-500">{absent} absent</span>
                </div>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-red-100 dark:bg-red-900/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActionsCard({
  role,
  todayMarked,
}: {
  role: 'admin' | 'teacher' | 'student' | 'accountant';
  todayMarked?: boolean;
}) {
  const actions: { label: string; href: string; icon: React.ElementType; badge?: string; color: string }[] =
    role === 'admin'
      ? [
          { label: 'Students', href: '/students', icon: Users, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
          { label: 'Staff', href: '/staff', icon: Users, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
          { label: 'Academic', href: '/academic', icon: BookOpen, color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' },
          { label: 'Leaves', href: '/leaves', icon: CalendarOff, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
        ]
      : role === 'teacher'
        ? [
            {
              label: todayMarked ? 'Update Attendance' : 'Mark Attendance',
              href: '/attendance',
              icon: ClipboardList,
              badge: todayMarked ? undefined : 'Due',
              color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            },
            { label: 'Review Leaves', href: '/leaves', icon: CalendarOff, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
          ]
        : role === 'student'
          ? [
              { label: 'My Attendance', href: '/attendance', icon: CalendarCheck, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
              { label: 'Apply Leave', href: '/leaves', icon: CalendarOff, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
            ]
          : [
              { label: 'Fee Collection', href: '/fees', icon: CreditCard, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
              { label: 'Pending Payments', href: '/fees', icon: XCircle, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
            ];

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:bg-accent hover:border-border"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
              <a.icon className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm font-medium">{a.label}</span>
            {a.badge && (
              <Badge className="text-xs bg-amber-100 text-amber-700 border-0 dark:bg-amber-900/30 dark:text-amber-400">
                {a.badge}
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// Fix missing import

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
