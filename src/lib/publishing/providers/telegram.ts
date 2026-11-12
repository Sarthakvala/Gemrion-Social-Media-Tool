import { network } from '../networks';
import { PermanentPublishError, readJson, type ConnectedChannel, type FetchLike, type Provider, type PublishResult } from '../types';

// Telegram channels and groups via a bot made with @BotFather (no developer app,
// no review). The bot must be an admin of the channel with "Post messages".

const TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
const API = 'https://api.telegram.org';

type TgResult = { ok: boolean; result?: Record<string, unknown>; description?: string; error_code?: number };

async function call(token: string, method: string, body: BodyInit | Record<string, unknown>, fetcher: FetchLike): Promise<Record<string, unknown>> {
  const isForm = body instanceof FormData;
  const res = await fetcher(`${API}/bot${token}/${method}`, {
    method: 'POST',
    ...(isForm ? { body } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = (await readJson(res)) as TgResult;
  if (!data.ok) {
    const msg = `Telegram: ${data.description ?? `HTTP ${res.status}`}`;
    if (res.status === 401) throw new PermanentPublishError(msg, true);
    // 429 and 5xx are worth retrying; other 4xx (chat not found, not admin, bad request) are not
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new PermanentPublishError(msg);
    throw new Error(msg);
  }
  return (data.result ?? {}) as Record<string, unknown>;
}

/** Validates the bot token and that the bot can post in the chat (@channelname or numeric id). */
export async function connectTelegram(input: { botToken: string; chat: string }, fetcher: FetchLike = fetch): Promise<ConnectedChannel> {
  const botToken = input.botToken.trim();
  const chat = input.chat.trim();
  if (!TOKEN.test(botToken)) throw new PermanentPublishError('That does not look like a BotFather token (123456:ABC...).');
  if (!/^(@[A-Za-z0-9_]{5,32}|-?\d{5,20})$/.test(chat)) throw new PermanentPublishError('Enter the channel as @channelname or its numeric id.');

  const me = await call(botToken, 'getMe', {}, fetcher);
  const info = await call(botToken, 'getChat', { chat_id: chat }, fetcher);
  const member = await call(botToken, 'getChatMember', { chat_id: chat, user_id: me.id }, fetcher);
  const canPost = member.status === 'creator' || (member.status === 'administrator' && (info.type !== 'channel' || member.can_post_messages !== false));
  if (!canPost) throw new PermanentPublishError(`Make @${me.username} an admin of the channel with permission to post, then try again.`);

  return {
    externalId: String(info.id),
    name: String(info.title ?? info.username ?? chat),
    handle: info.username ? `@${info.username}` : String(info.id),
    avatarUrl: '',
    credentials: { botToken, chatId: String(info.id) },
    settings: { username: info.username ?? '' },
  };
}

function messageUrl(settings: Record<string, unknown>, messageId: unknown): string | null {
  const username = typeof settings.username === 'string' ? settings.username : '';
  return username ? `https://t.me/${username}/${messageId}` : null;
}

export const telegramProvider: Provider = {
  network: 'telegram',
  async publish(credentials, input, fetcher = fetch): Promise<PublishResult> {
    const { botToken, chatId } = credentials;
    const captionLimit = network('telegram').captionLimit ?? 1024;
    const text = input.text;
    let first: Record<string, unknown>;

    if (input.media.length === 0) {
      first = await call(botToken, 'sendMessage', { chat_id: chatId, text }, fetcher);
    } else {
      // a caption over 1024 chars cannot ride on the media; send it as its own message after
      const caption = text.length <= captionLimit ? text : '';
      const form = new FormData();
      form.append('chat_id', chatId);
      if (input.media.length === 1) {
        const m = input.media[0];
        form.append('photo', new Blob([m.bytes as BlobPart], { type: m.mime }), m.filename);
        if (caption) form.append('caption', caption);
        first = await call(botToken, 'sendPhoto', form, fetcher);
      } else {
        const media = input.media.slice(0, 10).map((m, i) => ({ type: 'photo', media: `attach://file${i}`, ...(i === 0 && caption ? { caption } : {}) }));
        form.append('media', JSON.stringify(media));
        input.media.slice(0, 10).forEach((m, i) => form.append(`file${i}`, new Blob([m.bytes as BlobPart], { type: m.mime }), m.filename));
        const sent = (await call(botToken, 'sendMediaGroup', form, fetcher)) as unknown as Record<string, unknown>[];
        first = Array.isArray(sent) ? sent[0] : sent;
      }
      if (!caption && text.trim()) await call(botToken, 'sendMessage', { chat_id: chatId, text }, fetcher);
    }

    const settings = { username: credentials.username ?? input.settings.username ?? '' };
    return { externalId: `${chatId}:${first.message_id}`, url: messageUrl(settings, first.message_id) };
  },
};
