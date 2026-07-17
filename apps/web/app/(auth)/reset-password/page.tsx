'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

const schema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    otp: z
      .string()
      .length(6, 'OTP must be exactly 6 digits')
      .regex(/^\d+$/, 'OTP must contain only digits'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
        'Must include an uppercase letter, a number, and a special character',
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: data.email,
        otp: data.otp,
        newPassword: data.newPassword,
      });
      setDone(true);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'OTP expired or invalid. Please request a new one.';
      setError('root', { message });
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Password updated</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been reset. You can now sign in with your new credentials.
        </p>
        <Button className="w-full" onClick={() => router.replace('/login')}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-xl border bg-card p-8 shadow-sm"
      noValidate
    >
      <div>
        <h2 className="text-xl font-semibold">Reset password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the OTP we sent to your email and choose a new password.
        </p>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@school.com"
          autoComplete="email"
          disabled={isLoading}
          {...register('email')}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-xs text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* OTP */}
      <div className="space-y-1.5">
        <Label htmlFor="otp">One-time code</Label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          placeholder="123456"
          maxLength={6}
          autoComplete="one-time-code"
          disabled={isLoading}
          {...register('otp')}
          aria-invalid={!!errors.otp}
        />
        {errors.otp && (
          <p className="text-xs text-destructive" role="alert">
            {errors.otp.message}
          </p>
        )}
      </div>

      {/* New password */}
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            disabled={isLoading}
            className="pr-10"
            {...register('newPassword')}
            aria-invalid={!!errors.newPassword}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-xs text-destructive" role="alert">
            {errors.newPassword.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Min 8 chars, uppercase, number, special character.
        </p>
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="new-password"
          disabled={isLoading}
          {...register('confirmPassword')}
          aria-invalid={!!errors.confirmPassword}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive" role="alert">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {errors.root.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Resetting…
          </>
        ) : (
          'Reset password'
        )}
      </Button>

      <Link
        href="/forgot-password"
        className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Request a new OTP
      </Link>
    </form>
  );
}
