'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret } from '@/lib/ai/crypto';
import { assertPublic } from '@/lib/brand/site';
import { siteUrl } from '@/lib/site';
import { saveChannel } from '@/lib/publishing/channels';
import { connectBluesky } from '@/lib/publishing/providers/bluesky';
import { connectTelegram } from '@/lib/publishing/providers/telegram';
import { connectDiscord } from '@/lib/publishing/providers/discord';
import { authorizeUrl, normalizeInstance, registerApp } from '@/lib/publishing/providers/mastodon';
import { PermanentPublishError } from '@/lib/publishing/types';
import { MASTODON_STATE_COOKIE, MASTODON_STATE_INFO, mastodonRedirectUri, openMastodonApp, sealMastodonSecret } from '@/lib/publishing/mastodonState';

export interface ConnectResult {
  ok: boolean;
  message: string;
}

const Id = z.string().uuid();

async function brandFrom(formData: FormData): Promise<string | null> {
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(clientId).success) return null;
  const { data } = await createAdminClient().from('clients').select('id').eq('id', clientId).maybeSingle();
  return data ? clientId : null;
}

function failed(e: unknown): ConnectResult {
  if (e instanceof PermanentPublishError) return { ok: false, message: e.message };
  console.error('[channels]', e);
  return { ok: false, message: 'Could not reach the network. Try again in a minute.' };
}

function done(clientId: string, name: string): ConnectResult {
  revalidatePath(`/console/clients/${clientId}/channels`);
  return { ok: true, message: `Connected ${name}.` };
}

export async function connectBlueskyAction(_prev: ConnectResult | null, formData: FormData): Promise<ConnectResult> {
  const staff = await requireAgency();
  const clientId = await brandFrom(formData);
  if (!clientId) return { ok: false, message: 'Brand not found.' };
  try {
    const ch = await connectBluesky({ handle: String(formData.get('handle') || ''), appPassword: String(formData.get('app_password') || '') });
    await saveChannel(createAdminClient(), clientId, 'bluesky', ch, staff.id);
    return done(clientId, ch.handle);
  } catch (e) {
    return failed(e);
  }
}

export async function connectTelegramAction(_prev: ConnectResult | null, formData: FormData): Promise<ConnectResult> {
  const staff = await requireAgency();
  const clientId = await brandFrom(formData);
  if (!clientId) return { ok: false, message: 'Brand not found.' };
  try {
    const ch = await connectTelegram({ botToken: String(formData.get('bot_token') || ''), chat: String(formData.get('chat') || '') });
    await saveChannel(createAdminClient(), clientId, 'telegram', ch, staff.id);
    return done(clientId, ch.name);
  } catch (e) {
    return failed(e);
  }
}

export async function connectDiscordAction(_prev: ConnectResult | null, formData: FormData): Promise<ConnectResult> {
  const staff = await requireAgency();
  const clientId = await brandFrom(formData);
  if (!clientId) return { ok: false, message: 'Brand not found.' };
  try {
    const ch = await connectDiscord({ webhookUrl: String(formData.get('webhook_url') || '') });
    await saveChannel(createAdminClient(), clientId, 'discord', ch, staff.id);
    return done(clientId, ch.name);
  } catch (e) {
    return failed(e);
  }
}

/** Step 1 of Mastodon: register (or reuse) our app on the instance, then send the user to authorize. */
export async function startMastodonAction(_prev: ConnectResult | null, formData: FormData): Promise<ConnectResult> {
  await requireAgency();
  const clientId = await brandFrom(formData);
  if (!clientId) return { ok: false, message: 'Brand not found.' };

  let target: string;
  try {
    const instance = normalizeInstance(String(formData.get('instance') || ''));
    await assertPublic(new URL(`https://${instance}`));
    const redirectUri = mastodonRedirectUri();
    const admin = createAdminClient();

    let app = await openMastodonApp(admin, instance, redirectUri);
    if (!app) {
      app = await registerApp(instance, redirectUri, siteUrl().origin);
      const { error } = await admin.from('mastodon_apps').upsert({ instance, redirect_uri: redirectUri, client_id: app.clientId, client_secret: sealMastodonSecret(app.clientSecret) });
      if (error) throw new Error(error.message);
    }

    const nonce = randomBytes(16).toString('base64url');
    const state = encryptSecret(JSON.stringify({ nonce, clientId, instance, exp: Date.now() + 10 * 60_000 }), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', MASTODON_STATE_INFO);
    (await cookies()).set(MASTODON_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/channels/mastodon', maxAge: 600 });
    target = authorizeUrl(instance, app.clientId, redirectUri, nonce);
  } catch (e) {
    if (e instanceof Error && e.name === 'SiteError') return { ok: false, message: e.message };
    return failed(e);
  }
  redirect(target);
}

/** Keeps history (published links) but stops publishing and forgets the credentials. */
export async function disconnectChannel(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(id).success || !Id.safeParse(clientId).success) return;
  const admin = createAdminClient();
  await admin.from('channels').update({ status: 'disabled', secret: '' }).eq('id', id).eq('client_id', clientId);
  await admin.from('post_targets').update({ status: 'canceled', error: 'Channel disconnected.' }).eq('channel_id', id).eq('status', 'scheduled');
  revalidatePath(`/console/clients/${clientId}/channels`);
}
