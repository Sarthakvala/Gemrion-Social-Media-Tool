'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Approval } from '@/lib/types';

/**
 * Client-side approve / request changes. Runs as the signed-in client, so the
 * column grant (approval only) and RLS are what enforce it; the database
 * trigger stamps who decided and when.
 */
export function AssetReview({ assetId, approval }: { assetId: string; approval: Approval }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function decide(next: Approval) {
    setBusy(true);
    setErr('');
    const { error } = await createClient().from('assets').update({ approval: next }).eq('id', assetId);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="btn btn-sm" onClick={() => decide('approved')} disabled={busy || approval === 'approved'}>
        Approve
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => decide('changes_requested')} disabled={busy || approval === 'changes_requested'}>
        Request changes
      </button>
      {err && <span className="mono text-failed">{err}</span>}
    </div>
  );
}
