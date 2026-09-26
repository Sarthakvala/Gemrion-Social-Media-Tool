import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { loadBrand } from '@/lib/studio/data';
import { FONT_CHOICES, PILLAR_ROWS } from '@/lib/studio/types';
import { PLATFORMS, PLATFORM_NAMES } from '@/lib/types';
import { saveBrand, addExample, deleteExample } from './actions';
import { BrandDraftForm } from '@/components/studio/BrandDraftForm';

// AI drafting runs as a server action on this page
export const maxDuration = 120;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="lbl block mb-1">{label}</span>
      {children}
      {hint && <p className="mono text-faint mt-1">{hint}</p>}
    </div>
  );
}

export default async function BrandKitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const profile = await requireAgency();
  const supabase = await createClient();

  const brand = await loadBrand(supabase, id);
  if (!brand) notFound();
  const b = brand.profile;
  const { data: stamp } = await supabase.from('brand_profiles').select('updated_at').eq('client_id', id).maybeSingle();
  const v = encodeURIComponent(stamp?.updated_at ?? '');
  const pillarRows = Array.from({ length: PILLAR_ROWS }, (_, i) => b.pillars[i] ?? { name: '', share: 0, topics: '' });

  return (
    <Shell profile={profile} nav={consoleNav('clients')}>
      <Link href="/console/clients" className="mono text-muted hover:text-ink">← all brands</Link>
      <div className="flex items-end justify-between gap-4 mt-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{brand.name} · brand kit</h1>
          <p className="text-muted mt-1 text-[13.5px]">
            Everything here goes into every generation. The more specific, the more on-brand the posts.
          </p>
        </div>
        <Link href={`/console/studio?client=${id}`} className="btn btn-accent">Generate posts →</Link>
      </div>

      {saved && <div className="panel p-3 mb-4 border-l-[3px] border-l-published text-[13.5px]">Brand kit saved.</div>}

      <BrandDraftForm clientId={id} hasKit={!!(b.voice || b.audience || b.industry)} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <form key={v} action={saveBrand} className="flex flex-col gap-4">
          <input type="hidden" name="client_id" value={id} />

          <section className="panel p-4 grid gap-3">
            <span className="lbl">Who they are</span>
            <Field label="Industry / what they do">
              <input name="industry" defaultValue={b.industry} placeholder="Web design and performance marketing agency" />
            </Field>
            <Field label="Offer and proof points" hint="Services, prices, real results, client names you are allowed to mention">
              <textarea name="offer" rows={3} defaultValue={b.offer} />
            </Field>
            <Field label="Audience" hint="Who reads these posts, what they want, what they fear">
              <textarea name="audience" rows={3} defaultValue={b.audience} />
            </Field>
          </section>

          <section className="panel p-4 grid gap-3">
            <span className="lbl">How they sound</span>
            <Field label="Voice and tone">
              <textarea name="voice" rows={3} defaultValue={b.voice} placeholder="Blunt, honest, specific. Short sentences. No hype." />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Always do">
                <textarea name="dos" rows={4} defaultValue={b.dos} />
              </Field>
              <Field label="Never do">
                <textarea name="donts" rows={4} defaultValue={b.donts} />
              </Field>
            </div>
            <Field label="Banned words" hint="Comma separated">
              <input name="banned_words" defaultValue={b.banned_words} placeholder="synergy, game-changer, unlock" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="CTA style">
                <input name="cta_style" defaultValue={b.cta_style} placeholder="Soft: 'DM us AUDIT'" />
              </Field>
              <Field label="Brand hashtags">
                <input name="hashtags" defaultValue={b.hashtags} placeholder="#gemrion #webdesign" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Language">
                <input name="language" defaultValue={b.language} />
              </Field>
              <Field label="Time zone">
                <input name="timezone" defaultValue={b.timezone} placeholder="Asia/Kolkata" />
              </Field>
              <Field label="Handle">
                <input name="handle" defaultValue={b.handle} placeholder="@gemrion" />
              </Field>
            </div>
          </section>

          <section className="panel p-4 grid gap-2.5">
            <span className="lbl">Content pillars</span>
            <p className="mono text-faint -mt-1">Name, share of posts (%), and example topics. Leave rows empty to skip.</p>
            {pillarRows.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_72px_2fr] gap-2">
                <input name={`pillar_name_${i}`} defaultValue={p.name} placeholder="Education" aria-label={`Pillar ${i + 1} name`} />
                <input name={`pillar_share_${i}`} type="number" min={0} max={100} defaultValue={p.share || ''} placeholder="%" aria-label={`Pillar ${i + 1} share`} />
                <input name={`pillar_topics_${i}`} defaultValue={p.topics} placeholder="Offer tests, ad checks, landing pages" aria-label={`Pillar ${i + 1} topics`} />
              </div>
            ))}
          </section>

          <section className="panel p-4 grid gap-3">
            <span className="lbl">Look</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([['color_bg', 'Background', b.palette.bg], ['color_fg', 'Text', b.palette.fg], ['color_accent', 'Accent', b.palette.accent], ['color_muted', 'Muted text', b.palette.muted]] as const).map(([name, label, value]) => (
                <Field key={name} label={label}>
                  <input type="color" name={name} defaultValue={value} />
                </Field>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Heading font" hint="Any Google Fonts family name">
                <input name="heading_font" list="fonts" defaultValue={b.heading_font} />
              </Field>
              <Field label="Body font">
                <input name="body_font" list="fonts" defaultValue={b.body_font} />
              </Field>
              <datalist id="fonts">
                {FONT_CHOICES.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
            <Field label="Logo" hint="PNG or JPG under 1 MB. Transparent PNG looks best.">
              <div className="flex items-center gap-3">
                {b.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logo_url} alt="" className="h-10 max-w-[140px] object-contain rounded border border-line p-1" style={{ background: b.palette.bg }} />
                )}
                <input type="file" name="logo" accept="image/png,image/jpeg" />
              </div>
              {b.logo_url && (
                <label className="flex items-center gap-1.5 mt-2 text-[13px]">
                  <input type="checkbox" name="remove_logo" /> Remove logo
                </label>
              )}
            </Field>
          </section>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-accent">Save brand kit</button>
          </div>
        </form>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[70px]">
          <div className="panel p-4">
            <span className="lbl block mb-2.5">Preview</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`/api/render?client=${id}&slide=${i}&v=${v}`} alt={`Sample slide ${i + 1}`} className="w-full aspect-[4/5] object-cover rounded border border-line" />
              ))}
            </div>
            <p className="mono text-faint mt-2">Save to refresh.</p>
          </div>

          <div className="panel p-4">
            <span className="lbl block">Example posts ({brand.examples.length})</span>
            <p className="mono text-faint mt-1 mb-3">
              Real posts they liked. The AI copies the voice, not the words. 3-8 is the sweet spot.
            </p>
            <form action={addExample} className="flex flex-col gap-2">
              <input type="hidden" name="client_id" value={id} />
              <textarea name="body" rows={4} placeholder="Paste a caption the brand approved…" required />
              <div className="flex gap-2">
                <select name="platform" defaultValue="" className="!w-auto" aria-label="Platform">
                  <option value="">any platform</option>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_NAMES[p]}</option>)}
                </select>
                <button type="submit" className="btn btn-ghost">Add example</button>
              </div>
            </form>
            <div className="flex flex-col gap-2 mt-3">
              {brand.examples.map((e) => (
                <div key={e.id} className="border border-line rounded-md p-2.5">
                  <p className="text-[12.5px] whitespace-pre-wrap line-clamp-5">{e.body}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="mono text-faint">{e.platform || 'any'}{e.post_id ? ' · from a post' : ''}</span>
                    <form action={deleteExample}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="client_id" value={id} />
                      <button type="submit" className="mono text-muted hover:text-failed">remove</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
