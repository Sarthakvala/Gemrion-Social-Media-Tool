import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadBrand } from '@/lib/studio/data';
import { brandFonts } from '@/lib/studio/fonts';
import { SlideImage, slideText, type SlideBrand } from '@/lib/studio/slide';
import { ASPECT_SIZE, type Aspect, type Slide } from '@/lib/studio/types';
import { slugify } from '@/lib/studio/export';

const SAMPLE: Slide[] = [
  { layout: 'cover', kicker: 'Brand preview', headline: 'This is how your posts will look', body: 'Headline, body and accent all come from the brand kit.', points: [], stat: '' },
  { layout: 'list', kicker: 'Checklist', headline: 'Three things every post gets', points: ['Your colours and fonts', 'Your logo in the corner', 'Copy in your voice'], body: '', stat: '' },
  { layout: 'stat', kicker: 'Result', stat: '10.6x', headline: 'Return on ad spend', body: 'Big numbers get their own slide.', points: [] },
];

/**
 * GET /api/render?post=<id>&slide=<n>[&download=1]
 * GET /api/render?client=<id>&slide=<n>          (brand preview with sample copy)
 *
 * Reads through the signed-in user's session, so RLS decides who can render what.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = url.searchParams.get('post');
  const clientParam = url.searchParams.get('client');
  const index = Math.max(0, Number(url.searchParams.get('slide') ?? 0) || 0);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  let clientId: string;
  let slides: Slide[];
  let aspect: Aspect = '4:5';
  let title = 'brand-preview';

  if (postId) {
    const { data: post } = await supabase
      .from('posts')
      .select('client_id, title, aspect, slides_content')
      .eq('id', postId)
      .maybeSingle();
    if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    clientId = post.client_id;
    slides = (post.slides_content ?? []) as Slide[];
    aspect = (post.aspect as Aspect) in ASPECT_SIZE ? (post.aspect as Aspect) : '4:5';
    title = post.title || 'post';
  } else if (clientParam) {
    clientId = clientParam;
    slides = SAMPLE;
  } else {
    return NextResponse.json({ error: 'Pass ?post= or ?client=.' }, { status: 400 });
  }

  const slide = slides[index];
  if (!slide) return NextResponse.json({ error: 'No such slide.' }, { status: 404 });

  const brand = await loadBrand(supabase, clientId);
  if (!brand) return NextResponse.json({ error: 'Brand not found.' }, { status: 404 });

  const slideBrand: SlideBrand = {
    name: brand.name,
    handle: brand.profile.handle,
    logoUrl: brand.profile.logo_url,
    palette: brand.profile.palette,
  };
  const size = ASPECT_SIZE[aspect];
  const fonts = await brandFonts(brand.profile.heading_font, brand.profile.body_font, slideText(slide, slideBrand));

  const headers: Record<string, string> = { 'Cache-Control': 'private, max-age=30' };
  if (url.searchParams.get('download')) {
    headers['Content-Disposition'] = `attachment; filename="${slugify(title)}-${index + 1}.png"`;
  }

  return new ImageResponse(
    <SlideImage slide={slide} brand={slideBrand} frame={{ ...size, index, total: slides.length }} />,
    { ...size, fonts, headers }
  );
}
