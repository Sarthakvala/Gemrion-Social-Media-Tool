import { describe, expect, it } from 'vitest';
import { detectFacets } from './facets';
import { blueskyProvider, connectBluesky } from './bluesky';
import { authorizeUrl, checkState, exchangeCode, mastodonProvider, normalizeInstance, registerApp } from './mastodon';
import { connectTelegram, telegramProvider } from './telegram';
import { connectDiscord, discordProvider } from './discord';
import { PermanentPublishError, type FetchLike, type MediaFile } from '../types';

type Call = { url: string; init?: RequestInit };
type Route = (call: Call) => { status?: number; body: unknown } | undefined;

/** Fake fetch: the first route that returns a response wins; every call is recorded. */
function fakeFetch(routes: Route[]): FetchLike & { calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    for (const r of routes) {
      const hit = r(call);
      if (hit) return new Response(JSON.stringify(hit.body), { status: hit.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request ${url}`);
  }) as FetchLike & { calls: Call[] };
  f.calls = calls;
  return f;
}

/** Matches on the URL path end (ignoring the query), so /getChat does not also catch /getChatMember. */
const on = (part: string, body: unknown, status = 200): Route => (c) => {
  const path = c.url.split('?')[0];
  return path.endsWith(part) || c.url.includes(`${part}?`) || (part.startsWith('?') && c.url.includes(part)) || (part.endsWith('/') && c.url.includes(part)) ? { status, body } : undefined;
};
const json = (c: Call) => JSON.parse(String(c.init?.body));
const png: MediaFile = { bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png', filename: 'slide-1.png', alt: 'Slide one', width: 1080, height: 1350 };

describe('detectFacets', () => {
  it('uses UTF-8 byte offsets for links and hashtags', () => {
    const text = 'é see https://example.com/x. #growth';
    const [link, tag] = detectFacets(text);
    expect(link.features[0]).toEqual({ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.com/x' });
    // 'é' is 2 bytes, so the link starts at byte 7 and its 21 bytes end at 28
    expect(link.index).toEqual({ byteStart: 7, byteEnd: 28 });
    expect(tag.features[0]).toEqual({ $type: 'app.bsky.richtext.facet#tag', tag: 'growth' });
    expect(new TextEncoder().encode(text).slice(tag.index.byteStart, tag.index.byteEnd)).toEqual(new TextEncoder().encode('#growth'));
  });

  it('ignores number-only tags and tags glued to words', () => {
    expect(detectFacets('issue #42 and email#tag')).toEqual([]);
  });
});

describe('bluesky', () => {
  const session = on('createSession', { accessJwt: 'jwt', did: 'did:plc:abc', handle: 'brand.bsky.social' });

  it('connects with an app password and keeps only what publishing needs', async () => {
    const f = fakeFetch([session, on('getProfile', { displayName: 'Brand', avatar: 'https://cdn/a.jpg' })]);
    const ch = await connectBluesky({ handle: '@brand.bsky.social', appPassword: 'abcd-efgh-ijkl-mnop' }, f);
    expect(ch).toMatchObject({ externalId: 'did:plc:abc', name: 'Brand', handle: '@brand.bsky.social', credentials: { identifier: 'brand.bsky.social', appPassword: 'abcd-efgh-ijkl-mnop', service: 'https://bsky.social' } });
  });

  it('refuses a main password before calling Bluesky', async () => {
    const f = fakeFetch([]);
    await expect(connectBluesky({ handle: 'brand.bsky.social', appPassword: 'hunter2' }, f)).rejects.toBeInstanceOf(PermanentPublishError);
    expect(f.calls).toHaveLength(0);
  });

  it('uploads images, posts with facets and an image embed, then replies with the first comment', async () => {
    const f = fakeFetch([session, on('uploadBlob', { blob: { ref: 'b1' } }), on('createRecord', { uri: 'at://did:plc:abc/app.bsky.feed.post/3kx', cid: 'c1' })]);
    const r = await blueskyProvider.publish({ identifier: 'brand.bsky.social', appPassword: 'p', service: 'https://bsky.social' }, { text: 'Read https://a.co #tips', media: [png], firstComment: 'More below', settings: {} }, f);
    expect(r).toEqual({ externalId: 'at://did:plc:abc/app.bsky.feed.post/3kx', url: 'https://bsky.app/profile/brand.bsky.social/post/3kx' });
    const [post, reply] = f.calls.filter((c) => c.url.includes('createRecord')).map(json);
    expect(post.record.embed).toEqual({ $type: 'app.bsky.embed.images', images: [{ alt: 'Slide one', image: { ref: 'b1' }, aspectRatio: { width: 1080, height: 1350 } }] });
    expect(post.record.facets).toHaveLength(2);
    expect(reply.record.reply.parent).toEqual({ uri: 'at://did:plc:abc/app.bsky.feed.post/3kx', cid: 'c1' });
  });

  it('marks revoked credentials as expired', async () => {
    const f = fakeFetch([on('createSession', { error: 'AuthenticationRequired' }, 401)]);
    const err = await blueskyProvider.publish({ identifier: 'x', appPassword: 'y' }, { text: 'hi', media: [], settings: {} }, f).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PermanentPublishError);
    expect((err as PermanentPublishError).expired).toBe(true);
  });
});

describe('mastodon', () => {
  it('accepts OAuth state only when the nonce matches and it has not expired', () => {
    const state = JSON.stringify({ nonce: 'n1', clientId: 'c', instance: 'fosstodon.org', exp: 2000 });
    expect(checkState(state, 'n1', 1000)).toMatchObject({ clientId: 'c', instance: 'fosstodon.org' });
    expect(checkState(state, 'other', 1000)).toBeNull();
    expect(checkState(state, 'n1', 3000)).toBeNull();
    expect(checkState(state, null, 1000)).toBeNull();
    expect(checkState('not json', 'n1', 1000)).toBeNull();
    expect(checkState(JSON.stringify({ nonce: 'n1' }), 'n1', 1000)).toBeNull();
  });

  it('normalises instance input and rejects junk', () => {
    expect(normalizeInstance('https://Mastodon.Social/@me')).toBe('mastodon.social');
    expect(() => normalizeInstance('localhost')).toThrow();
    expect(() => normalizeInstance('http://10.0.0.1')).toThrow();
  });

  it('registers an app, builds the authorize URL and exchanges the code', async () => {
    const f = fakeFetch([
      on('/api/v1/apps', { client_id: 'cid', client_secret: 'sec' }),
      on('/oauth/token', { access_token: 'tok' }),
      on('verify_credentials', { id: '42', username: 'brand', acct: 'brand', display_name: 'Brand', avatar: 'https://cdn/a.png' }),
      on('/api/v2/instance', { configuration: { statuses: { max_characters: 1000 } } }),
    ]);
    const app = await registerApp('fosstodon.org', 'https://app/cb', 'https://app', f);
    expect(authorizeUrl('fosstodon.org', app.clientId, 'https://app/cb', 'st')).toContain('https://fosstodon.org/oauth/authorize?client_id=cid');
    const ch = await exchangeCode('fosstodon.org', app, 'code', 'https://app/cb', f);
    expect(ch).toMatchObject({ externalId: '42@fosstodon.org', handle: '@brand@fosstodon.org', credentials: { instance: 'fosstodon.org', accessToken: 'tok' }, settings: { maxChars: 1000 } });
  });

  it('uploads media then posts the status with an idempotency key and a reply', async () => {
    const f = fakeFetch([on('/api/v2/media', { id: 'm1' }), on('/api/v1/statuses', { id: 's1', url: 'https://fosstodon.org/@brand/s1' })]);
    const r = await mastodonProvider.publish({ instance: 'fosstodon.org', accessToken: 'tok' }, { text: 'Hello', media: [png], firstComment: 'reply', settings: { idempotencyKey: 'target-1' } }, f);
    expect(r).toEqual({ externalId: 's1', url: 'https://fosstodon.org/@brand/s1' });
    const statuses = f.calls.filter((c) => c.url.endsWith('/api/v1/statuses'));
    expect(json(statuses[0])).toMatchObject({ status: 'Hello', media_ids: ['m1'], visibility: 'public' });
    expect((statuses[0].init?.headers as Record<string, string>)['Idempotency-Key']).toBe('target-1');
    expect(json(statuses[1])).toMatchObject({ in_reply_to_id: 's1' });
  });
});

describe('telegram', () => {
  const token = '123456789:AAbbCCddEEffGGhhIIjjKKllMMnnOOppQQ';
  const ok = (result: unknown) => ({ ok: true, result });

  it('connects only when the bot can post in the channel', async () => {
    const good = fakeFetch([on('/getMe', ok({ id: 7, username: 'brandbot' })), on('/getChat', ok({ id: -100123, title: 'Brand News', username: 'brandnews', type: 'channel' })), on('/getChatMember', ok({ status: 'administrator', can_post_messages: true }))]);
    expect(await connectTelegram({ botToken: token, chat: '@brandnews' }, good)).toMatchObject({ externalId: '-100123', handle: '@brandnews', credentials: { botToken: token, chatId: '-100123' } });

    const member = fakeFetch([on('/getMe', ok({ id: 7, username: 'brandbot' })), on('/getChat', ok({ id: -100123, type: 'channel' })), on('/getChatMember', ok({ status: 'member' }))]);
    await expect(connectTelegram({ botToken: token, chat: '@brandnews' }, member)).rejects.toThrow('admin');
  });

  it('sends text alone, and a long caption as a separate message after the photo', async () => {
    const f = fakeFetch([on('/sendMessage', ok({ message_id: 9 })), on('/sendPhoto', ok({ message_id: 8 }))]);
    const r = await telegramProvider.publish({ botToken: token, chatId: '-100123' }, { text: 'x'.repeat(1500), media: [png], settings: { username: 'brandnews' } }, f);
    expect(r).toEqual({ externalId: '-100123:8', url: 'https://t.me/brandnews/8' });
    expect(f.calls.map((c) => c.url.split('/').pop())).toEqual(['sendPhoto', 'sendMessage']);
  });

  it('treats "chat not found" as permanent and rate limits as retryable', async () => {
    const notFound = fakeFetch([on('/sendMessage', { ok: false, description: 'Bad Request: chat not found' }, 400)]);
    await expect(telegramProvider.publish({ botToken: token, chatId: '1' }, { text: 'a', media: [], settings: {} }, notFound)).rejects.toBeInstanceOf(PermanentPublishError);
    const limited = fakeFetch([on('/sendMessage', { ok: false, description: 'Too Many Requests' }, 429)]);
    const err = await telegramProvider.publish({ botToken: token, chatId: '1' }, { text: 'a', media: [], settings: {} }, limited).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(PermanentPublishError);
  });
});

describe('discord', () => {
  const hook = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDEFGHIJ';

  it('validates the webhook URL before any request', async () => {
    const f = fakeFetch([]);
    await expect(connectDiscord({ webhookUrl: 'https://evil.example/api/webhooks/1/2' }, f)).rejects.toBeInstanceOf(PermanentPublishError);
    expect(f.calls).toHaveLength(0);
  });

  it('connects and publishes with files, without pinging anyone', async () => {
    const f = fakeFetch([on('?wait=true', { id: 'msg1', channel_id: 'ch1' }), on('/webhooks/', { name: 'Announcements', channel_id: 'ch1', guild_id: 'g1' })]);
    const ch = await connectDiscord({ webhookUrl: hook }, f);
    expect(ch).toMatchObject({ externalId: '123456789012345678', name: 'Announcements', settings: { guildId: 'g1' } });
    const r = await discordProvider.publish(ch.credentials, { text: 'Hello @everyone', media: [png], settings: { guildId: 'g1' } }, f);
    expect(r).toEqual({ externalId: 'msg1', url: 'https://discord.com/channels/g1/ch1/msg1' });
    const form = f.calls.at(-1)?.init?.body as FormData;
    expect(JSON.parse(String(form.get('payload_json')))).toEqual({ content: 'Hello @everyone', allowed_mentions: { parse: [] } });
    expect(form.get('files[0]')).toBeInstanceOf(Blob);
  });
});
