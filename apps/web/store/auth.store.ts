import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  permissions: string[];
}

interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  branding: TenantBranding | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  setUser: (user: UserProfile) => void;
  setBranding: (branding: TenantBranding) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      branding: null,
      isAuthenticated: false,
      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      setBranding: (branding) => set({ branding }),
      logout: () =>
        set({ accessToken: null, user: null, branding: null, isAuthenticated: false }),
      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.permissions.includes('*')) return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, branding: state.branding }),
      // Don't persist accessToken — keep in memory only
    },
  ),
);
