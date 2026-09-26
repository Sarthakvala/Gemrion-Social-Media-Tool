'use client';

import { useActionState, useState, useTransition } from 'react';
import { saveSettings, testConnection, type SettingsResult } from '@/app/console/settings/actions';
import type { AiSettingsView } from '@/lib/ai/settings';

function KeyStatus({ hint, fromEnv }: { hint: string; fromEnv: boolean }) {
  if (hint) return <span className="mono text-published">saved · {hint}</span>;
  if (fromEnv) return <span className="mono text-muted">using server env variable</span>;
  return <span className="mono text-faint">not set</span>;
}

export function SettingsForm({
  view,
  anthropicModels,
  openaiSuggestions,
}: {
  view: AiSettingsView;
  anthropicModels: { id: string; label: string }[];
  openaiSuggestions: string[];
}) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(saveSettings, null);
  const [test, setTest] = useState<SettingsResult | null>(null);
  const [testing, startTest] = useTransition();

  return (
    <form action={action} className="flex flex-col gap-4" autoComplete="off">
      <section className="panel p-4">
        <span className="lbl block mb-2">Generate with</span>
        <div className="flex flex-wrap gap-2">
          {([['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)']] as const).map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-line-2 bg-panel text-[13.5px] cursor-pointer has-[:checked]:border-ink">
              <input type="radio" name="provider" value={id} defaultChecked={view.provider === id} />
              {label}
            </label>
          ))}
        </div>
        <p className="mono text-faint mt-2">If the chosen provider has no key, the other one is used.</p>
      </section>

      <section className="panel p-4 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="lbl">Anthropic</span>
          <KeyStatus hint={view.anthropicHint} fromEnv={view.anthropicFromEnv} />
        </div>
        <div className="grid sm:grid-cols-[1.4fr_1fr] gap-3">
          <div>
            <label className="lbl block mb-1" htmlFor="anthropic_key">API key</label>
            <input id="anthropic_key" name="anthropic_key" type="password" placeholder={view.anthropicHint ? 'Leave blank to keep the saved key' : 'sk-ant-…'} autoComplete="off" spellCheck={false} />
          </div>
          <div>
            <label className="lbl block mb-1" htmlFor="anthropic_model">Model</label>
            <select id="anthropic_model" name="anthropic_model" defaultValue={view.anthropicModel}>
              {anthropicModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        {view.anthropicHint && (
          <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="clear_anthropic" /> Remove saved key</label>
        )}
        <p className="mono text-faint">Get one at console.anthropic.com → API keys.</p>
      </section>

      <section className="panel p-4 grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="lbl">OpenAI</span>
          <KeyStatus hint={view.openaiHint} fromEnv={view.openaiFromEnv} />
        </div>
        <div className="grid sm:grid-cols-[1.4fr_1fr] gap-3">
          <div>
            <label className="lbl block mb-1" htmlFor="openai_key">API key</label>
            <input id="openai_key" name="openai_key" type="password" placeholder={view.openaiHint ? 'Leave blank to keep the saved key' : 'sk-…'} autoComplete="off" spellCheck={false} />
          </div>
          <div>
            <label className="lbl block mb-1" htmlFor="openai_model">Model</label>
            <input id="openai_model" name="openai_model" list="openai-models" defaultValue={view.openaiModel} />
            <datalist id="openai-models">
              {openaiSuggestions.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
        </div>
        {view.openaiHint && (
          <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name="clear_openai" /> Remove saved key</label>
        )}
        <p className="mono text-faint">Get one at platform.openai.com → API keys. A ChatGPT subscription is not an API key.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={testing}
          onClick={() => startTest(async () => setTest(await testConnection()))}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {state && !pending && <span className={`mono ${state.ok ? 'text-published' : 'text-failed'}`}>{state.message}</span>}
        {test && !testing && <span className={`mono ${test.ok ? 'text-published' : 'text-failed'}`}>{test.message}</span>}
      </div>
    </form>
  );
}
