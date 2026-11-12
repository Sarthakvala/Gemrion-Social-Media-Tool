import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState } from '@/components/ui';
import { ConnectForms } from '@/components/publishing/ConnectForms';
import { PublishingSettings } from '@/components/publishing/PublishingSettings';
import { listChannels } from '@/lib/publishing/channels';
import { NETWORKS, isAvailable, needsDeveloperApp, network } from '@/lib/publishing/networks';
import { hasProvider } from '@/lib/publishing/registry';
import { disconnectChannel } from './actions';

export const metadata: Metadata = { title: 'Channels' };

const MASTODON_NOTE: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Mastodon connected.' },
  denied: { ok: false, text: 'Mastodon access was not approved.' },
  failed: { ok: false, text: 'Mastodon connection failed. Try again.' },
};

const STATUS_TONE: Record<string, string> = { active: 'text-published', expired: 'text-changes', error: 'text-failed', disabled: 'text-faint' };

export default async function ChannelsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mastodon?: string }> }) {
  const profile = await requireAgency();
  const { id } = await params;
  const { mastodon } = await searchParams;
  const admin = createAdminClient();

  const { data: brand } = await admin.from('clients').select('id, name').eq('id', id).maybeSingle();
  if (!brand) notFound();
  const [channels, { data: slots }, { data: signatures }, { data: groups }, { data: kit }] = await Promise.all([
    listChannels(admin, id),
    admin.from('posting_slots').select('id, weekday, local_time').eq('client_id', id).order('weekday').order('local_time'),
    admin.from('signatures').select('id, name, body, is_default').eq('client_id', id).order('name'),
    admin.from('hashtag_groups').select('id, name, tags').eq('client_id', id).order('name'),
    admin.from('brand_profiles').select('timezone').eq('client_id', id).maybeSingle(),
  ]);
  const note = mastodon ? MASTODON_NOTE[mastodon] : undefined;
  const live = channels.filter((c) => c.status !== 'disabled');
  const oauthNetworks = NETWORKS.filter(needsDeveloperApp);

  return (
    <Shell profile={profile} groups={consoleNav('clients')}>
      <Link href="/console/clients" className="mono text-muted hover:text-ink">
        ← brands
      </Link>
      <h1 className="text-[22px] font-semibold tracking-tight mt-2">{brand.name}: channels</h1>
      <p className="text-muted text-[13.5px] mt-1 mb-5 max-w-[720px]">
        Where this brand publishes. A brand can have several channels per network. Credentials are encrypted and never shown again.
      </p>
      {note && <div className={`panel p-3 mb-4 mono ${note.ok ? 'text-published' : 'text-failed'}`}>{note.text}</div>}

      <h2 className="lbl mb-2">Connected</h2>
      {live.length === 0 ? (
        <EmptyState title="No channels yet" hint="Connect one below. Bluesky, Mastodon, Telegram and Discord work today without any developer app." />
      ) : (
        <div className="panel divide-y divide-line mb-6">
          {live.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-canvas border border-line" />}
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium truncate">{c.name}</div>
                <div className="mono text-faint truncate">
                  {network(c.network).name} · {c.handle}
                </div>
                {c.last_error && <div className="mono text-failed truncate">{c.last_error}</div>}
              </div>
              <span className={`mono ${STATUS_TONE[c.status]}`}>{c.status === 'expired' ? 'reconnect needed' : c.status}</span>
              <form action={disconnectChannel}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="client_id" value={id} />
                <button className="btn btn-ghost btn-sm">Disconnect</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <h2 className="lbl mb-2">Connect (no developer app needed)</h2>
      <div className="mb-6">
        <ConnectForms clientId={id} />
      </div>

      <h2 className="lbl mb-2">Networks that need a developer app</h2>
      <div className="panel divide-y divide-line mb-6">
        {oauthNetworks.map((n) => {
          const ready = isAvailable(n);
          const built = hasProvider(n.id);
          return (
            <div key={n.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
              <span className="text-[13.5px] font-medium w-[170px]">{n.name}</span>
              <span className="mono text-faint flex-1 min-w-[200px]">{n.appEnv.join(', ')}</span>
              <span className={`mono ${ready && built ? 'text-published' : 'text-faint'}`}>
                {!ready ? 'app credentials not set' : built ? 'ready to connect' : 'credentials set, adapter in progress'}
              </span>
            </div>
          );
        })}
      </div>

      <PublishingSettings clientId={id} timezone={(kit?.timezone as string) || 'UTC'} slots={slots ?? []} signatures={signatures ?? []} groups={groups ?? []} />
    </Shell>
  );
}
