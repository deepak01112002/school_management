import type { Metadata } from 'next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Timetable',
};

export default function TimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground">
          Build weekly schedules after academic structure is ready.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timetable builder pending</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Timetable setup depends on classes, sections, subjects, and teacher assignments.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
