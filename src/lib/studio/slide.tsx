import type { CSSProperties, ReactElement } from 'react';
import type { Palette, Slide } from './types';

export interface SlideBrand {
  name: string;
  handle: string;
  logoUrl: string;
  palette: Palette;
}

export interface SlideFrame {
  width: number;
  height: number;
  index: number;
  total: number;
}

const PAD = 88;

/** Scales headline size down as the text gets longer so it never overflows. */
export function headlineSize(text: string, base: number): number {
  const n = text.length;
  if (n <= 24) return base;
  if (n <= 48) return Math.round(base * 0.82);
  if (n <= 80) return Math.round(base * 0.66);
  return Math.round(base * 0.54);
}

export function slideText(slide: Slide, brand: SlideBrand): string {
  return [slide.kicker, slide.headline, slide.body, slide.stat, ...slide.points, brand.name, brand.handle, 'Swipe'].join(' ');
}

const col: CSSProperties = { display: 'flex', flexDirection: 'column' };

function Kicker({ text, color }: { text: string; color: string }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', fontFamily: 'Body', fontWeight: 700, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color, marginBottom: 28 }}>
      {text}
    </div>
  );
}

function Headline({ text, size, color }: { text: string; size: number; color: string }) {
  return (
    <div style={{ display: 'flex', fontFamily: 'Heading', fontWeight: 800, fontSize: headlineSize(text, size), lineHeight: 1.05, letterSpacing: -1.5, color }}>
      {text}
    </div>
  );
}

function Body({ text, color }: { text: string; color: string }) {
  if (!text) return null;
  return (
    <div style={{ display: 'flex', fontFamily: 'Body', fontSize: 36, lineHeight: 1.35, color, marginTop: 32 }}>
      {text}
    </div>
  );
}

function Content({ slide, brand }: { slide: Slide; brand: SlideBrand }) {
  const { fg, accent, muted } = brand.palette;

  switch (slide.layout) {
    case 'list':
      return (
        <div style={col}>
          <Kicker text={slide.kicker} color={accent} />
          <Headline text={slide.headline} size={76} color={fg} />
          <div style={{ ...col, marginTop: 48 }}>
            {slide.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 26 }}>
                <div style={{ display: 'flex', fontFamily: 'Heading', fontWeight: 800, fontSize: 36, color: accent, width: 76 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', flex: 1, fontFamily: 'Body', fontSize: 38, lineHeight: 1.3, color: fg }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case 'stat':
      return (
        <div style={col}>
          <Kicker text={slide.kicker} color={muted} />
          <div style={{ display: 'flex', fontFamily: 'Heading', fontWeight: 800, fontSize: headlineSize(slide.stat, 240), lineHeight: 1, letterSpacing: -6, color: accent }}>
            {slide.stat}
          </div>
          <div style={{ display: 'flex', marginTop: 28 }}>
            <Headline text={slide.headline} size={64} color={fg} />
          </div>
          <Body text={slide.body} color={muted} />
        </div>
      );
    case 'quote':
      return (
        <div style={col}>
          <div style={{ display: 'flex', fontFamily: 'Heading', fontWeight: 800, fontSize: 220, lineHeight: 0.8, color: accent, height: 150 }}>“</div>
          <Headline text={slide.headline} size={72} color={fg} />
          <Body text={slide.body} color={muted} />
        </div>
      );
    case 'cta':
      return (
        <div style={col}>
          <Kicker text={slide.kicker} color={accent} />
          <Headline text={slide.headline} size={92} color={fg} />
          <Body text={slide.body} color={muted} />
          <div style={{ display: 'flex', marginTop: 56 }}>
            <div style={{ display: 'flex', background: accent, color: brand.palette.bg, fontFamily: 'Body', fontWeight: 700, fontSize: 34, padding: '22px 40px', borderRadius: 999 }}>
              {brand.handle || brand.name}
            </div>
          </div>
        </div>
      );
    case 'statement':
      return (
        <div style={col}>
          <div style={{ display: 'flex', width: 96, height: 12, background: accent, borderRadius: 6, marginBottom: 44 }} />
          <Kicker text={slide.kicker} color={muted} />
          <Headline text={slide.headline} size={88} color={fg} />
          <Body text={slide.body} color={muted} />
        </div>
      );
    default:
      return (
        <div style={col}>
          <Kicker text={slide.kicker} color={accent} />
          <Headline text={slide.headline} size={112} color={fg} />
          <Body text={slide.body} color={muted} />
        </div>
      );
  }
}

/** One slide as a Satori element tree (flexbox only). */
export function SlideImage({ slide, brand, frame }: { slide: Slide; brand: SlideBrand; frame: SlideFrame }): ReactElement {
  const { bg, fg, accent, muted } = brand.palette;
  const isLast = frame.index === frame.total - 1;
  const bottomAligned = slide.layout === 'cover' || slide.layout === 'cta';

  return (
    <div style={{ ...col, width: frame.width, height: frame.height, background: bg, padding: PAD, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', position: 'absolute', width: 760, height: 760, borderRadius: 760, right: -300, top: -300, background: accent, opacity: 0.09 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" height={64} style={{ objectFit: 'contain', maxWidth: 420 }} />
        ) : (
          <div style={{ display: 'flex', fontFamily: 'Heading', fontWeight: 800, fontSize: 38, color: fg }}>{brand.name}</div>
        )}
        {frame.total > 1 && (
          <div style={{ display: 'flex', fontFamily: 'Body', fontWeight: 700, fontSize: 28, color: muted }}>
            {String(frame.index + 1).padStart(2, '0')} / {String(frame.total).padStart(2, '0')}
          </div>
        )}
      </div>

      <div style={{ ...col, flex: 1, justifyContent: bottomAligned ? 'flex-end' : 'center', paddingBottom: bottomAligned ? 40 : 0 }}>
        <Content slide={slide} brand={brand} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Body', fontSize: 28, color: muted }}>
        <div style={{ display: 'flex' }}>{brand.handle}</div>
        {frame.total > 1 && !isLast && <div style={{ display: 'flex', color: accent, fontWeight: 700 }}>Swipe →</div>}
      </div>
    </div>
  );
}
