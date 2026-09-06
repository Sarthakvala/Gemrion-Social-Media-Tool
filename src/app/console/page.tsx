import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { StatusPill, PlatformTags, Thumb, formatSlot, EmptyState } from '@/components/ui';
import type { Post, Client } from '@/lib/types';

type PostRow = Post & { clients: Pick<Client, 'name' | 'color'> | null };

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const profile = await requireAgency();
  const { client: clientFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: posts }] = await Promise.all([
    supabase.from('clients').select('id, name, color, created_at').order('name'),
    supabase
      .from('posts')
      .select('*, clients(name, color)')
      .order('scheduled_at', { ascending: true, nullsFirst: false }),
  ]);

  const allPosts = (posts ?? []) as PostRow[];
  const visible = clientFilter
    ? allPosts.filter((p) => p.client_id === clientFilter)
    : allPosts;

  const counts = {
    total: allPosts.length,
    scheduled: allPosts.filter((p) => p.status === 'scheduled').length,
    published: allPosts.filter((p) => p.status === 'published').length,
    needsReview: allPosts.filter((p) => p.approval === 'changes_requested').length,
    disabled: allPosts.filter((p) => !p.enabled).length,
  };

  return (
    <Shell
      profile={profile}
      nav={[
        { href: '/console', label: 'Posts', active: true },
        { href: '/console/calendar', label: 'Calendar' },
        { href: '/console/clients', label: 'Clients' },
      ]}
    >
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Posts</h1>
          <p className="mono text-muted mt-1">
            {counts.total} total · {counts.scheduled} scheduled ·{' '}
            {counts.published} published
            {counts.needsReview > 0 && (
              <span className="text-changes">
                {' '}· {counts.needsReview} need changes
              </span>
            )}
            {counts.disabled > 0 && (
              <span className="text-failed"> · {counts.disabled} disabled</span>
            )}
          </p>
        </div>
        <Link href="/console/posts/new" className="btn btn-accent">
          New post
        </Link>
      </div>

      {/* client filter */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <Link
          href="/console"
          className={`px-2.5 py-1 rounded-full text-[12.5px] border ${
            !clientFilter
              ? 'border-ink bg-ink text-white'
              : 'border-line-2 text-ink-2 bg-panel hover:border-ink'
          }`}
        >
          All clients
        </Link>
        {((clients ?? []) as Client[]).map((c) => (
          <Link
            key={c.id}
            href={`/console?client=${c.id}`}
            className={`px-2.5 py-1 rounded-full text-[12.5px] border flex items-center gap-1.5 ${
              clientFilter === c.id
                ? 'border-ink bg-ink text-white'
                : 'border-line-2 text-ink-2 bg-panel hover:border-ink'
            }`}
          >
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: c.color }}
            />
            {c.name}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No posts here yet"
          hint="Create one, or pick a different client."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/console/posts/${p.id}`}
              className={`panel p-3 flex gap-3.5 items-start hover:border-line-2 transition ${
                !p.enabled ? 'gate-off' : ''
              }`}
            >
              <Thumb post={p} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="mono text-[10px] px-1.5 py-[1px] rounded"
                    style={{
                      background: (p.clients?.color ?? '#e4e4e7') + '22',
                      color: p.clients?.color ?? '#71717a',
                    }}
                  >
                    {p.clients?.name ?? 'unknown'}
                  </span>
                  <StatusPill value={p.status} />
                  {p.approval !== 'pending' && <StatusPill value={p.approval} />}
                  {!p.enabled && (
                    <span className="pill pill-failed">will not publish</span>
                  )}
                </div>

                <h3 className="font-medium mt-1.5 truncate">
                  {p.title || 'Untitled post'}
                </h3>
                <p className="text-muted text-[13px] mt-0.5 line-clamp-2">
                  {p.caption || p.copy || 'No copy yet.'}
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <span className="mono text-faint">{formatSlot(p.scheduled_at)}</span>
                  <PlatformTags platforms={p.platforms} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
