import { redirect } from 'next/navigation';

interface LegacyDashboardRoutePageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export default async function LegacyDashboardRoutePage({ params }: LegacyDashboardRoutePageProps) {
  const { slug } = await params;

  redirect(`/${slug.join('/')}`);
}
