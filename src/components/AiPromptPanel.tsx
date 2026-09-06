'use client';

import { useState } from 'react';

/** The Moonli-Navy image prompt, 4:5 (1080x1350). */
function imagePrompt(title: string) {
  const t = title.trim() || 'EXACT HEADLINE, under 8 words';
  const words = t.split(' ').filter(Boolean);
  const gold = words.length >= 2 ? words.slice(-2).join(' ') : t;

  return `Create a 4:5 (1080x1350) editorial social post card in the Moonli-Navy visual style.
Canvas: Deep dark navy background (hex #0D1023) with a subtle inset rounded-corner card frame, clean 4:5 vertical (1080x1350) proportion.
Typography: Clean geometric DM Sans style lettering in soft warm cream (hex #F4F2EA), bold weight, tight letter spacing, left-aligned with generous margins:
"${t}"
Accent: Highlight the key phrase "${gold}" in rich muted gold (hex #C6A15A).
Footer: Small restrained gold (#C6A15A) logo mark at bottom left. Flat, editorial, zero gradient noise, no extra icons.`;
}

function captionPrompt(clientName: string, title: string, copy: string) {
  return `BRAND: ${clientName}, a founder-led business.
VOICE: Blunt, founder-to-founder, short sentences. Specific over impressive. No agency cliches, no em dashes, no rule-of-three.
Write a social post about: ${title || '[topic]'}${copy ? `\nContext: ${copy}` : ''}
Return: 1) LINKEDIN (3-5 short lines), 2) INSTAGRAM (2-3 punchy lines), 3) HASHTAGS (4-5 lowercase).`;
}

export function AiPromptPanel({
  title,
  copy,
  clientName,
}: {
  title: string;
  copy: string;
  clientName: string;
}) {
  const [tab, setTab] = useState<'image' | 'caption'>('caption');
  const [copied, setCopied] = useState('');
  const [gen, setGen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const text = tab === 'image' ? imagePrompt(title) : captionPrompt(clientName, title, copy);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tab);
      setTimeout(() => setCopied(''), 1400);
    } catch {
      setErr('Clipboard blocked. Select the text and copy manually.');
    }
  }

  async function generate() {
    setBusy(true);
    setErr('');
    setGen('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Generation failed');
      setGen(j.text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <span className="lbl">Generate with AI</span>
        <span className="mono text-faint ml-auto">4:5</span>
      </div>

      <div className="flex gap-1 mt-2.5">
        {(['caption', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded text-[12.5px] border ${
              tab === t
                ? 'border-ink bg-ink text-white'
                : 'border-line-2 text-ink-2 hover:border-ink'
            }`}
          >
            {t === 'caption' ? 'Caption' : 'Image'}
          </button>
        ))}
      </div>

      <textarea
        readOnly
        rows={9}
        value={text}
        className="mono mt-2.5 !text-[11px] leading-relaxed bg-canvas"
      />

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={copyText} className="btn btn-ghost btn-sm">
          {copied === tab ? 'Copied' : 'Copy prompt'}
        </button>
        {tab === 'caption' && (
          <button
            type="button"
            onClick={generate}
            className="btn btn-sm"
            disabled={busy}
          >
            {busy ? 'Generating…' : 'Generate here'}
          </button>
        )}
      </div>

      {err && (
        <p className="mono text-failed mt-2.5 leading-relaxed break-words">{err}</p>
      )}

      {gen && (
        <div className="mt-3">
          <span className="lbl">Result</span>
          <pre className="mono text-[11px] whitespace-pre-wrap bg-canvas border border-line rounded p-2.5 mt-1.5 max-h-64 overflow-auto">
            {gen}
          </pre>
        </div>
      )}

      <p className="mono text-faint mt-3 leading-relaxed">
        Image models garble exact text. Use the image prompt for the look, then
        set the headline in Canva or the renderer.
      </p>
    </div>
  );
}
