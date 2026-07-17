import type { Metadata } from 'next';

import { AcademicSetupClient } from '@/components/academic/academic-setup-client';

export const metadata: Metadata = {
  title: 'Classes',
};

export default function ClassesPage() {
  return <AcademicSetupClient />;
}
