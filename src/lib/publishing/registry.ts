import type { NetworkId } from './networks';
import type { Provider } from './types';
import { blueskyProvider } from './providers/bluesky';
import { mastodonProvider } from './providers/mastodon';
import { telegramProvider } from './providers/telegram';
import { discordProvider } from './providers/discord';

/**
 * Adapters that can publish today. Networks listed in networks.ts without an
 * adapter here (the OAuth ones) are shown as "coming" until their adapter and
 * developer app credentials exist.
 */
const PROVIDERS: Partial<Record<NetworkId, Provider>> = {
  bluesky: blueskyProvider,
  mastodon: mastodonProvider,
  telegram: telegramProvider,
  discord: discordProvider,
};

export function getProvider(id: NetworkId): Provider | undefined {
  return PROVIDERS[id];
}

export function hasProvider(id: NetworkId): boolean {
  return id in PROVIDERS;
}
