import type { Metadata } from 'next';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { EmptyState } from '@/components/ui';
import { spendSince } from '@/lib/jobs/repo';
import { approvalRate, buildMonthlyReport, monthWindow, type ReportAsset, type ReportPost } from '@/lib/reports/monthly';

export const metadata: Metadata = { title: 'Reports' };

function money(n: number): string {
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

export default async function ReportsPage() {
  const profile = await requireAgency();
  const admin = createAdminClient();
  const month = monthWindow();

  const [{ data: clients }, { data: posts }, { data: assets }, spend] = await Promise.all([
    admin.from('clients').select('id, name').order('name'),
    admin.from('posts').select('client_id, status, approval').gte('scheduled_at', month.start).lt('scheduled_at', month.end),
    admin.from('assets').select('client_id, approval').gte('created_at', month.start).lt('created_at', month.end),
    spendSince(admin, month.start),
  ]);

  const rows = buildMonthlyReport(clients ?? [], (posts ?? []) as ReportPost[], (assets ?? []) as ReportAsset[], spend);
  const totals = rows.reduce((t, r) => ({ posts: t.posts + r.posts, published: t.published + r.published, spend: t.spend + r.spendUsd }), { posts: 0, published: 0, spend: 0 });

  return (
    <Shell profile={profile} groups={consoleNav('reports')}>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight">Reports</h1>
        <span className="mono text-muted">{month.label}</span>
      </div>
      <p className="text-muted text-[13.5px] mt-1 mb-5 max-w-[720px]">
        What each brand got this month, from live data. Social reach, ad results and search metrics join this table as phases 3 and 4 connect them; the client-ready PDF comes in phase 5.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-5 max-w-[640px]">
        {[
          { label: 'Posts this month', value: String(totals.posts) },
          { label: 'Published', value: String(totals.published) },
          { label: 'AI spend', value: money(totals.spend) },
        ].map((k) => (
          <div key={k.label} className="panel p-3.5">
            <span className="lbl">{k.label}</span>
            <div className="text-[24px] font-semibold tracking-tight mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No brands yet" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-line">
                {['Brand', 'Posts', 'Published', 'Scheduled', 'Failed', 'Client approved', 'Changes asked', 'Files', 'Files approved', 'AI spend'].map((h) => (
                  <th key={h} className="lbl px-3 py-2 font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rate = approvalRate(r);
                return (
                  <tr key={r.clientId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 mono">{r.posts}</td>
                    <td className="px-3 py-2 mono">{r.published}</td>
                    <td className="px-3 py-2 mono">{r.scheduled}</td>
                    <td className={`px-3 py-2 mono ${r.failed ? 'text-failed' : ''}`}>{r.failed}</td>
                    <td className="px-3 py-2 mono">
                      {r.postsApproved}
                      {rate !== null && <span className="text-faint"> ({rate}%)</span>}
                    </td>
                    <td className={`px-3 py-2 mono ${r.postsChanges ? 'text-changes' : ''}`}>{r.postsChanges}</td>
                    <td className="px-3 py-2 mono">{r.assets}</td>
                    <td className="px-3 py-2 mono">{r.assetsApproved}</td>
                    <td className="px-3 py-2 mono">
                      {money(r.spendUsd)}
                      {r.unpricedJobs > 0 && <span className="text-faint"> +{r.unpricedJobs} unpriced</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mono text-faint mt-3">Posts count by scheduled date; files by upload date; spend by job date (UTC).</p>
    </Shell>
  );
}
