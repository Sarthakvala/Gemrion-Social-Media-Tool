import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { PostEditor } from '@/components/PostEditor';
import { Comments } from '@/components/Comments';
import { StatusPill, PlatformTags, formatSlot } from '@/components/ui';
import type { Post, PostComment } from '@/lib/types';

export default async function PortalPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireUser();
  const supabase = await createClient();

  // RLS returns nothing if this post is not theirs, so a wrong id 404s.
  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!post) notFound();
  const p = post as Post;

  const { data: comments } = await supabase
    .from('post_comments')
    .select('*, profiles(email)')
    .eq('post_id', id)
    .order('created_at');

  const slides = p.slides?.length ? p.slides : p.image_url ? [p.image_url] : [];

  return (
    <Shell
      profile={profile}
      nav={[
        { href: '/portal', label: 'Your posts' },
        { href: '/portal/calendar', label: 'Calendar' },
      ]}
    >
      <Link href="/portal" className="mono text-muted hover:text-ink">
        ← back to posts
      </Link>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <StatusPill value={p.status} />
        <StatusPill value={p.approval} />
        <span className="mono text-faint">{formatSlot(p.scheduled_at)}</span>
        <PlatformTags platforms={p.platforms} />
      </div>

      <h1 className="text-[22px] font-semibold tracking-tight mt-2 mb-5">
        {p.title || 'Untitled post'}
      </h1>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <PostEditor post={p} />
          <Comments
            postId={p.id}
            userId={profile.id}
            comments={(comments ?? []) as PostComment[]}
          />
        </div>

        {/* creative preview - read only for clients */}
        <div className="panel p-4">
          <span className="lbl">Creative</span>
          {slides.length === 0 ? (
            <div className="mt-3 aspect-[4/5] grid place-items-center rounded-lg border border-dashed border-line-2 mono text-faint">
              no creative yet
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {slides.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`Slide ${i + 1}`}
                  className="w-full rounded-lg border border-line"
                />
              ))}
            </div>
          )}
          {p.video_url && (
            <video
              src={p.video_url}
              controls
              className="w-full rounded-lg border border-line mt-2"
            />
          )}
          <p className="mono text-faint mt-3 leading-relaxed">
            Creative and scheduling are set by your agency. Ask in the notes if
            you want something changed.
          </p>
        </div>
      </div>
    </Shell>
  );
}
