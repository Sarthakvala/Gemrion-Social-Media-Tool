import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site';

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const { canvas, ink, muted, line, accent } = siteConfig.colors;
const STEPS = ['Brand kit', 'Month plan', 'Captions + slides', 'Download'];

/** Share card: monochrome console look with the single orange accent. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: canvas, padding: 72, border: `1px solid ${line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 28, height: 28, background: accent, borderRadius: 6 }} />
          <div style={{ fontSize: 34, fontWeight: 700, color: ink }}>{siteConfig.name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: ink, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{siteConfig.tagline}</div>
          <div style={{ fontSize: 30, color: muted, maxWidth: 940 }}>Train it once on a brand. Get a month of posts you can download and publish.</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {STEPS.map((step, i) => (
            <div key={step} style={{ display: 'flex', fontSize: 24, color: i === STEPS.length - 1 ? accent : ink, border: `1px solid ${i === STEPS.length - 1 ? accent : line}`, borderRadius: 7, padding: '10px 18px', background: '#ffffff' }}>
              {`${String(i + 1).padStart(2, '0')}  ${step}`}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
