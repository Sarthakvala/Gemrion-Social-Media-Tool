'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PostComment } from '@/lib/types';

export function Comments({
  postId,
  userId,
  comments,
}: {
  postId: string;
  userId: string;
  comments: (PostComment & { profiles?: { email: string | null } | null })[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function add() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr('');

    const supabase = createClient();
    const { error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: userId, body: text });

    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setBody('');
    startTransition(() => router.refresh());
  }

  return (
    <div className="panel p-4">
      <span className="lbl">Notes</span>

      <div className="flex flex-col gap-2.5 mt-3">
        {comments.length === 0 && (
          <p className="text-muted text-[13px]">
            No notes yet. Anything you write here goes to your agency.
          </p>
        )}
        {comments.map((c) => (
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

      <div className="mt-3.5 pt-3.5 border-t border-line">
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
        />
        <button
          className="btn btn-ghost btn-sm mt-2"
          onClick={add}
          disabled={busy || !body.trim()}
        >
          {busy ? 'Posting…' : 'Add note'}
        </button>
        {err && <span className="mono text-failed ml-2">{err}</span>}
      </div>
    </div>
  );
}
