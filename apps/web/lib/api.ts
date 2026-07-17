'use client';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send cookies for refresh token
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: silent token refresh on 401
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

interface RefreshPayload {
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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post<RefreshPayload>(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken = data.data.accessToken as string;
        const store = useAuthStore.getState();
        store.setAccessToken(newToken);
        if (data.data.user) {
          store.setUser({
            id: data.data.user.id,
            email: data.data.user.email,
            firstName: data.data.user.firstName,
            lastName: data.data.user.lastName,
            role: data.data.user.role,
            tenantId: data.data.user.tenantId,
            permissions: data.data.user.permissions ?? [],
          });
        }
        refreshSubscribers.forEach((cb) => cb(newToken));
        refreshSubscribers = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
