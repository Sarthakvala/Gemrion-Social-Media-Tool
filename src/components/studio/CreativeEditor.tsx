'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCreative } from '@/app/console/studio/actions';
import { PLATFORM_NAMES, type Platform, type Post } from '@/lib/types';
import { SLIDE_LAYOUTS, type Slide } from '@/lib/studio/types';

const BLANK: Slide = { layout: 'statement', kicker: '', headline: '', body: '', points: [], stat: '' };

function SlideFields({
  slide,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  slide: Slide;
  index: number;
  total: number;
  onChange: (s: Slide) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Slide>) => onChange({ ...slide, ...patch });

  return (
    <div className="border border-line rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="mono text-faint w-12">#{index + 1}</span>
        <select value={slide.layout} onChange={(e) => set({ layout: e.target.value as Slide['layout'] })} className="!w-auto">
          {SLIDE_LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move slide up">↑</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move slide down">↓</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} aria-label="Remove slide">✕</button>
        </div>
      </div>
      <div className="grid gap-2">
        <input value={slide.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="Kicker (tiny label)" aria-label="Kicker" />
        {slide.layout === 'stat' && (
          <input value={slide.stat} onChange={(e) => set({ stat: e.target.value })} placeholder="Big number, e.g. 10.6x" aria-label="Stat" />
        )}
        <input value={slide.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="Headline" aria-label="Headline" />
        {slide.layout === 'list' ? (
          <textarea
            rows={4}
            value={slide.points.join('\n')}
            onChange={(e) => set({ points: e.target.value.split('\n') })}
            placeholder="One point per line"
            aria-label="Points"
          />
        ) : (
          <textarea rows={2} value={slide.body} onChange={(e) => set({ body: e.target.value })} placeholder="Supporting line" aria-label="Body" />
        )}
      </div>
    </div>
  );
}

export function CreativeEditor({ post }: { post: Post }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [format, setFormat] = useState(post.format);
  const [aspect, setAspect] = useState(post.aspect);
  const [hook, setHook] = useState(post.hook);
  const [pillar, setPillar] = useState(post.pillar);
  const [brief, setBrief] = useState(post.visual_brief);
  const [slides, setSlides] = useState<Slide[]>(post.slides_content ?? []);
  const [captions, setCaptions] = useState<Partial<Record<Platform, string>>>(post.platform_captions ?? {});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  function updateSlide(i: number, s: Slide) {
    setSlides((prev) => prev.map((x, j) => (j === i ? s : x)));
  }
  function moveSlide(i: number, dir: -1 | 1) {
    setSlides((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setNote('');
    const cleaned = slides.map((s) => ({ ...s, points: s.points.map((p) => p.trim()).filter(Boolean) }));
    const res = await saveCreative({ id: post.id, format, aspect, hook, pillar, visual_brief: brief, slides: cleaned, platform_captions: captions });
    setSaving(false);
    setNote(res.message);
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="lbl">Creative & captions</span>
        <span className="mono text-faint">save to re-render the slides</span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="lbl block mb-1">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as Post['format'])}>
            <option value="single">single image</option>
            <option value="carousel">carousel</option>
            <option value="story">story (9:16)</option>
          </select>
        </div>
        <div>
          <label className="lbl block mb-1">Size</label>
          <select value={format === 'story' ? '9:16' : aspect} disabled={format === 'story'} onChange={(e) => setAspect(e.target.value as Post['aspect'])}>
            <option value="4:5">4:5 portrait</option>
            <option value="1:1">1:1 square</option>
            <option value="9:16">9:16 tall</option>
          </select>
        </div>
        <div>
          <label className="lbl block mb-1">Pillar</label>
          <input value={pillar} onChange={(e) => setPillar(e.target.value)} />
        </div>
      </div>

      <label className="lbl block mb-1 mt-3">Hook</label>
      <input value={hook} onChange={(e) => setHook(e.target.value)} />

      <div className="mt-4">
        <span className="lbl block mb-1.5">Slides</span>
        <div className="flex flex-col gap-2">
          {slides.map((s, i) => (
            <SlideFields
              key={i}
              slide={s}
              index={i}
              total={slides.length}
              onChange={(v) => updateSlide(i, v)}
              onMove={(d) => moveSlide(i, d)}
              onRemove={() => setSlides((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setSlides((p) => [...p, BLANK])}>
          + Add slide
        </button>
      </div>

      {post.platforms.length > 0 && (
        <div className="mt-4">
          <span className="lbl block mb-1.5">Per-platform captions</span>
          <div className="flex flex-col gap-2.5">
            {post.platforms.map((p) => (
              <div key={p}>
                <label className="mono text-muted block mb-1">{PLATFORM_NAMES[p]}</label>
                <textarea
                  rows={p === 'X' ? 2 : 4}
                  value={captions[p] ?? ''}
                  onChange={(e) => setCaptions((c) => ({ ...c, [p]: e.target.value }))}
                  placeholder="Empty = uses the main caption"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="lbl block mb-1 mt-4">Visual brief (for designers)</label>
      <textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} />

      <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-line">
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save creative'}
        </button>
        {note && <span className="mono text-muted">{note}</span>}
      </div>
    </div>
  );
}
