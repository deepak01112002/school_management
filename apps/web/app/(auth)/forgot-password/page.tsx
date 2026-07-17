'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Metadata } from 'next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch {
      setError('root', { message: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          If an account exists with that email, we&apos;ve sent a 6-digit OTP. It expires in 10 minutes.
        </p>
        <Link href="/reset-password">
          <Button variant="outline" className="w-full">Enter OTP →</Button>
        </Link>
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
        <h2 className="text-xl font-semibold">Forgot password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we&apos;ll send a one-time code.
        </p>
      </div>

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
          <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>
        )}
      </div>

      {errors.root && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isLoading} size="lg">
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : 'Send OTP'}
      </Button>

      <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to login
      </Link>
    </form>
  );
}
