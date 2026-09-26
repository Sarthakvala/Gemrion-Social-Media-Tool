import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgency, getVisibleClients } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { PostForm } from '@/components/PostForm';
import { PublishButton } from '@/components/PublishButton';
import { StatusPill } from '@/components/ui';
import { SlidePreview } from '@/components/studio/SlidePreview';
import { CreativeEditor } from '@/components/studio/CreativeEditor';
import { RegenerateForm } from '@/components/studio/RegenerateForm';
import { DownloadPostButton } from '@/components/studio/DownloadButtons';
import { saveAsExample } from '@/app/console/studio/actions';
import { slideUrls, toZipPost } from '@/lib/studio/urls';
import type { Post, PostComment } from '@/lib/types';

// AI rewrite runs as a server action on this page
export const maxDuration = 120;

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireAgency();
  const supabase = await createClient();

  const [{ data: post }, clients] = await Promise.all([
    supabase.from('posts').select('*').eq('id', id).single(),
    getVisibleClients(),
  ]);

  if (!post) notFound();
  const p = post as Post;

  const { data: comments } = await supabase
    .from('post_comments')
    .select('*, profiles(email)')
    .eq('post_id', id)
    .order('created_at');

  const notes = (comments ?? []) as (PostComment & {
    profiles?: { email: string | null } | null;
  })[];

  return (
    <Shell
      profile={profile}
      nav={consoleNav('posts')}
    >
      <Link href="/console" className="mono text-muted hover:text-ink">
        ← back to posts
      </Link>

      <div className="flex items-center gap-2 flex-wrap mt-3 mb-1">
        <StatusPill value={p.status} />
        <StatusPill value={p.approval} />
        {!p.enabled && <span className="pill pill-failed">will not publish</span>}
      </div>

      <h1 className="text-[22px] font-semibold tracking-tight mb-5">
        {p.title || 'Untitled post'}
      </h1>

      {p.approval === 'changes_requested' && (
        <div className="panel p-3.5 mb-4 border-l-[3px] border-l-changes">
          <span className="lbl">Client requested changes</span>
          <p className="text-[13.5px] mt-1">
            Check the notes below for what they want changed.
          </p>
        </div>
      )}

      <div className="panel p-4 mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <span className="lbl">
            Preview{p.pillar ? ` · ${p.pillar}` : ''} · {p.format} {p.aspect}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <DownloadPostButton post={toZipPost(p)} className="btn btn-accent" />
            <form action={saveAsExample}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="btn btn-ghost" title="Adds this caption to the brand's examples so future posts follow it">
                Save as brand example
              </button>
            </form>
          </div>
        </div>
        <SlidePreview urls={slideUrls(p)} aspect={p.aspect} />
        {p.hook && <p className="text-[13.5px] mt-3"><span className="lbl mr-2">Hook</span>{p.hook}</p>}
        <div className="mt-4 pt-3.5 border-t border-line">
          <span className="lbl block mb-2">Not right? Rewrite it</span>
          <RegenerateForm postId={p.id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start mb-4">
        <CreativeEditor key={p.updated_at} post={p} />
        <PostForm post={p} clients={clients} />
      </div>

      {p.status !== 'published' && p.enabled && (
        <div className="panel p-4 mt-4">
          <span className="lbl">Manual publish</span>
          <p className="text-[13.5px] text-ink-2 mt-1.5 mb-2.5">
            Publish this post to all selected platforms right now.
          </p>
          <PublishButton postId={p.id} />
        </div>
      )}

      {notes.length > 0 && (
        <div className="panel p-4 mt-5">
          <span className="lbl">Client notes</span>
          <div className="flex flex-col gap-2.5 mt-3">
            {notes.map((c) => (
              <div key={c.id} className="border-l-2 border-line pl-3">
                <div className="mono text-faint">
                  {c.profiles?.email ?? 'someone'} ·{' '}
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <p className="text-[13.5px] mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
