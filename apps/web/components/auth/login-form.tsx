'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Lock, Mail, School } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  subdomain: z
    .string()
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers, and dashes only')
    .optional(),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  totpCode: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  success: boolean;
  data: {
    requiresTwoFactor?: boolean;
    accessToken?: string;
    expiresIn?: number;
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

export function LoginForm({ className }: { className?: string }) {
  const router = useRouter();
  const { setAccessToken, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const subdomain = data.subdomain?.trim();
      const res = await api.post<LoginResponse>(
        '/auth/login',
        { email: data.email, password: data.password, totpCode: data.totpCode },
        subdomain ? { headers: { 'X-Tenant-Subdomain': subdomain } } : undefined,
      );
      const payload = res.data.data;

      if (payload.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        return;
      }

      if (payload.accessToken && payload.user) {
        setAccessToken(payload.accessToken);
        setUser({
          id: payload.user.id,
          email: payload.user.email,
          firstName: payload.user.firstName,
          lastName: payload.user.lastName,
          role: payload.user.role,
          tenantId: payload.user.tenantId,
          permissions: payload.user.permissions ?? [],
        });
        router.push('/');
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Invalid credentials';
      setError('root', { message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        'space-y-5 rounded-2xl border bg-card/80 p-8 shadow-xl shadow-black/5 backdrop-blur-sm',
        className,
      )}
      noValidate
    >
      {/* School code */}
      <div className="space-y-1.5">
        <Label htmlFor="subdomain" className="text-sm font-medium">
          School code
        </Label>
        <div className="relative">
          <School className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="subdomain"
            type="text"
            placeholder="greenwood"
            autoComplete="organization"
            disabled={isLoading}
            className="pl-9"
            {...register('subdomain')}
            aria-invalid={!!errors.subdomain}
          />
        </div>
        {errors.subdomain ? (
          <p className="text-xs text-destructive" role="alert">{errors.subdomain.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Leave blank for platform Super Admin only.</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@school.com"
            autoComplete="email"
            disabled={isLoading}
            className="pl-9"
            {...register('email')}
            aria-invalid={!!errors.email}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={isLoading}
            className="pl-9 pr-10"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>
        )}
      </div>

      {/* 2FA */}
      {requiresTwoFactor && (
        <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Label htmlFor="totpCode" className="text-sm font-medium">Authenticator code</Label>
          <Input
            id="totpCode"
            type="text"
            inputMode="numeric"
            placeholder="000 000"
            maxLength={6}
            autoComplete="one-time-code"
            disabled={isLoading}
            className="text-center text-lg tracking-[0.5em] font-mono"
            {...register('totpCode')}
          />
          <p className="text-xs text-muted-foreground text-center">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      )}

      {errors.root && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
          <span className="mt-0.5 text-destructive">⚠</span>
          <p className="text-sm text-destructive">{errors.root.message}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-primary shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/20"
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Signing in…</>
        ) : requiresTwoFactor ? (
          'Verify code'
        ) : (
          'Sign in'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New school?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Start a free trial →
        </Link>
      </p>
    </form>
  );
}
