'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  BarChart2,
  BookMarked,
  BookOpen,
  Briefcase,
  Building,
  Building2,
  Bus,
  Calendar,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PenLine,
  School,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { navConfig, superAdminNavConfig, type NavItem } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

const icons: Record<string, LucideIcon> = {
  Activity, BarChart2, BookMarked, BookOpen, Briefcase, Building, Building2,
  Bus, Calendar, CalendarDays, CalendarOff, ClipboardList, CreditCard, FileText,
  LayoutDashboard, Library, MessageSquare, Package, PenLine, School, Settings,
  Users, Wallet,
};

// Color map for nav items — cycles through a set of accent colors
const navColors: Record<string, string> = {
  '/': 'text-violet-400',
  '/students': 'text-blue-400',
  '/academic': 'text-cyan-400',
  '/attendance': 'text-green-400',
  '/leaves': 'text-amber-400',
  '/staff': 'text-purple-400',
  '/exams': 'text-pink-400',
  '/homework': 'text-orange-400',
  '/fees': 'text-emerald-400',
  '/payroll': 'text-teal-400',
  '/library': 'text-indigo-400',
  '/transport': 'text-sky-400',
  '/hostel': 'text-rose-400',
  '/inventory': 'text-yellow-400',
  '/events': 'text-fuchsia-400',
  '/communication': 'text-lime-400',
  '/reports': 'text-red-400',
  '/settings': 'text-slate-400',
};

interface DashboardShellProps { children: ReactNode; }

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, branding, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isSuperAdmin =
    user?.permissions.includes('*') || user?.role.toLowerCase().includes('super');
  const items = filterNavItems(isSuperAdmin ? superAdminNavConfig : navConfig, user?.permissions);
  const schoolName = branding?.name ?? 'School ERP';
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Signed out';
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    finally { logout(); router.replace('/login'); }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col transition-all duration-300 md:flex',
        'bg-[hsl(var(--sidebar-bg))]',
        sidebarOpen ? 'w-64' : 'w-[72px]',
      )}>
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-[hsl(var(--sidebar-border))] px-4',
          sidebarOpen ? 'gap-3' : 'justify-center',
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/40">
            <School className="h-4 w-4 text-white" />
          </div>
          {sidebarOpen && (
            <Link href="/" className="truncate text-sm font-bold text-white" title={schoolName}>
              {schoolName}
            </Link>
          )}
        </div>

        {/* Nav */}
        <SidebarNav items={items} pathname={pathname} collapsed={!sidebarOpen} />

        {/* Bottom: collapse toggle */}
        <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg px-2 text-[hsl(var(--sidebar-fg))]',
              'hover:bg-[hsl(var(--sidebar-hover-bg))] transition-colors',
              !sidebarOpen && 'justify-center',
            )}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className={cn(
        'flex min-h-screen flex-1 flex-col transition-[margin] duration-300',
        sidebarOpen ? 'md:ml-64' : 'md:ml-[72px]',
      )}>
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur-md md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb / page title placeholder */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{schoolName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.role ?? 'Dashboard'}</p>
          </div>

          {/* User area */}
          <div className="flex items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            {/* Avatar */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Mobile nav */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[hsl(var(--sidebar-bg))] shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <School className="h-4 w-4 text-white" />
                </div>
                <span className="truncate text-sm font-bold text-white">{schoolName}</span>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)} aria-label="Close" className="text-[hsl(var(--sidebar-fg))]">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarNav items={items} pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-fg))] hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SidebarNav({
  items,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-auto py-4 px-3 scrollbar-hide">
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = icons[item.icon] ?? LayoutDashboard;
  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
  const iconColor = navColors[item.href] ?? 'text-[hsl(var(--sidebar-fg))]';

  return (
    <div>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? item.title : undefined}
        className={cn(
          'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150',
          active
            ? 'bg-primary text-white shadow-md shadow-primary/30'
            : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : iconColor)} />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </Link>

      {!collapsed && item.children?.length && (pathname.startsWith(item.href)) ? (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[hsl(var(--sidebar-border))] pl-3">
          {item.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'block rounded-md px-3 py-2 text-xs font-medium transition-colors',
                  childActive
                    ? 'text-white'
                    : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-white',
                )}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function filterNavItems(items: NavItem[], permissions: string[] = []): NavItem[] {
  const canAccess = (item: NavItem) => {
    if (permissions.includes('*')) return true;
    if (item.permissions?.length) return item.permissions.some((p) => permissions.includes(p));
    if (item.permission) return permissions.includes(item.permission);
    return true;
  };
  return items.filter(canAccess).map((item) => ({
    ...item,
    children: item.children?.filter(canAccess),
  }));
}
