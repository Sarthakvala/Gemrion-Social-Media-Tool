import { createAdminClient } from '@/lib/supabase/admin';
import { StatusPill } from '@/components/ui';
import { TargetsPanel, type ChannelOption } from './TargetsPanel';
import { listChannels } from '@/lib/publishing/channels';
import { network } from '@/lib/publishing/networks';
import { bodyFor } from '@/lib/publishing/plan';
import { composeText } from '@/lib/publishing/text';
import { cancelTarget, retryTarget } from '@/app/console/posts/targets-actions';
import type { Post } from '@/lib/types';

interface TargetRow {
  id: string;
  channel_id: string;
  text: string;
  settings: { firstComment?: string };
  status: string;
  scheduled_at: string | null;
  external_url: string | null;
  error: string | null;
  attempts: number;
}

/** Server part of the composer: loads channels and targets (agency-only tables) and renders status. Caller must have run requireAgency(). */
export async function PublishingPanel({ post }: { post: Post }) {
  const admin = createAdminClient();
  const [channels, { data: targets }, { data: signature }] = await Promise.all([
    listChannels(admin, post.client_id),
    admin.from('post_targets').select('id, channel_id, text, settings, status, scheduled_at, external_url, error, attempts').eq('post_id', post.id),
    admin.from('signatures').select('body').eq('client_id', post.client_id).eq('is_default', true).maybeSingle(),
  ]);
  const rows = (targets ?? []) as TargetRow[];
  const byChannel = new Map(rows.map((t) => [t.channel_id, t]));
  const active = channels.filter((c) => c.status === 'active');

  const options: ChannelOption[] = active.map((c) => {
    const t = byChannel.get(c.id);
    return {
      id: c.id,
      network: c.network,
      name: c.name,
      handle: c.handle,
      defaultText: composeText({ body: bodyFor(c.network, post), signature: (signature?.body as string) ?? '', hashtags: post.hashtags }),
      target: t ? { text: t.text, firstComment: t.settings?.firstComment ?? '', status: t.status } : null,
    };
  });
  const imageCount = (post.slides_content ?? []).length || (post.image_url ? 1 : 0);
  const names = new Map(channels.map((c) => [c.id, `${c.name} · ${network(c.network).name}`]));

  return (
    <div className="panel p-4 mt-4 flex flex-col gap-4">
      <div>
        <span className="lbl">Publishing</span>
        <p className="text-[13px] text-muted mt-1">
          Choose channels and when. Posts go out only after client approval
          {post.approval === 'approved' ? ' (approved).' : ` (currently: ${post.approval.replace('_', ' ')}).`}
        </p>
      </div>

      <TargetsPanel postId={post.id} clientId={post.client_id} channels={options} imageCount={imageCount} videoCount={post.video_url ? 1 : 0} hasPostTime={!!post.scheduled_at} />

      {rows.length > 0 && (
        <div className="border-t border-line pt-3 flex flex-col gap-2">
          <span className="lbl">Status</span>
          {rows.map((t) => (
            <div key={t.id} className="flex items-center gap-2 flex-wrap text-[13px]">
              <StatusPill value={t.status} />
              <span className="truncate">{names.get(t.channel_id) ?? 'removed channel'}</span>
              {t.scheduled_at && t.status === 'scheduled' && <span className="mono text-faint">{new Date(t.scheduled_at).toLocaleString()}</span>}
              {t.external_url && (
                <a href={t.external_url} target="_blank" rel="noopener noreferrer" className="underline">
                  view post
                </a>
              )}
              {t.error && <span className="mono text-failed break-words basis-full">{t.error}</span>}
              <span className="ml-auto flex gap-1">
                {(t.status === 'scheduled' || t.status === 'draft') && (
                  <form action={cancelTarget}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-ghost btn-sm">Cancel</button>
                  </form>
                )}
                {(t.status === 'failed' || t.status === 'canceled') && (
                  <form action={retryTarget}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-ghost btn-sm">{t.status === 'failed' ? 'Retry now' : 'Reschedule now'}</button>
                  </form>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
