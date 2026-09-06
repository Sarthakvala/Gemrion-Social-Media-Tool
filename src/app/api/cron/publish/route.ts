import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchJson } from '@/lib/platforms';
import type { Platform } from '@/lib/types';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: duePosts } = await admin
    .from('posts')
    .select('id, client_id, platforms, copy, caption, hashtags, link, image_url, enabled')
    .eq('status', 'scheduled')
    .eq('enabled', true)
    .lte('scheduled_at', now)
    .order('scheduled_at')
    .limit(20);

  if (!duePosts?.length) {
    return NextResponse.json({ published: 0, message: 'No posts due.' });
  }

  const results: Array<{ id: string; ok: boolean; details: string[] }> = [];

  for (const post of duePosts) {
    const platforms = (post.platforms || []) as Platform[];
    const { data: accounts } = await admin
      .from('social_accounts')
      .select('platform, access_token, meta, connected, is_real')
      .eq('client_id', post.client_id)
      .in('platform', platforms);

    const details: string[] = [];
    for (const pl of platforms) {
      const acct = (accounts ?? []).find((a) => a.platform === pl);
      if (!acct?.connected) {
        details.push(`${pl}: not connected`);
        continue;
      }
      if (!acct.is_real) {
        details.push(`${pl}: demo - simulated OK`);
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
        if (pl === 'FB') {
          const pageId = tokenData.pageId as string;
          const pageToken = tokenData.pageToken as string;
          if (!pageId || !pageToken) { details.push('FB: no token'); continue; }
          const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: [post.copy, post.caption, post.hashtags].filter(Boolean).join('\n\n'),
              link: post.link || undefined,
              access_token: pageToken,
            }),
          });
          details.push(r.ok ? 'FB: published' : `FB: error ${r.status}`);
        } else if (pl === 'IG') {
          const igId = tokenData.igId as string;
          const pageToken = tokenData.pageToken as string;
          if (!igId || !pageToken || !post.image_url) { details.push('IG: missing token or image'); continue; }
          const media = await fetchJson(`https://graph.facebook.com/v21.0/${igId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: post.image_url, caption: [post.copy, post.caption, post.hashtags].filter(Boolean).join('\n\n'), access_token: pageToken }),
          });
          if (media.id) {
            await fetchJson(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creation_id: media.id, access_token: pageToken }),
            });
            details.push('IG: published');
          } else { details.push('IG: container failed'); }
        } else if (pl === 'X') {
          const at = tokenData.accessToken as string;
          if (!at) { details.push('X: no token'); continue; }
          const r = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + at },
            body: JSON.stringify({ text: [post.copy, post.caption, post.hashtags].filter(Boolean).join('\n\n').slice(0, 280) }),
          });
          details.push(r.ok ? 'X: published' : `X: error ${r.status}`);
        } else if (pl === 'LI') {
          const at = tokenData.accessToken as string;
          const urn = tokenData.personUrn as string;
          if (!at || !urn) { details.push('LI: no token'); continue; }
          const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + at },
            body: JSON.stringify({
              author: urn, lifecycleState: 'PUBLISHED',
              specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: [post.copy, post.caption, post.hashtags].filter(Boolean).join('\n\n') }, shareMediaCategory: 'NONE' } },
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
            }),
          });
          details.push(r.ok ? 'LI: published' : `LI: error ${r.status}`);
        } else {
          details.push(`${pl}: not automated yet`);
        }
      } catch (e) {
        details.push(`${pl}: ${e instanceof Error ? e.message : 'error'}`);
      }
    }

    const allOk = details.every((d) => d.includes('published') || d.includes('simulated') || d.includes('demo'));
    await admin.from('posts').update({
      status: allOk ? 'published' : 'failed',
      published_at: allOk ? new Date().toISOString() : null,
      publish_error: allOk ? null : details.join(' | '),
    }).eq('id', post.id);

    results.push({ id: post.id, ok: allOk, details });
  }

  return NextResponse.json({
    published: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
