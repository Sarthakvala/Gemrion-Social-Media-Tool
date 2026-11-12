import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/ai/crypto';
import type { NetworkId } from './networks';
import type { ConnectedChannel } from './types';

/** Channel credentials get their own key domain, separate from AI keys. */
const CHANNEL_KEY_INFO = 'agencyflow/channels/v1';

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function sealCredentials(credentials: Record<string, string>): string {
  return encryptSecret(JSON.stringify(credentials), secret(), CHANNEL_KEY_INFO);
}

export function openCredentials(sealed: string): Record<string, string> {
  return JSON.parse(decryptSecret(sealed, secret(), CHANNEL_KEY_INFO) || '{}') as Record<string, string>;
}

/** A channel as the UI sees it: never includes the sealed credentials. */
export interface ChannelRow {
  id: string;
  client_id: string;
  network: NetworkId;
  name: string;
  handle: string;
  avatar_url: string;
  external_id: string;
  status: 'active' | 'expired' | 'error' | 'disabled';
  settings: Record<string, unknown>;
  last_error: string | null;
  created_at: string;
}

const PUBLIC_COLUMNS = 'id, client_id, network, name, handle, avatar_url, external_id, status, settings, last_error, created_at';

/** Insert or refresh a channel (reconnecting the same account updates it instead of duplicating). */
export async function saveChannel(db: SupabaseClient, clientId: string, networkId: NetworkId, ch: ConnectedChannel, userId: string): Promise<string> {
  const { data, error } = await db
    .from('channels')
    .upsert(
      {
        client_id: clientId,
        network: networkId,
        external_id: ch.externalId,
        name: ch.name.slice(0, 200),
        handle: ch.handle.slice(0, 200),
        avatar_url: /^https:\/\//.test(ch.avatarUrl) ? ch.avatarUrl : '',
        secret: sealCredentials(ch.credentials),
        settings: ch.settings ?? {},
        status: 'active',
        last_error: null,
        connected_by: userId,
      },
      { onConflict: 'client_id,network,external_id' }
    )
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not save the channel: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

export async function listChannels(db: SupabaseClient, clientId: string): Promise<ChannelRow[]> {
  const { data, error } = await db.from('channels').select(PUBLIC_COLUMNS).eq('client_id', clientId).order('network').order('name');
  if (error) throw new Error(`Could not load channels: ${error.message}`);
  return (data ?? []) as ChannelRow[];
}
