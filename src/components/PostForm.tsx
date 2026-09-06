import Link from 'next/link';
import { savePost, deletePost } from '@/app/console/posts/actions';
import { AiPromptPanel } from '@/components/AiPromptPanel';
import { PLATFORMS, PLATFORM_NAMES, type Post, type Client } from '@/lib/types';

/** Full agency editor. Plain form + server action, so it works without client JS. */
export function PostForm({
  post,
  clients,
}: {
  post: Partial<Post> | null;
  clients: Client[];
}) {
  const scheduled = post?.scheduled_at ? new Date(post.scheduled_at) : null;
  const date = scheduled ? scheduled.toISOString().slice(0, 10) : '';
  const time = scheduled ? scheduled.toISOString().slice(11, 16) : '10:00';
  const platforms = post?.platforms ?? ['IG', 'LI'];

  return (
    <form action={savePost} className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <input type="hidden" name="id" defaultValue={post?.id ?? ''} />

      <div className="panel p-4 flex flex-col gap-3.5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="lbl block mb-1" htmlFor="client_id">Client</label>
            <select id="client_id" name="client_id" defaultValue={post?.client_id ?? clients[0]?.id}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl block mb-1" htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={post?.title ?? ''} placeholder="Internal name" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="lbl block mb-1" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={date} />
          </div>
          <div>
            <label className="lbl block mb-1" htmlFor="time">Time</label>
            <input id="time" name="time" type="time" defaultValue={time} />
          </div>
        </div>

        <div>
          <span className="lbl block mb-1.5">Platforms</span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  name={`platform_${p}`}
                  defaultChecked={platforms.includes(p)}
                  className="w-auto"
                />
                {PLATFORM_NAMES[p]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="lbl block mb-1" htmlFor="copy">Primary text</label>
          <textarea id="copy" name="copy" rows={5} defaultValue={post?.copy ?? ''} placeholder="Hook, offer, CTA…" />
        </div>

        <div>
          <label className="lbl block mb-1" htmlFor="caption">Caption</label>
          <textarea id="caption" name="caption" rows={2} defaultValue={post?.caption ?? ''} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="lbl block mb-1" htmlFor="hashtags">Hashtags</label>
            <input id="hashtags" name="hashtags" defaultValue={post?.hashtags ?? ''} placeholder="#brand #launch" />
          </div>
          <div>
            <label className="lbl block mb-1" htmlFor="link">Link</label>
            <input id="link" name="link" defaultValue={post?.link ?? ''} placeholder="https://…" />
          </div>
        </div>

        <div>
          <label className="lbl block mb-1" htmlFor="image_url">Creative URL</label>
          <input id="image_url" name="image_url" defaultValue={post?.image_url ?? ''} placeholder="https://… (or upload to Supabase Storage)" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="lbl block mb-1" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={post?.status ?? 'scheduled'}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {/* the safety gate */}
        <div className={`p-3 rounded-lg border ${post?.enabled === false ? 'gate-off border-failed' : 'border-line'}`}>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={post?.enabled !== false}
              className="w-auto mt-0.5"
            />
            <span>
              <b className="text-[13.5px]">Enabled</b>
              <span className="block text-muted text-[12.5px] mt-0.5">
                The safety gate. Off means this never publishes, even if scheduled.
                Enforced on the server, not just here.
              </span>
            </span>
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn btn-accent">
            {post?.id ? 'Save post' : 'Create post'}
          </button>
          <Link href="/console" className="btn btn-ghost">Cancel</Link>
          {post?.id && (
            <button
              type="submit"
              formAction={deletePost}
              className="btn btn-ghost ml-auto text-failed border-failed/40"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <AiPromptPanel
        title={post?.title ?? ''}
        copy={post?.copy ?? ''}
        clientName={clients.find((c) => c.id === post?.client_id)?.name ?? clients[0]?.name ?? 'the brand'}
      />
    </form>
  );
}
