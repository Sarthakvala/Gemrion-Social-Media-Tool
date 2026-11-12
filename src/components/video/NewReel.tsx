'use client';

import { useActionState } from 'react';
import { createBlankReel, createReelFromIdea, type ReelActionResult } from '@/app/console/video/actions';
import { REEL_ASPECTS } from '@/lib/video/timing';
import type { PlaybookField } from '@/lib/playbooks/types';

const ASPECT_LABEL: Record<string, string> = { '9:16': '9:16 reel / short', '4:5': '4:5 feed', '1:1': '1:1 square' };

function BrandAndAspect({ clients }: { clients: { id: string; name: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1">
        <span className="mono text-faint">Brand</span>
        <select name="client_id" required defaultValue={clients[0]?.id}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="mono text-faint">Format</span>
        <select name="aspect" defaultValue="9:16">
          {REEL_ASPECTS.map((a) => (
            <option key={a} value={a}>
              {ASPECT_LABEL[a]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Two ways to start a reel: script it with AI from an idea, or start from a blank template. */
export function NewReel({ clients, fields }: { clients: { id: string; name: string }[]; fields: readonly PlaybookField[] }) {
  const [state, action, pending] = useActionState<ReelActionResult | null, FormData>(createReelFromIdea, null);

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_300px] gap-4">
      <form action={action} className="panel p-4 flex flex-col gap-3">
        <div>
          <span className="lbl">New reel from an idea</span>
          <p className="text-muted text-[13px] mt-1">Writes the script with the reel-scripter method on the brand kit, then opens the editor. One AI run.</p>
        </div>
        <BrandAndAspect clients={clients} />
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="mono text-faint">{f.label}</span>
            {f.kind === 'textarea' ? (
              <textarea name={f.name} rows={3} required={f.required} maxLength={f.max} />
            ) : f.kind === 'select' ? (
              <select name={f.name} defaultValue={f.options?.[0]}>
                {f.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input name={f.name} required={f.required} maxLength={f.max} />
            )}
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button className="btn btn-accent btn-sm" disabled={pending}>
            {pending ? 'Writing the script…' : 'Write script'}
          </button>
          {state && !state.ok && <span className="mono text-failed">{state.message}</span>}
        </div>
      </form>

      <form action={createBlankReel} className="panel p-4 flex flex-col gap-3 self-start">
        <div>
          <span className="lbl">Or start blank</span>
          <p className="text-muted text-[13px] mt-1">A five-beat template in the brand look. No AI cost.</p>
        </div>
        <BrandAndAspect clients={clients} />
        <input name="title" placeholder="Title" maxLength={120} />
        <button className="btn btn-sm self-start">Create blank reel</button>
      </form>
    </div>
  );
}
