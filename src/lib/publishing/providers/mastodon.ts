import { PermanentPublishError, httpError, readJson, type ConnectedChannel, type FetchLike, type Provider, type PublishResult } from '../types';

// Mastodon lets any client register itself on an instance (POST /api/v1/apps),
// so connecting needs no developer portal: register once per instance, then a
// normal OAuth authorization-code flow against that instance.

export const MASTODON_SCOPES = 'read:accounts write:statuses write:media';
const INSTANCE = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
const MEDIA_POLL_MS = 1500;
const MEDIA_POLL_TRIES = 20;

/** "https://Mastodon.Social/@me" -> "mastodon.social"; throws on anything that is not a hostname. */
export function normalizeInstance(input: string): string {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#@]/)[0];
  if (!INSTANCE.test(host)) throw new PermanentPublishError('Enter a Mastodon server like mastodon.social.');
  return host;
}

export interface OAuthState {
  nonce: string;
  clientId: string;
  instance: string;
  exp: number;
}

/** Accepts the decrypted state only if it is well-formed, unexpired and matches the nonce the instance echoed back. */
export function checkState(decrypted: string, echoedNonce: string | null, now: number = Date.now()): OAuthState | null {
  if (!echoedNonce) return null;
  try {
    const s = JSON.parse(decrypted) as Partial<OAuthState>;
    const valid = typeof s.nonce === 'string' && typeof s.clientId === 'string' && typeof s.instance === 'string' && typeof s.exp === 'number';
    return valid && s.nonce === echoedNonce && s.exp! > now ? (s as OAuthState) : null;
  } catch {
    return null;
  }
}

export async function registerApp(instance: string, redirectUri: string, website: string, fetcher: FetchLike = fetch) {
  const res = await fetcher(`https://${instance}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'AgencyFlow', redirect_uris: redirectUri, scopes: MASTODON_SCOPES, website }),
  });
  const body = await readJson(res);
  if (!res.ok || !body.client_id || !body.client_secret) throw httpError('Mastodon', res, body);
  return { clientId: String(body.client_id), clientSecret: String(body.client_secret) };
}

export function authorizeUrl(instance: string, clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: MASTODON_SCOPES, state });
  return `https://${instance}/oauth/authorize?${q}`;
}

export async function exchangeCode(
  instance: string,
  app: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string,
  fetcher: FetchLike = fetch
): Promise<ConnectedChannel> {
  const tokenRes = await fetcher(`https://${instance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, scope: MASTODON_SCOPES }),
  });
  const token = await readJson(tokenRes);
  if (!tokenRes.ok || !token.access_token) throw httpError('Mastodon', tokenRes, token);
  const accessToken = String(token.access_token);

  const meRes = await fetcher(`https://${instance}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const me = await readJson(meRes);
  if (!meRes.ok) throw httpError('Mastodon', meRes, me);

  const maxChars = await instanceMaxChars(instance, fetcher);
  return {
    externalId: `${me.id}@${instance}`,
    name: String(me.display_name || me.username),
    handle: `@${me.acct}@${instance}`,
    avatarUrl: typeof me.avatar === 'string' ? me.avatar : '',
    credentials: { instance, accessToken },
    settings: { maxChars },
  };
}

/** Instances can raise the 500-character default; read it once at connect time. */
async function instanceMaxChars(instance: string, fetcher: FetchLike): Promise<number> {
  try {
    const res = await fetcher(`https://${instance}/api/v2/instance`);
    const body = (await readJson(res)) as { configuration?: { statuses?: { max_characters?: number } } };
    const n = body.configuration?.statuses?.max_characters;
    return typeof n === 'number' && n > 0 ? n : 500;
  } catch {
    return 500;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mastodonProvider: Provider = {
  network: 'mastodon',
  async publish(credentials, input, fetcher = fetch): Promise<PublishResult> {
    const base = `https://${credentials.instance}`;
    const auth = { Authorization: `Bearer ${credentials.accessToken}` };

    const mediaIds: string[] = [];
    for (const m of input.media) {
      const form = new FormData();
      form.append('file', new Blob([m.bytes as BlobPart], { type: m.mime }), m.filename);
      if (m.alt) form.append('description', m.alt.slice(0, 1500));
      const res = await fetcher(`${base}/api/v2/media`, { method: 'POST', headers: auth, body: form });
      const body = await readJson(res);
      if (!res.ok) throw httpError('Mastodon', res, body);
      // 202 means the server is still processing the file; it must finish before the status is posted
      if (res.status === 202) {
        let ready = false;
        for (let i = 0; i < MEDIA_POLL_TRIES && !ready; i++) {
          await sleep(MEDIA_POLL_MS);
          const poll = await fetcher(`${base}/api/v1/media/${body.id}`, { headers: auth });
          ready = poll.status === 200;
        }
        if (!ready) throw new Error('Mastodon: media is still processing; will retry.');
      }
      mediaIds.push(String(body.id));
    }

    const post = async (status: string, extra: Record<string, unknown>, key: string) => {
      const res = await fetcher(`${base}/api/v1/statuses`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ status, visibility: String(input.settings.visibility ?? 'public'), ...extra }),
      });
      const body = await readJson(res);
      if (!res.ok) throw httpError('Mastodon', res, body);
      return { id: String(body.id), url: typeof body.url === 'string' ? body.url : null };
    };

    const key = String(input.settings.idempotencyKey ?? '');
    const main = await post(input.text, mediaIds.length ? { media_ids: mediaIds } : {}, key || crypto.randomUUID());
    if (input.firstComment?.trim()) {
      await post(input.firstComment.trim(), { in_reply_to_id: main.id }, `${key || main.id}-reply`).catch(() => undefined);
    }
    return { externalId: main.id, url: main.url };
  },
};
