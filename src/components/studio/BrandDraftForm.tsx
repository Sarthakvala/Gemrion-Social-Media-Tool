'use client';

import { useActionState } from 'react';
import { draftBrandWithAi, type DraftResult } from '@/app/console/clients/[id]/brand/actions';

export function BrandDraftForm({ clientId, hasKit }: { clientId: string; hasKit: boolean }) {
  const [state, action, pending] = useActionState<DraftResult | null, FormData>(draftBrandWithAi, null);

  return (
    <form
      action={action}
      className="panel p-4 mb-4"
      onSubmit={(e) => {
        if (hasKit && !confirm('Replace the current kit text with an AI draft? Logo and handle are kept.')) e.preventDefault();
      }}
    >
      <input type="hidden" name="client_id" value={clientId} />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <span className="lbl">Draft the kit with AI</span>
          <p className="text-[13px] text-muted mt-0.5">
            Reads their website and your notes, then fills voice, audience, pillars, rules, hashtags and look. You review and save.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-[1fr_1.4fr] gap-3">
        <input name="url" placeholder="Website, e.g. gemrion.com" aria-label="Website" />
        <textarea name="notes" rows={2} placeholder="Anything else: offers, clients, results, what they hate sounding like…" aria-label="Notes" />
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Reading and drafting… (about 30s)' : 'Draft brand kit'}
        </button>
        {state && !pending && (
          <span className={`mono ${state.ok ? 'text-published' : 'text-failed'}`}>{state.message}</span>
        )}
      </div>
      {state?.ok && state.toConfirm.length > 0 && (
        <div className="mt-3 border-l-[3px] border-l-changes pl-3">
          <span className="lbl">Please confirm</span>
          <ul className="text-[13px] mt-1 list-disc pl-4">
            {state.toConfirm.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
