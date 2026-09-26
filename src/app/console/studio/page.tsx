import Link from 'next/link';
import { requireAgency, getVisibleClients } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState, StatusPill, PlatformTags, formatSlot } from '@/components/ui';
import { GenerateForm } from '@/components/studio/GenerateForm';
import { DownloadMonthButton } from '@/components/studio/DownloadButtons';
import { daysInMonth, monthName } from '@/lib/studio/prompt';
import { slideUrls, toZipPost, ASPECT_CLASS } from '@/lib/studio/urls';
import type { Post } from '@/lib/types';
import { resolveAi } from '@/lib/ai/settings';

// generation runs as a server action on this page
export const maxDuration = 300;

function defaultMonth(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().slice(0, 7);
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; month?: string }>;
}) {
  const profile = await requireAgency();
  const params = await searchParams;
  const clients = await getVisibleClients();

  const clientId = clients.find((c) => c.id === params.client)?.id ?? clients[0]?.id ?? '';
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : defaultMonth();
  const [year, mon] = month.split('-').map(Number);
  const client = clients.find((c) => c.id === clientId);

  const supabase = await createClient();
  const from = new Date(Date.UTC(year, mon - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, mon - 1, daysInMonth(year, mon) + 1)).toISOString();

  const [{ data: posts }, { data: brandRow }, { count: exampleCount }] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('client_id', clientId)
      .gte('scheduled_at', from)
      .lt('scheduled_at', to)
      .order('scheduled_at'),
    supabase.from('brand_profiles').select('voice, audience').eq('client_id', clientId).maybeSingle(),
    supabase.from('brand_examples').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ]);

  const monthPosts = (posts ?? []) as Post[];
  const aiReady = !!(await resolveAi());
  const briefReady = !!(brandRow?.voice || brandRow?.audience || exampleCount);

  return (
    <Shell profile={profile} nav={consoleNav('studio')}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Studio</h1>
          <p className="text-muted mt-1 text-[13.5px]">
            Generate a month of on-brand posts, review them, download and post.
          </p>
        </div>
        {client && (
          <Link href={`/console/clients/${client.id}/brand`} className="btn btn-ghost">
            Edit {client.name} brand kit
          </Link>
        )}
      </div>

      {clients.length === 0 ? (
        <EmptyState title="No brands yet" hint="Add a brand under Brands, fill its kit, then come back." />
      ) : (
        <GenerateForm clients={clients} clientId={clientId} month={month} briefReady={briefReady} aiReady={aiReady} />
      )}

      {client && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight">
                {client.name} · {monthName(year, mon)}
              </h2>
              <p className="mono text-muted mt-0.5">
                {monthPosts.length} posts · {monthPosts.filter((p) => p.approval === 'approved').length} approved
              </p>
            </div>
            <DownloadMonthButton
              posts={monthPosts.map(toZipPost)}
              name={`${client.name}-${month}`}
            />
          </div>

          {monthPosts.length === 0 ? (
            <EmptyState title="Nothing planned this month" hint="Generate the month above, or pick another month." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {monthPosts.map((p) => {
                const cover = slideUrls(p)[0];
                return (
                  <Link key={p.id} href={`/console/posts/${p.id}`} className="panel overflow-hidden hover:border-line-2 transition flex flex-col">
                    <div className={`${ASPECT_CLASS[p.aspect] ?? 'aspect-[4/5]'} bg-canvas border-b border-line relative max-h-[320px] w-full`}>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center mono text-faint">no creative</span>
                      )}
                      {p.slides_content?.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 mono text-[10px] px-1.5 rounded bg-black/70 text-white">
                          {p.slides_content.length} slides
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="mono text-faint">{formatSlot(p.scheduled_at)}</span>
                        {p.approval !== 'pending' && <StatusPill value={p.approval} />}
                      </div>
                      <h3 className="font-medium text-[13.5px] leading-snug line-clamp-2">{p.title || 'Untitled'}</h3>
                      {p.pillar && <span className="mono text-muted truncate">{p.pillar}</span>}
                      <div className="mt-auto pt-1"><PlatformTags platforms={p.platforms} /></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}
    </Shell>
  );
}
