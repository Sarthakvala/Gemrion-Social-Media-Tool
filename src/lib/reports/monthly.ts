import type { Approval, PostStatus } from '@/lib/types';

export interface ReportPost {
  client_id: string;
  status: PostStatus;
  approval: Approval;
}

export interface ReportAsset {
  client_id: string;
  approval: Approval;
}

export interface ReportSpend {
  client_id: string | null;
  cost_usd: number;
  unpriced_jobs: number;
}

export interface BrandMonth {
  clientId: string;
  name: string;
  posts: number;
  published: number;
  scheduled: number;
  failed: number;
  postsApproved: number;
  postsPending: number;
  postsChanges: number;
  assets: number;
  assetsApproved: number;
  assetsPending: number;
  spendUsd: number;
  unpricedJobs: number;
}

const count = <T,>(rows: readonly T[], test: (r: T) => boolean) => rows.reduce((n, r) => n + (test(r) ? 1 : 0), 0);

/** One row per brand for the month, from rows already filtered to that month. */
export function buildMonthlyReport(
  clients: readonly { id: string; name: string }[],
  posts: readonly ReportPost[],
  assets: readonly ReportAsset[],
  spend: readonly ReportSpend[]
): BrandMonth[] {
  return clients.map((c) => {
    const p = posts.filter((x) => x.client_id === c.id);
    const a = assets.filter((x) => x.client_id === c.id);
    const s = spend.filter((x) => x.client_id === c.id);
    return {
      clientId: c.id,
      name: c.name,
      posts: p.length,
      published: count(p, (x) => x.status === 'published'),
      scheduled: count(p, (x) => x.status === 'scheduled'),
      failed: count(p, (x) => x.status === 'failed'),
      postsApproved: count(p, (x) => x.approval === 'approved'),
      postsPending: count(p, (x) => x.approval === 'pending'),
      postsChanges: count(p, (x) => x.approval === 'changes_requested'),
      assets: a.length,
      assetsApproved: count(a, (x) => x.approval === 'approved'),
      assetsPending: count(a, (x) => x.approval === 'pending'),
      spendUsd: s.reduce((n, x) => n + x.cost_usd, 0),
      unpricedJobs: s.reduce((n, x) => n + x.unpriced_jobs, 0),
    };
  });
}

/** Share of a month's posts the client has approved, 0-100; null when there is nothing to approve. */
export function approvalRate(row: Pick<BrandMonth, 'posts' | 'postsApproved'>): number | null {
  return row.posts ? Math.round((row.postsApproved / row.posts) * 100) : null;
}

/** First day of the current month (UTC) and of the next one, as ISO strings. */
export function monthWindow(now: Date = new Date()): { start: string; end: string; label: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start: start.toISOString(), end: end.toISOString(), label };
}
