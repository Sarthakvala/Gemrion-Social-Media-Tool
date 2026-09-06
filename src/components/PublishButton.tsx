'use client';

import { useState } from 'react';

export function PublishButton({ postId }: { postId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    results: string[];
  } | null>(null);

  async function publish() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResult({ ok: false, results: [j.error || 'Publish failed'] });
      } else {
        setResult(j);
      }
    } catch (e) {
      setResult({
        ok: false,
        results: [e instanceof Error ? e.message : 'Network error'],
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={publish}
        disabled={busy}
        className="btn btn-accent"
      >
        {busy ? 'Publishing...' : 'Publish now'}
      </button>

      {result && (
        <div
          className={`panel p-3 mt-2 border-l-[3px] ${
            result.ok ? 'border-l-published' : 'border-l-failed'
          }`}
        >
          <span className="lbl">{result.ok ? 'Published' : 'Publish failed'}</span>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {result.results.map((r, i) => (
              <li key={i} className="mono text-[11px] text-ink-2">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
