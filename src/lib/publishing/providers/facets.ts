// Bluesky rich text: links and hashtags only become clickable when the post
// carries "facets" with UTF-8 byte offsets (not JS string indexes).

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: ({ $type: 'app.bsky.richtext.facet#link'; uri: string } | { $type: 'app.bsky.richtext.facet#tag'; tag: string })[];
}

const encoder = new TextEncoder();
const URL_RE = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
const TAG_RE = /(^|\s)#([\p{L}\p{N}_]{1,64})/gu;

function bytesBefore(text: string, index: number): number {
  return encoder.encode(text.slice(0, index)).length;
}

function span(text: string, start: number, end: number) {
  return { byteStart: bytesBefore(text, start), byteEnd: bytesBefore(text, end) };
}

export function detectFacets(text: string): Facet[] {
  const facets: Facet[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    facets.push({ index: span(text, start, start + m[0].length), features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  }
  for (const m of text.matchAll(TAG_RE)) {
    const hashAt = (m.index ?? 0) + m[1].length;
    // a number-only tag is not a hashtag on Bluesky
    if (/^\d+$/.test(m[2])) continue;
    facets.push({ index: span(text, hashAt, hashAt + 1 + m[2].length), features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2] }] });
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}
