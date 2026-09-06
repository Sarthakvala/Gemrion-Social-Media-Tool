import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchJson } from '@/lib/platforms';
import type { Platform } from '@/lib/types';

async function publishToplatform(
  platform: Platform,
  post: Record<string, unknown>,
  tokenData: Record<string, unknown>
): Promise<string> {
  const text = [post.copy, post.caption, post.hashtags]
    .filter(Boolean)
    .join('\n\n');

  switch (platform) {
    case 'FB': {
      const pageId = tokenData.pageId as string;
      const pageToken = tokenData.pageToken as string;
      if (!pageId || !pageToken) return 'FB: no token stored';
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${pageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            link: (post.link as string) || undefined,
            access_token: pageToken,
          }),
        }
      );
      return r.ok
        ? 'FB: published via Graph API'
        : `FB: Graph API error ${r.status}`;
    }

    case 'IG': {
      const igId = tokenData.igId as string;
      const pageToken = tokenData.pageToken as string;
      const imageUrl = post.image_url as string;
      if (!igId || !pageToken) return 'IG: no token stored';
      if (!imageUrl) return 'IG: image required for Instagram publishing';

      const media = await fetchJson(
        `https://graph.facebook.com/v21.0/${igId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: text,
            access_token: pageToken,
          }),
        }
      );
      const containerId = media.id as string;
      if (!containerId) return 'IG: failed to create media container';

      const pub = await fetchJson(
        `https://graph.facebook.com/v21.0/${igId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: pageToken,
          }),
        }
      );
      return pub.id ? 'IG: published' : 'IG: publish step failed';
    }

    case 'X': {
      const accessToken = tokenData.accessToken as string;
      if (!accessToken) return 'X: no token stored';
      const r = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + accessToken,
        },
        body: JSON.stringify({ text: text.slice(0, 280) }),
      });
      return r.ok ? 'X: published via API v2' : `X: API v2 error ${r.status}`;
    }

    case 'LI': {
      const accessToken = tokenData.accessToken as string;
      const personUrn = tokenData.personUrn as string;
      if (!accessToken || !personUrn) return 'LI: no token stored';
      const r = await fetch(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + accessToken,
          },
          body: JSON.stringify({
            author: personUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text },
                shareMediaCategory: 'NONE',
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
          }),
        }
      );
      return r.ok ? 'LI: published' : `LI: error ${r.status}`;
    }

    case 'TT':
      return 'TT: TikTok requires video upload via Content Posting API (not automated yet)';

    default:
      return `${platform}: unsupported platform`;
  }
}

export async function POST(request: NextRequest) {
  await requireAgency();

  const { post_id } = await request.json();
  if (!post_id) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: post } = await admin
    .from('posts')
    .select('*')
    .eq('id', post_id)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (!post.enabled) {
    return NextResponse.json(
      { error: 'Post is disabled - enable it before publishing.' },
      { status: 403 }
    );
  }

  const platforms = (post.platforms || []) as Platform[];
  if (!platforms.length) {
    return NextResponse.json(
      { error: 'No platforms selected.' },
      { status: 400 }
    );
  }

  const { data: accounts } = await admin
    .from('social_accounts')
    .select('platform, access_token, meta, connected, is_real')
    .eq('client_id', post.client_id)
    .in('platform', platforms);

  const results: string[] = [];
  for (const pl of platforms) {
    const acct = (accounts ?? []).find((a) => a.platform === pl);
    if (!acct?.connected) {
      results.push(`${pl}: not connected`);
      continue;
    }
    if (!acct.is_real) {
      results.push(`${pl}: demo mode - simulated publish OK`);
      continue;
    }

    let tokenData: Record<string, unknown> = {};
    try {
      tokenData =
        typeof acct.access_token === 'string'
          ? JSON.parse(acct.access_token)
          : (acct.meta as Record<string, unknown>) || {};
    } catch {
      tokenData = (acct.meta as Record<string, unknown>) || {};
    }

    try {
      const result = await publishToplatform(pl, post, tokenData);
      results.push(result);
    } catch (e) {
      results.push(
        `${pl}: error - ${e instanceof Error ? e.message : 'unknown'}`
      );
    }
  }

  const allOk = results.every(
    (r) => r.includes('published') || r.includes('simulated')
  );

  await admin
    .from('posts')
    .update({
      status: allOk ? 'published' : 'failed',
      published_at: allOk ? new Date().toISOString() : null,
      publish_error: allOk ? null : results.join(' | '),
    })
    .eq('id', post_id);

  return NextResponse.json({
    ok: allOk,
    results,
    status: allOk ? 'published' : 'failed',
  });
}
