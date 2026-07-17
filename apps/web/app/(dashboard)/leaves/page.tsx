import type { Metadata } from 'next';

import { LeavesClient } from '@/components/leaves/leaves-client';

export const metadata: Metadata = {
  title: 'Leaves',
};

export default function LeavesPage() {
  return <LeavesClient />;
}
