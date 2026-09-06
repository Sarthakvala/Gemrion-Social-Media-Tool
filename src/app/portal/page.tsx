import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { StatusPill, PlatformTags, Thumb, formatSlot, EmptyState } from '@/components/ui';
import type { Post, Client } from '@/lib/types';

type PostRow = Post & { clients: Pick<Client, 'name' | 'color'> | null };

export default async function PortalPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  // RLS scopes this to the client's own workspaces. No filtering in app code.
  const { data: posts } = await supabase
    .from('posts')
    .select('*, clients(name, color)')
    .order('scheduled_at', { ascending: true, nullsFirst: false });

  const rows = (posts ?? []) as PostRow[];
  const awaiting = rows.filter(
    (p) => p.approval === 'pending' && p.status !== 'published'
  );

  return (
    <Shell
      profile={profile}
      nav={[
        { href: '/portal', label: 'Your posts', active: true },
        { href: '/portal/calendar', label: 'Calendar' },
      ]}
    >
      <h1 className="text-[22px] font-semibold tracking-tight">Your posts</h1>
      <p className="text-muted text-[13.5px] mt-1 mb-5">
        Review what is scheduled, edit the wording, and tell us when it is good to go.
      </p>

      {awaiting.length > 0 && (
        <div className="panel p-3.5 mb-5 border-l-[3px] border-l-accent">
          <span className="lbl">Waiting on you</span>
          <p className="text-[13.5px] mt-1">
            {awaiting.length} post{awaiting.length > 1 ? 's' : ''} need
            {awaiting.length > 1 ? '' : 's'} your review.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing scheduled yet"
          hint="Your agency has not shared any posts with this account."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/portal/posts/${p.id}`}
              className="panel p-3 flex gap-3.5 items-start hover:border-line-2 transition"
            >
              <Thumb post={p} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill value={p.status} />
                  <StatusPill value={p.approval} />
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
