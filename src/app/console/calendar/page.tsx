import { requireAgency } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { Calendar, monthFromParam } from '@/components/Calendar';
import type { Post, Client } from '@/lib/types';

type PostRow = Post & { clients: Pick<Client, 'name' | 'color'> | null };

export default async function ConsoleCalendar({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const profile = await requireAgency();
  const { m } = await searchParams;
  const month = monthFromParam(m);

  const supabase = await createClient();
  const { data } = await supabase.from('posts').select('*, clients(name, color)');

  return (
    <Shell
      profile={profile}
      nav={[
        { href: '/console', label: 'Posts' },
        { href: '/console/calendar', label: 'Calendar', active: true },
        { href: '/console/clients', label: 'Clients' },
      ]}
    >
      <Calendar
        posts={(data ?? []) as PostRow[]}
        month={month}
        basePath="/console/calendar"
      />
    </Shell>
  );
}
