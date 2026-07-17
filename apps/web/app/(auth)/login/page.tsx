import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your School ERP account',
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        {/* <h1 className="text-3xl font-bold tracking-tight">School ERP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your account to continue
        </p> */}
      </div>
      <LoginForm />
    </div>
  );
}
