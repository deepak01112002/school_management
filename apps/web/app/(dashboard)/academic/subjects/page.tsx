import type { Metadata } from 'next';

import { SubjectsClient } from '@/components/academic/subjects-client';

export const metadata: Metadata = {
  title: 'Subjects',
};

export default function SubjectsPage() {
  return <SubjectsClient />;
}
