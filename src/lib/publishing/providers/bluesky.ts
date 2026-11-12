import { detectFacets } from './facets';
import { PermanentPublishError, httpError, readJson, type ConnectedChannel, type FetchLike, type Provider, type PublishResult } from '../types';

// AT Protocol XRPC. Accounts hosted by Bluesky all sign in through the bsky.social
// entryway; a self-hosted PDS can set `service` in the credentials.
const DEFAULT_SERVICE = 'https://bsky.social';
const HANDLE = /^[a-z0-9.-]{3,253}$/i;
const APP_PASSWORD = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;

interface Session {
  accessJwt: string;
  did: string;
  handle: string;
}

async function createSession(service: string, identifier: string, password: string, fetcher: FetchLike): Promise<Session> {
  const res = await fetcher(`${service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    if (res.status === 401) throw new PermanentPublishError('Bluesky rejected the handle or app password. Reconnect the channel.', true);
    throw httpError('Bluesky', res, body);
  }
  return { accessJwt: String(body.accessJwt), did: String(body.did), handle: String(body.handle) };
}

/** Connect with a handle and an app password (Settings > Privacy and security > App passwords). No developer app. */
export async function connectBluesky(input: { handle: string; appPassword: string; service?: string }, fetcher: FetchLike = fetch): Promise<ConnectedChannel> {
  const handle = input.handle.trim().replace(/^@/, '');
  const appPassword = input.appPassword.trim();
  if (!HANDLE.test(handle)) throw new PermanentPublishError('Enter a Bluesky handle like name.bsky.social.');
  if (!APP_PASSWORD.test(appPassword)) throw new PermanentPublishError('Use an app password (xxxx-xxxx-xxxx-xxxx), not your main password.');
  const service = input.service?.trim() || DEFAULT_SERVICE;

  const session = await createSession(service, handle, appPassword, fetcher);
  const res = await fetcher(`${service}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(session.did)}`, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });
  const profile = res.ok ? await readJson(res) : {};
  return {
    externalId: session.did,
    name: String(profile.displayName || session.handle),
    handle: `@${session.handle}`,
    avatarUrl: typeof profile.avatar === 'string' ? profile.avatar : '',
    credentials: { identifier: session.handle, appPassword, service },
  };
}

function postUrl(handle: string, uri: string): string {
  return `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`;
}

export const blueskyProvider: Provider = {
  network: 'bluesky',
  async publish(credentials, input, fetcher = fetch): Promise<PublishResult> {
    const service = credentials.service || DEFAULT_SERVICE;
    const session = await createSession(service, credentials.identifier, credentials.appPassword, fetcher);
    const auth = { Authorization: `Bearer ${session.accessJwt}` };

    const images = [];
    for (const m of input.media) {
      const res = await fetcher(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': m.mime },
        body: m.bytes as BodyInit,
      });
      const body = await readJson(res);
      if (!res.ok) throw httpError('Bluesky', res, body);
      images.push({
        alt: m.alt.slice(0, 1000),
        image: body.blob,
        ...(m.width && m.height ? { aspectRatio: { width: m.width, height: m.height } } : {}),
      });
    }

    const createPost = async (text: string, extra: Record<string, unknown>) => {
      const res = await fetcher(`${service}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: { $type: 'app.bsky.feed.post', text, facets: detectFacets(text), createdAt: new Date().toISOString(), ...extra },
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw httpError('Bluesky', res, body);
      return { uri: String(body.uri), cid: String(body.cid) };
    };

    const root = await createPost(input.text, images.length ? { embed: { $type: 'app.bsky.embed.images', images } } : {});
    if (input.firstComment?.trim()) {
      // the post is already live: a failed reply must not make the whole publish fail and repeat
      await createPost(input.firstComment.trim(), { reply: { root, parent: root } }).catch(() => undefined);
    }
    return { externalId: root.uri, url: postUrl(session.handle, root.uri) };
  },
};
