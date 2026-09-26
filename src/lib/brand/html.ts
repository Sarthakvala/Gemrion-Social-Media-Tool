import { isIP } from 'node:net';

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return true;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function htmlToText(html: string, max = 12000): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, max);
}

export function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta\\b(?:[^>"']|"[^"]*"|'[^']*')*?(?:name|property)=["']${key}["'](?:[^>"']|"[^"]*"|'[^']*')*>`, 'i');
  const tag = html.match(re)?.[0] ?? '';
  return tag.match(/content=(["'])(.*?)\1/i)?.[2]?.trim() ?? '';
}

export function pageTitle(html: string): string {
  return htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '', 200);
}

/** Most-used hex colours in inline styles and <style> blocks, theme-color first. */
export function extractColors(html: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(' ') +
    ' ' + [...html.matchAll(/style=["']([^"']*)["']/gi)].map((m) => m[1]).join(' ');
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let hex = m[1].toLowerCase();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    counts.set(`#${hex}`, (counts.get(`#${hex}`) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const theme = metaContent(html, 'theme-color').toLowerCase();
  const out = /^#[0-9a-f]{6}$/.test(theme) ? [theme, ...ranked.filter((c) => c !== theme)] : ranked;
  return out.slice(0, limit);
}

/** Font families from Google Fonts links and CSS font-family declarations. */
export function extractFonts(html: string, limit = 6): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?[^"'\s>]+/gi)) {
    for (const fam of m[0].matchAll(/family=([^&:;"']+)/gi)) found.push(decodeURIComponent(fam[1].replace(/\+/g, ' ')));
  }
  for (const m of html.matchAll(/font-family\s*:\s*([^;}"]+)/gi)) {
    const first = m[1].split(',')[0].replace(/['"]/g, '').trim();
    if (first && !/^(var\(|inherit|initial|sans-serif|serif|monospace|system-ui|-apple-system)/i.test(first)) found.push(first);
  }
  return [...new Set(found.map((f) => f.trim()).filter(Boolean))].slice(0, limit);
}

/** First same-origin link that looks like an about / story page. */
export function findAboutLink(html: string, base: URL): URL | null {
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = `${m[1]} ${htmlToText(m[2], 80)}`.toLowerCase();
    if (!/about|our story|who we are|company/.test(label)) continue;
    try {
      const u = new URL(m[1], base);
      if (u.origin === base.origin && u.pathname !== base.pathname) return u;
    } catch {
      // ignore malformed href
    }
  }
  return null;
}
