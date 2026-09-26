import type { Platform } from '@/lib/types';

export type SlideLayout = 'cover' | 'statement' | 'list' | 'stat' | 'quote' | 'cta';
export const SLIDE_LAYOUTS: SlideLayout[] = ['cover', 'statement', 'list', 'stat', 'quote', 'cta'];

export type PostFormat = 'single' | 'carousel' | 'story';
export type Aspect = '1:1' | '4:5' | '9:16';

export const ASPECT_SIZE: Record<Aspect, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
};

export interface Slide {
  layout: SlideLayout;
  kicker: string;
  headline: string;
  body: string;
  points: string[];
  stat: string;
}

export interface Pillar {
  name: string;
  share: number;
  topics: string;
}

export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
}

export interface BrandProfile {
  client_id: string;
  industry: string;
  offer: string;
  audience: string;
  voice: string;
  pillars: Pillar[];
  dos: string;
  donts: string;
  banned_words: string;
  cta_style: string;
  hashtags: string;
  language: string;
  timezone: string;
  handle: string;
  palette: Palette;
  heading_font: string;
  body_font: string;
  logo_url: string;
}

export interface BrandExample {
  id: string;
  client_id: string;
  platform: string;
  body: string;
  post_id: string | null;
  created_at: string;
}

export type PlatformCaptions = Partial<Record<Platform, string>>;

export const DEFAULT_PALETTE: Palette = {
  bg: '#0b1b3a',
  fg: '#ffffff',
  accent: '#ff5a1f',
  muted: '#9fb0d0',
};

export function emptyBrandProfile(clientId: string): BrandProfile {
  return {
    client_id: clientId,
    industry: '',
    offer: '',
    audience: '',
    voice: '',
    pillars: [],
    dos: '',
    donts: '',
    banned_words: '',
    cta_style: '',
    hashtags: '',
    language: 'English',
    timezone: 'Asia/Kolkata',
    handle: '',
    palette: DEFAULT_PALETTE,
    heading_font: 'Inter',
    body_font: 'Inter',
    logo_url: '',
  };
}

export const PILLAR_ROWS = 5;

export const FONT_CHOICES = [
  'Inter',
  'DM Sans',
  'Plus Jakarta Sans',
  'Poppins',
  'Montserrat',
  'Space Grotesk',
  'Archivo',
  'Outfit',
  'Playfair Display',
  'Lora',
  'Bebas Neue',
];
