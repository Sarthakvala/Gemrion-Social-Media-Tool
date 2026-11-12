import { PermanentPublishError, httpError, readJson, type ConnectedChannel, type FetchLike, type Provider, type PublishResult } from '../types';

// Discord channel webhooks (Server Settings > Integrations > Webhooks): no bot,
// no developer app. The webhook URL itself is the credential.

const WEBHOOK = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/(\d{15,25})\/([A-Za-z0-9_-]{30,120})$/;

export async function connectDiscord(input: { webhookUrl: string }, fetcher: FetchLike = fetch): Promise<ConnectedChannel> {
  const url = input.webhookUrl.trim();
  const m = WEBHOOK.exec(url);
  if (!m) throw new PermanentPublishError('Paste a Discord webhook URL (https://discord.com/api/webhooks/...).');
  const res = await fetcher(url);
  const hook = await readJson(res);
  if (!res.ok) throw new PermanentPublishError('Discord rejected that webhook. Copy it again from the channel settings.', true);
  return {
    externalId: m[1],
    name: String(hook.name ?? 'Discord webhook'),
    handle: `#${hook.channel_id ?? ''}`,
    avatarUrl: '',
    credentials: { webhookUrl: url },
    settings: { guildId: hook.guild_id ?? '', channelId: hook.channel_id ?? '' },
  };
}

export const discordProvider: Provider = {
  network: 'discord',
  async publish(credentials, input, fetcher = fetch): Promise<PublishResult> {
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content: input.text, allowed_mentions: { parse: [] } }));
    input.media.slice(0, 10).forEach((m, i) => form.append(`files[${i}]`, new Blob([m.bytes as BlobPart], { type: m.mime }), m.filename));

    const res = await fetcher(`${credentials.webhookUrl}?wait=true`, { method: 'POST', body: form });
    const body = await readJson(res);
    if (!res.ok) throw httpError('Discord', res, body);

    const guild = String(input.settings.guildId ?? '');
    const url = guild && body.channel_id ? `https://discord.com/channels/${guild}/${body.channel_id}/${body.id}` : null;
    return { externalId: String(body.id), url };
  },
};
