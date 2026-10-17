import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState } from '@/components/ui';
import { PhaseIntro } from '@/components/PhaseIntro';

export const metadata: Metadata = { title: 'SEO · AEO · GEO' };

const TRACKS = [
  { name: 'SEO', what: 'Rank in classic search', how: 'Search Console data, technical audit, keyword briefs, articles, schema and Open Graph per page' },
  { name: 'AEO', what: 'Be the answer', how: 'A question bank per brand turned into FAQ and answer blocks with FAQPage / HowTo schema' },
  { name: 'GEO', what: 'Be cited by AI assistants', how: 'Weekly checks of Claude, GPT and Perplexity on the question bank: is the brand mentioned, cited, and where' },
];

export default async function SeoPage() {
  const profile = await requireAgency();
  const { data: brands } = await createAdminClient().from('clients').select('id, name, brand_profiles(industry, offer)').order('name');

  return (
    <Shell profile={profile} groups={consoleNav('seo')}>
      <PhaseIntro
        title="SEO · AEO · GEO"
        phase="phase 4"
        lead="Search work per brand across three tracks: ranking in Google, being the direct answer, and being cited by AI assistants. The AI visibility tracker is the differentiator; few tools measure it well."
        coming={[
          'Connect Google Search Console and GA4 per brand (read-only)',
          'Site audit and keyword briefs (market-seo), then article drafts as assets for approval',
          'Question bank and answer blocks with structured data, plus llms.txt',
          'AI visibility snapshots over time, reported monthly',
        ]}
        needs={[
          'Each brand: website URL and Search Console access for the agency Google account',
          'A DataForSEO account for keyword and SERP data (paid per call)',
          'API budget for the weekly AI visibility checks',
        ]}
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {TRACKS.map((t) => (
          <div key={t.name} className="panel p-4">
            <span className="mono font-semibold">{t.name}</span>
            <p className="font-medium text-[13.5px] mt-1">{t.what}</p>
            <p className="text-muted text-[13px] mt-1">{t.how}</p>
          </div>
        ))}
      </div>

      <h2 className="lbl mb-2">Brands</h2>
      {(brands ?? []).length === 0 ? (
        <EmptyState title="No brands yet" />
      ) : (
        <div className="panel divide-y divide-line">
          {(brands ?? []).map((b) => {
            const kit = (Array.isArray(b.brand_profiles) ? b.brand_profiles[0] : b.brand_profiles) as { industry?: string } | null;
            return (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[13.5px] font-medium flex-1">{b.name}</span>
                <span className="mono text-faint truncate max-w-[280px]">{kit?.industry || 'brand kit has no industry yet'}</span>
                <Link href={`/console/clients/${b.id}/brand`} className="btn btn-ghost btn-sm">
                  Brand kit
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
