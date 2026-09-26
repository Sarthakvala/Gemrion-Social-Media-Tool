'use client';

import { useActionState } from 'react';
import { regeneratePost, type ActionResult } from '@/app/console/studio/actions';

export function RegenerateForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(regeneratePost, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={postId} />
      <textarea
        name="note"
        rows={2}
        placeholder="What should change? e.g. shorter hook, more specific, add the Diwali offer"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" className="btn btn-ghost" disabled={pending}>
          {pending ? 'Rewriting…' : 'Rewrite with AI'}
        </button>
        {state && !pending && (
          <span className={`mono ${state.ok ? 'text-published' : 'text-failed'}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
