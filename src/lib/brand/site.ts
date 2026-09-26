import 'server-only';
import { lookup } from 'node:dns/promises';
import { extractColors, extractFonts, findAboutLink, htmlToText, isPrivateIp, metaContent, pageTitle } from './html';

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

export interface SiteSnapshot {
  url: string;
  title: string;
  description: string;
  text: string;
  aboutText: string;
  colors: string[];
  fonts: string[];
}

export class SiteError extends Error {}

async function assertPublic(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new SiteError('Only http(s) websites can be read.');
  if (url.username || url.password) throw new SiteError('URLs with credentials are not allowed.');
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new SiteError(`Could not resolve ${url.hostname}.`);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new SiteError('That address is not a public website.');
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Fetches a public HTML page, re-validating every redirect hop against private ranges. */
async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'AgencyFlow-BrandReader/1.0', accept: 'text/html' },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new SiteError(`The site answered ${res.status}.`);
    if (!(res.headers.get('content-type') ?? '').includes('html')) throw new SiteError('That URL is not an HTML page.');
    return { url, html: await readCapped(res) };
  }
  throw new SiteError('Too many redirects.');
}

export function normalizeUrl(input: string): URL {
  const raw = input.trim();
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new SiteError('That does not look like a website address.');
  }
}

export async function readSite(input: string): Promise<SiteSnapshot> {
  const { url, html } = await fetchHtml(normalizeUrl(input));
  const about = findAboutLink(html, url);
  const aboutHtml = about ? await fetchHtml(about).then((r) => r.html).catch(() => '') : '';

  return {
    url: url.toString(),
    title: pageTitle(html),
    description: metaContent(html, 'description') || metaContent(html, 'og:description'),
    text: htmlToText(html, 10000),
    aboutText: htmlToText(aboutHtml, 6000),
    colors: extractColors(html),
    fonts: extractFonts(html),
  };
}
