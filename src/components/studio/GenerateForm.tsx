'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generatePosts, type ActionResult } from '@/app/console/studio/actions';
import { PLATFORMS, PLATFORM_NAMES } from '@/lib/types';
import type { Client } from '@/lib/types';

type Mode = 'month' | 'brief';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function GenerateForm({
  clients,
  clientId,
  month,
  briefReady,
  aiReady,
}: {
  clients: Client[];
  clientId: string;
  month: string;
  briefReady: boolean;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('month');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(generatePosts, null);

  useEffect(() => {
    if (state?.ok && state.month) router.replace(`/console/studio?client=${clientId}&month=${state.month}`);
  }, [state, clientId, router]);

  function go(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.replace(`/console/studio?${params.toString()}`);
  }

  const start = today();

  return (
    <form action={action} className="panel p-5">
      <input type="hidden" name="mode" value={mode} />

      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-canvas border border-line w-fit" role="tablist">
        {(['month', 'brief'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-[13px] ${mode === m ? 'bg-panel border border-line-2 font-medium' : 'text-muted hover:text-ink'}`}
          >
            {m === 'month' ? 'Plan a month' : 'From a brief'}
          </button>
        ))}
      </div>

      <div className={`grid gap-3 ${mode === 'month' ? 'sm:grid-cols-[1fr_170px_110px]' : 'sm:grid-cols-[1fr_150px_150px_100px]'}`}>
        <div>
          <label className="lbl block mb-1.5" htmlFor="client_id">Brand</label>
          <select id="client_id" name="client_id" defaultValue={clientId} onChange={(e) => go('client', e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {mode === 'month' ? (
          <div>
            <label className="lbl block mb-1.5" htmlFor="month">Month</label>
            <input id="month" name="month" type="month" defaultValue={month} required onChange={(e) => e.target.value && go('month', e.target.value)} />
          </div>
        ) : (
          <>
            <div>
              <label className="lbl block mb-1.5" htmlFor="start">From</label>
              <input id="start" name="start" type="date" defaultValue={start} required />
            </div>
            <div>
              <label className="lbl block mb-1.5" htmlFor="end">To</label>
              <input id="end" name="end" type="date" defaultValue={plusDays(start, 13)} required />
            </div>
          </>
        )}

        <div>
          <label className="lbl block mb-1.5" htmlFor="count">Posts</label>
          <input key={mode} id="count" name="count" type="number" min={1} max={20} defaultValue={mode === 'month' ? 12 : 4} />
        </div>
      </div>

      <div className="mt-4">
        <span className="lbl block mb-1.5">Platforms</span>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line-2 bg-panel text-[13px] cursor-pointer has-[:checked]:border-ink">
              <input type="checkbox" name={`platform_${p}`} defaultChecked={p === 'IG' || p === 'LI'} />
              {PLATFORM_NAMES[p]}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="lbl block mb-1.5" htmlFor="brief">{mode === 'month' ? 'Brief for this month' : 'Campaign brief'}</label>
        <textarea
          key={mode}
          id="brief"
          name="brief"
          rows={mode === 'month' ? 3 : 5}
          required={mode === 'brief'}
          placeholder={
            mode === 'month'
              ? 'Launches, offers, festivals, events, results to feature… (optional)'
              : 'What is this campaign for? Offer, audience, key message, dates, proof, what the client wants people to do. e.g. "Diwali 20% off website redesigns for jewellers, ends 5 Nov, push DMs"'
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-line">
        <button type="submit" className="btn btn-accent" disabled={pending || !clientId || !aiReady}>
          {pending ? 'Planning and writing… (about a minute)' : mode === 'month' ? 'Generate month' : 'Generate campaign'}
        </button>
        {!aiReady && <a href="/console/settings" className="mono text-failed underline">Add an AI key in Settings first.</a>}
        {aiReady && !briefReady && !pending && (
          <span className="mono text-changes">Brand kit is empty. Fill or AI-draft it first for on-brand results.</span>
        )}
        {state && !pending && (
          <span className={`mono ${state.ok ? 'text-published' : 'text-failed'}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
