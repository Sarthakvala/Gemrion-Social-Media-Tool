'use client';

import { useActionState } from 'react';
import {
  connectBlueskyAction,
  connectDiscordAction,
  connectTelegramAction,
  startMastodonAction,
  type ConnectResult,
} from '@/app/console/clients/[id]/channels/actions';

type Action = (prev: ConnectResult | null, formData: FormData) => Promise<ConnectResult>;

function ConnectCard({
  clientId,
  title,
  help,
  action,
  submit,
  children,
}: {
  clientId: string;
  title: string;
  help: React.ReactNode;
  action: Action;
  submit: string;
  children: React.ReactNode;
}) {
  const [state, run, pending] = useActionState<ConnectResult | null, FormData>(action, null);
  return (
    <form action={run} className="panel p-4 flex flex-col gap-2.5">
      <input type="hidden" name="client_id" value={clientId} />
      <div>
        <span className="font-medium text-[14px]">{title}</span>
        <p className="text-muted text-[12.5px] mt-0.5">{help}</p>
      </div>
      {children}
      <div className="flex items-center gap-3">
        <button className="btn btn-sm" disabled={pending}>
          {pending ? 'Checking…' : submit}
        </button>
        {state && <span className={`mono ${state.ok ? 'text-published' : 'text-failed'}`}>{state.message}</span>}
      </div>
    </form>
  );
}

/** Networks that connect without any developer app: Bluesky, Mastodon, Telegram, Discord. */
export function ConnectForms({ clientId }: { clientId: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <ConnectCard
        clientId={clientId}
        title="Bluesky"
        help={<>In Bluesky: Settings &gt; Privacy and security &gt; App passwords &gt; Add. Never use the main password.</>}
        action={connectBlueskyAction}
        submit="Connect Bluesky"
      >
        <input name="handle" placeholder="brand.bsky.social" required autoComplete="off" />
        <input name="app_password" placeholder="xxxx-xxxx-xxxx-xxxx" required autoComplete="off" />
      </ConnectCard>

      <ConnectCard
        clientId={clientId}
        title="Mastodon"
        help="Any server. AgencyFlow registers itself on the server automatically, then you approve access there."
        action={startMastodonAction}
        submit="Continue to Mastodon"
      >
        <input name="instance" placeholder="mastodon.social" required autoComplete="off" />
      </ConnectCard>

      <ConnectCard
        clientId={clientId}
        title="Telegram channel"
        help={<>Create a bot with @BotFather, add it to the channel as an admin with &quot;Post messages&quot;, then paste its token.</>}
        action={connectTelegramAction}
        submit="Connect Telegram"
      >
        <input name="bot_token" placeholder="123456789:ABC..." required autoComplete="off" />
        <input name="chat" placeholder="@channelname" required autoComplete="off" />
      </ConnectCard>

      <ConnectCard
        clientId={clientId}
        title="Discord channel"
        help="Server Settings > Integrations > Webhooks > New webhook, pick the channel, Copy webhook URL."
        action={connectDiscordAction}
        submit="Connect Discord"
      >
        <input name="webhook_url" placeholder="https://discord.com/api/webhooks/..." required autoComplete="off" />
      </ConnectCard>
    </div>
  );
}
