'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveReel } from '@/app/console/video/actions';
import { BEAT_KINDS, type ReelSpec } from '@/lib/video/spec';
import { MAX_BEAT_SECONDS, MAX_REEL_SECONDS, MIN_BEAT_SECONDS, REEL_ASPECTS, headingFontSize, reelDimensions, totalSeconds } from '@/lib/video/timing';

type Draft = { kind: string; heading: string; sub: string; seconds: number };

const MAX_BEATS = 12;
const PREVIEW_WIDTH = 168;

/** Still of one beat at thumbnail size, using the same colours and type scale as the renderer. */
function BeatThumb({ beat, spec, aspect }: { beat: Draft; spec: ReelSpec; aspect: ReelSpec['aspect'] }) {
  const { width, height } = reelDimensions(aspect);
  const k = PREVIEW_WIDTH / width;
  const isCta = beat.kind === 'cta';
  const isStat = beat.kind === 'stat';
  const size = headingFontSize(beat.heading.length, aspect, beat.kind === 'hook') * (isStat ? 1.6 : 1);
  return (
    <div
      style={{
        width: PREVIEW_WIDTH,
        height: height * k,
        background: isCta ? spec.brand.accent : spec.brand.bg,
        padding: 96 * k,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: beat.kind === 'point' ? 'flex-end' : 'center',
        fontFamily: `"${spec.brand.headingFont}", Arial, sans-serif`,
      }}
      className="rounded-md shrink-0 overflow-hidden"
    >
      <div style={{ width: 140 * k, height: 10 * k, background: isCta ? spec.brand.bg : spec.brand.accent, marginBottom: 40 * k }} />
      <div style={{ fontSize: size * k, fontWeight: 700, lineHeight: 1.05, color: isStat ? spec.brand.accent : isCta ? spec.brand.bg : spec.brand.fg }}>{beat.heading || ' '}</div>
      {beat.sub && <div style={{ fontSize: 44 * k, marginTop: 36 * k, color: isCta ? spec.brand.bg : spec.brand.muted }}>{beat.sub}</div>}
    </div>
  );
}

export function ReelEditor({ id, spec }: { id: string; spec: ReelSpec }) {
  const router = useRouter();
  const [title, setTitle] = useState(spec.title);
  const [aspect, setAspect] = useState(spec.aspect);
  const [beats, setBeats] = useState<Draft[]>(spec.beats.map((b) => ({ ...b })));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const seconds = totalSeconds(beats);
  const update = (i: number, patch: Partial<Draft>) => setBeats((all) => all.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, by: number) =>
    setBeats((all) => {
      const j = i + by;
      if (j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save() {
    startSaving(async () => {
      const r = await saveReel({ id, title, aspect, beats });
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="panel p-4 flex flex-col gap-4">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_180px] gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title" aria-label="Title" />
        <select value={aspect} onChange={(e) => setAspect(e.target.value as ReelSpec['aspect'])} aria-label="Format">
          {REEL_ASPECTS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>

      <ol className="flex flex-col gap-3">
        {beats.map((b, i) => (
          <li key={i} className="flex gap-3 border border-line rounded-lg p-3">
            <BeatThumb beat={b} spec={spec} aspect={aspect} />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-faint">{String(i + 1).padStart(2, '0')}</span>
                <select value={b.kind} onChange={(e) => update(i, { kind: e.target.value })} aria-label={`Beat ${i + 1} type`}>
                  {BEAT_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 mono text-faint">
                  <input
                    type="number"
                    min={MIN_BEAT_SECONDS}
                    max={MAX_BEAT_SECONDS}
                    step={0.5}
                    value={b.seconds}
                    onChange={(e) => update(i, { seconds: Number(e.target.value) })}
                    className="w-[72px]"
                    aria-label={`Beat ${i + 1} seconds`}
                  />
                  s
                </label>
                <span className="ml-auto flex gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === beats.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBeats((all) => all.filter((_, j) => j !== i))} disabled={beats.length <= 2} aria-label="Remove beat">
                    ✕
                  </button>
                </span>
              </div>
              <input value={b.heading} onChange={(e) => update(i, { heading: e.target.value })} maxLength={90} placeholder="On-screen text" aria-label={`Beat ${i + 1} on-screen text`} />
              <input value={b.sub} onChange={(e) => update(i, { sub: e.target.value })} maxLength={160} placeholder="Small line under it (optional)" aria-label={`Beat ${i + 1} small line`} />
            </div>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setBeats((all) => [...all.slice(0, -1), { kind: 'point', heading: '', sub: '', seconds: 4 }, ...all.slice(-1)])}
          disabled={beats.length >= MAX_BEATS}
        >
          Add beat
        </button>
        <span className={`mono ${seconds > MAX_REEL_SECONDS ? 'text-failed' : 'text-faint'}`}>
          {seconds.toFixed(1)}s of {MAX_REEL_SECONDS}s
        </span>
        <button type="button" className="btn btn-sm ml-auto" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <span className={`mono ${message.ok ? 'text-faint' : 'text-failed'}`}>{message.text}</span>}
      </div>
      <p className="mono text-faint">Thumbnails use the brand colours and type scale; the brand font and motion appear in the render.</p>
    </div>
  );
}
