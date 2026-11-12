import 'server-only';
import { ImageResponse } from 'next/og';
import { brandFonts } from './fonts';
import { SlideImage, slideText, type SlideBrand } from './slide';
import { ASPECT_SIZE, type Aspect, type Slide } from './types';
import type { LoadedBrand } from './data';

export function slideBrandOf(brand: LoadedBrand): SlideBrand {
  return { name: brand.name, handle: brand.profile.handle, logoUrl: brand.profile.logo_url, palette: brand.profile.palette };
}

export function aspectOf(value: string | null | undefined): Aspect {
  return value && value in ASPECT_SIZE ? (value as Aspect) : '4:5';
}

/** One brand slide as a PNG response; the same renderer serves /api/render and the publisher. */
export async function slideResponse(brand: LoadedBrand, slides: Slide[], index: number, aspect: Aspect, headers?: Record<string, string>): Promise<ImageResponse> {
  const slideBrand = slideBrandOf(brand);
  const slide = slides[index];
  const size = ASPECT_SIZE[aspect];
  const fonts = await brandFonts(brand.profile.heading_font, brand.profile.body_font, slideText(slide, slideBrand));
  return new ImageResponse(<SlideImage slide={slide} brand={slideBrand} frame={{ ...size, index, total: slides.length }} />, { ...size, fonts, headers });
}

/** PNG bytes of one slide, for uploading to a network. */
export async function renderSlidePng(brand: LoadedBrand, slides: Slide[], index: number, aspect: Aspect): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const res = await slideResponse(brand, slides, index, aspect);
  const size = ASPECT_SIZE[aspect];
  return { bytes: new Uint8Array(await res.arrayBuffer()), ...size };
}
