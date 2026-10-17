import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState } from '@/components/ui';
import { PhaseIntro } from '@/components/PhaseIntro';

export const metadata: Metadata = { title: 'Meta ads' };

type Account = { client_id: string; platform: string; connected: boolean; is_real: boolean; handle: string };

function metaStatus(accounts: Account[]): { label: string; tone: string } {
  const live = accounts.filter((a) => a.connected && a.is_real);
  if (live.length) return { label: `connected: ${live.map((a) => a.platform).join(' + ')}`, tone: 'text-published' };
  if (accounts.some((a) => a.connected)) return { label: 'demo connection only', tone: 'text-changes' };
  return { label: 'not connected', tone: 'text-faint' };
}

export default async function AdsPage() {
  const profile = await requireAgency();
  const admin = createAdminClient();
  const [{ data: clients }, { data: accounts }] = await Promise.all([
    admin.from('clients').select('id, name').order('name'),
    admin.from('social_accounts').select('client_id, platform, connected, is_real, handle').in('platform', ['FB', 'IG']),
  ]);

  return (
    <Shell profile={profile} groups={consoleNav('ads')}>
      <PhaseIntro
        title="Meta ads"
        phase="phase 3"
        lead="Ad creative and copy per brand, pushed to Meta as paused drafts so a person always switches on the spend, with results synced back for the monthly report."
        coming={[
          'Ad angles and 3-5 creative variants per angle (market-ads, paid-social-brief)',
          'UTM plan per campaign so results are attributable',
          'Push to Meta Ads Manager as PAUSED campaigns, ad sets and ads',
          'Daily insights sync: spend, CTR, CPC, CPA per creative, into Reports',
        ]}
        needs={[
          'A Meta app with ads_management and ads_read approved (App Review)',
          'Each brand: ad account id and the Facebook Page / Instagram account linked',
          'A business decision on which brands may have ads drafted',
        ]}
      />

      <h2 className="lbl mb-2">Meta connection per brand</h2>
      {(clients ?? []).length === 0 ? (
        <EmptyState title="No brands yet" />
      ) : (
        <div className="panel divide-y divide-line">
          {(clients ?? []).map((c) => {
            const s = metaStatus(((accounts ?? []) as Account[]).filter((a) => a.client_id === c.id));
            return (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[13.5px] font-medium flex-1">{c.name}</span>
                <span className={`mono ${s.tone}`}>{s.label}</span>
                <Link href="/console/clients" className="btn btn-ghost btn-sm">
                  Manage
                </Link>
              </div>
            );
          })}
        </div>
      )}
      <p className="mono text-faint mt-3">Organic posting connections are reused; ads need the extra ad-account permissions above.</p>
    </Shell>
  );
}
