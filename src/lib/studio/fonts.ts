import 'server-only';

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: 'normal';
}

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function fetchTtf(family: string, weight: number | null, text: string): Promise<ArrayBuffer | null> {
  const fam = encodeURIComponent(family) + (weight ? `:wght@${weight}` : '');
  const url = `https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(text)}`;
  const css = await fetch(url).then((r) => (r.ok ? r.text() : ''));
  const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!src) return null;
  const res = await fetch(src[1]);
  return res.ok ? res.arrayBuffer() : null;
}

/** A Google Font subset to exactly the glyphs in `text`. Falls back to the default weight, then to none. */
function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  const key = `${family}|${weight}|${text}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = fetchTtf(family, weight, text)
      .then((buf) => buf ?? fetchTtf(family, null, text))
      .catch(() => null);
    cache.set(key, hit);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

export async function brandFonts(heading: string, body: string, text: string): Promise<LoadedFont[]> {
  // kickers are uppercased by CSS, so the subset needs capitals too
  const glyphs = Array.from(new Set(text + text.toUpperCase() + '0123456789/→“”·')).join('');
  const [h, b, bb] = await Promise.all([
    loadFont(heading, 800, glyphs),
    loadFont(body, 400, glyphs),
    loadFont(body, 700, glyphs),
  ]);
  const fonts: LoadedFont[] = [];
  if (h) fonts.push({ name: 'Heading', data: h, weight: 800, style: 'normal' });
  if (b) fonts.push({ name: 'Body', data: b, weight: 400, style: 'normal' });
  if (bb) fonts.push({ name: 'Body', data: bb, weight: 700, style: 'normal' });
  return fonts;
}
