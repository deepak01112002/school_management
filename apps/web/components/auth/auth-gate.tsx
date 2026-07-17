'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface MeResponse {
  success: boolean;
  data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string | null;
    role: {
      name: string;
      permissions: string[];
    };
  };
}

interface RefreshResponse {
  data: {
    accessToken: string;
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      tenantId: string | null;
      permissions?: string[];
    };
  };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { accessToken, user, setAccessToken, setUser, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        let token = accessToken;
        let profileRestored = Boolean(user);
        if (!token) {
          const refresh = await api.post<RefreshResponse>('/auth/refresh');
          token = refresh.data.data.accessToken;
          setAccessToken(token);

          if (refresh.data.data.user) {
            const refreshedUser = refresh.data.data.user;
            setUser({
              id: refreshedUser.id,
              email: refreshedUser.email,
              firstName: refreshedUser.firstName,
              lastName: refreshedUser.lastName,
              tenantId: refreshedUser.tenantId,
              role: refreshedUser.role,
              permissions: refreshedUser.permissions ?? [],
            });
            profileRestored = true;
          }
        }

        if (!profileRestored && token) {
          const me = await api.get<MeResponse>('/auth/me');
          const profile = me.data.data;
          setUser({
            id: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            tenantId: profile.tenantId,
            role: profile.role.name,
            permissions: profile.role.permissions,
          });
        }

        if (!cancelled) {
          setChecking(false);
        }
      } catch {
        logout();
        router.replace('/login');
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [accessToken, logout, router, setAccessToken, setUser, user]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking session...
        </div>
      </div>
    );
  }

  return children;
}
