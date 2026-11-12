import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const SYSTEM_FONTS = new Set(['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana']);
const FONT_TIMEOUT_MS = 20_000;

function cssUrl(family: string, withWeights: boolean): string {
  const name = family.trim().replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${name}${withWeights ? ':wght@400;700' : ''}&display=block`;
}

/** Loads one Google font; retries without weights because single-weight families reject "400;700". */
async function loadFamily(family: string): Promise<void> {
  for (const withWeights of [true, false]) {
    const res = await fetch(cssUrl(family, withWeights));
    if (!res.ok) continue;
    const style = document.createElement('style');
    style.textContent = await res.text();
    document.head.appendChild(style);
    await Promise.all([document.fonts.load(`400 64px "${family}"`), document.fonts.load(`700 64px "${family}"`)]);
    return;
  }
  throw new Error(`Google Fonts has no family "${family}"`);
}

/**
 * Holds the frame until the brand fonts are ready. The family names are
 * validated by the spec schema (letters, digits, spaces). A font that cannot
 * load falls back to a system font instead of failing the whole render.
 */
export function useBrandFonts(families: string[]): void {
  const [handle] = useState(() => delayRender('Loading brand fonts', { timeoutInMilliseconds: FONT_TIMEOUT_MS + 5000 }));
  const key = families.join('|');

  useEffect(() => {
    const wanted = [...new Set(key.split('|'))].filter((f) => f && !SYSTEM_FONTS.has(f));
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    Promise.race([Promise.allSettled(wanted.map(loadFamily)), timeout])
      .then((results) => {
        if (Array.isArray(results)) {
          for (const r of results) if (r.status === 'rejected') console.warn('[reel] font fallback:', String(r.reason));
        } else {
          console.warn('[reel] fonts timed out, using fallbacks');
        }
      })
      .finally(() => continueRender(handle));
  }, [key, handle]);
}
