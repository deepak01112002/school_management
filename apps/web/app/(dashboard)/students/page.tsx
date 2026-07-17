import type { Metadata } from 'next';

import { StudentsClient } from '@/components/students/students-client';

export const metadata: Metadata = {
  title: 'Students',
};

export default function StudentsPage() {
  return <StudentsClient />;
}
