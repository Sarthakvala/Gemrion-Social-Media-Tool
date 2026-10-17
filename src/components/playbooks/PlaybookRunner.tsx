'use client';

import { useActionState, useState } from 'react';
import { runPlaybook, type PlaybookRunResult } from '@/app/console/playbooks/actions';
import type { PlaybookField } from '@/lib/playbooks/types';

export interface RunnerPlaybook {
  id: string;
  title: string;
  summary: string;
  skill: string;
  fields: readonly PlaybookField[];
}

function Field({ field }: { field: PlaybookField }) {
  const common = { name: field.name, required: field.required, maxLength: field.max, placeholder: field.placeholder };
  if (field.kind === 'textarea') return <textarea rows={4} {...common} />;
  if (field.kind === 'select') {
    return (
      <select name={field.name} required={field.required} defaultValue={field.options?.[0]}>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return <input {...common} />;
}

/** Form generated from the playbook's field spec, plus the result with a copy button. */
export function PlaybookRunner({ playbook, clients, defaultClientId }: { playbook: RunnerPlaybook; clients: { id: string; name: string }[]; defaultClientId?: string }) {
  const [state, action, pending] = useActionState<PlaybookRunResult | null, FormData>(runPlaybook, null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state?.text) return;
    await navigator.clipboard.writeText(state.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="panel p-4 flex flex-col gap-3">
        <input type="hidden" name="playbook" value={playbook.id} />
        <div>
          <span className="lbl">{playbook.title}</span>
          <p className="text-muted text-[13px] mt-1">{playbook.summary}</p>
          <p className="mono text-faint mt-1">method from the {playbook.skill} skill · runs on the brand kit</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="mono text-faint">Brand</span>
          <select name="client_id" defaultValue={defaultClientId ?? clients[0]?.id} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {playbook.fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            <span className="mono text-faint">
              {f.label}
              {f.required ? '' : ' (optional)'}
            </span>
            <Field field={f} />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button className="btn btn-accent btn-sm" disabled={pending}>
            {pending ? 'Running…' : 'Run'}
          </button>
          {state && <span className={`mono ${state.ok ? 'text-faint' : 'text-failed'}`}>{state.message}</span>}
        </div>
      </form>

      {state?.ok && state.text && (
        <div className="panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="lbl">Result</span>
            <button className="btn btn-ghost btn-sm" onClick={copy} type="button">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-[13.5px] leading-relaxed font-sans">{state.text}</pre>
        </div>
      )}
    </div>
  );
}
