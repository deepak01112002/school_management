import type { Metadata } from 'next';

import { RegisterSchoolForm } from '@/components/auth/register-school-form';

export const metadata: Metadata = {
  title: 'Start Trial',
  description: 'Register your school for a School ERP trial',
};

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        {/* <h1 className="text-3xl font-bold tracking-tight">Start a school trial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create the school workspace and owner account.
        </p> */}
      </div>
      <RegisterSchoolForm />
    </div>
  );
}
