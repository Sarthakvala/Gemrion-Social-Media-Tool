'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Post, Approval } from '@/lib/types';

/**
 * Client-side post editor for the portal.
 *
 * Writes go through the user's own Supabase session, so the database decides
 * what is allowed: RLS limits the rows, and the column GRANTs limit the fields
 * to caption / copy / hashtags / approval. If this component tried to write
 * anything else, Postgres would reject it.
 */
export function PostEditor({ post }: { post: Post }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [caption, setCaption] = useState(post.caption);
  const [copy, setCopy] = useState(post.copy);
  const [hashtags, setHashtags] = useState(post.hashtags);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  const dirty =
    caption !== post.caption || copy !== post.copy || hashtags !== post.hashtags;

  async function save(extra?: { approval: Approval }) {
    setSaving(true);
    setNote('');
    const supabase = createClient();

    const { error } = await supabase
      .from('posts')
      .update({ caption, copy, hashtags, ...(extra ?? {}) })
      .eq('id', post.id);

    setSaving(false);

    if (error) {
      setNote(error.message);
      return;
    }
    setNote(extra ? 'Sent to your agency.' : 'Saved.');
    startTransition(() => router.refresh());
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="lbl">Your edits</span>
        <span className="mono text-faint">
          you can change the wording, not the schedule
        </span>
      </div>

      <label className="lbl block mb-1" htmlFor="copy">
        Primary text
      </label>
      <textarea
        id="copy"
        rows={5}
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
        placeholder="Hook, offer, call to action…"
      />

      <label className="lbl block mb-1 mt-3.5" htmlFor="caption">
        Caption
      </label>
      <textarea
        id="caption"
        rows={3}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Short caption…"
      />

      <label className="lbl block mb-1 mt-3.5" htmlFor="hashtags">
        Hashtags
      </label>
      <input
        id="hashtags"
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        placeholder="#brand #launch"
      />

      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3.5 border-t border-line">
        <button
          className="btn btn-ghost"
          onClick={() => save()}
          disabled={saving || !dirty}
        >
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>

        <button
          className="btn btn-accent"
          onClick={() => save({ approval: 'approved' })}
          disabled={saving}
        >
          Approve
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => save({ approval: 'changes_requested' })}
          disabled={saving}
        >
          Request changes
        </button>

        {note && <span className="mono text-muted ml-1">{note}</span>}
      </div>
    </div>
  );
}
