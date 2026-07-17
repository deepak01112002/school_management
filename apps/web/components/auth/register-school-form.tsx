'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const registerSchema = z
  .object({
    schoolName: z.string().min(2, 'School name is required'),
    subdomain: z
      .string()
      .min(3, 'School code must be at least 3 characters')
      .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and dashes only'),
    ownerFirstName: z.string().min(2, 'First name is required'),
    ownerLastName: z.string().min(2, 'Last name is required'),
    ownerEmail: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
        'Use uppercase, a number, and a special character',
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

interface LoginResponse {
  success: boolean;
  data: {
    accessToken?: string;
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

export function RegisterSchoolForm() {
  const router = useRouter();
  const { setAccessToken, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      subdomain: '',
      schoolName: '',
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsLoading(true);
    try {
      await api.post('/onboarding/register', {
        subdomain: values.subdomain,
        schoolName: values.schoolName,
        ownerFirstName: values.ownerFirstName,
        ownerLastName: values.ownerLastName,
        ownerEmail: values.ownerEmail,
        phone: values.phone || undefined,
        password: values.password,
      });

      const login = await api.post<LoginResponse>(
        '/auth/login',
        {
          email: values.ownerEmail,
          password: values.password,
        },
        { headers: { 'X-Tenant-Subdomain': values.subdomain } },
      );

      const payload = login.data.data;
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
          ?.response?.data?.error?.message ??
        'Could not create the school trial';
      setError('root', { message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 rounded-xl border bg-card p-8 shadow-sm"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School name" error={errors.schoolName?.message}>
          <Input disabled={isLoading} {...register('schoolName')} />
        </Field>
        <Field label="School code" error={errors.subdomain?.message}>
          <Input
            disabled={isLoading}
            placeholder="greenwood"
            {...register('subdomain')}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner first name" error={errors.ownerFirstName?.message}>
          <Input disabled={isLoading} autoComplete="given-name" {...register('ownerFirstName')} />
        </Field>
        <Field label="Owner last name" error={errors.ownerLastName?.message}>
          <Input disabled={isLoading} autoComplete="family-name" {...register('ownerLastName')} />
        </Field>
      </div>

      <Field label="Owner email" error={errors.ownerEmail?.message}>
        <Input
          type="email"
          disabled={isLoading}
          autoComplete="email"
          placeholder="owner@school.edu"
          {...register('ownerEmail')}
        />
      </Field>

      <Field label="Phone" error={errors.phone?.message}>
        <Input disabled={isLoading} autoComplete="tel" {...register('phone')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" error={errors.password?.message}>
          <Input
            type="password"
            disabled={isLoading}
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}>
          <Input
            type="password"
            disabled={isLoading}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </Field>
      </div>

      {errors.root ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isLoading} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Creating trial...
          </>
        ) : (
          'Create school trial'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
