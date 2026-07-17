import type { Metadata } from 'next';

import { AcademicSetupClient } from '@/components/academic/academic-setup-client';

export const metadata: Metadata = {
  title: 'Academic Setup',
};

export default function AcademicPage() {
  return <AcademicSetupClient />;
}
