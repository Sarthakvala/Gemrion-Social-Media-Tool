import { describe, expect, it } from 'vitest';
import { approvalRate, buildMonthlyReport, monthWindow } from './monthly';

const clients = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
];

describe('buildMonthlyReport', () => {
  it('counts posts, approvals, assets and spend per brand', () => {
    const rows = buildMonthlyReport(
      clients,
      [
        { client_id: 'a', status: 'published', approval: 'approved' },
        { client_id: 'a', status: 'scheduled', approval: 'pending' },
        { client_id: 'a', status: 'failed', approval: 'changes_requested' },
        { client_id: 'b', status: 'draft', approval: 'pending' },
      ],
      [
        { client_id: 'a', approval: 'approved' },
        { client_id: 'b', approval: 'pending' },
      ],
      [
        { client_id: 'a', cost_usd: 0.12, unpriced_jobs: 0 },
        { client_id: 'a', cost_usd: 0.03, unpriced_jobs: 2 },
        { client_id: null, cost_usd: 9, unpriced_jobs: 0 },
      ]
    );
    expect(rows[0]).toMatchObject({ name: 'Alpha', posts: 3, published: 1, scheduled: 1, failed: 1, postsApproved: 1, postsPending: 1, postsChanges: 1, assets: 1, assetsApproved: 1, unpricedJobs: 2 });
    expect(rows[0].spendUsd).toBeCloseTo(0.15);
    expect(rows[1]).toMatchObject({ posts: 1, postsPending: 1, assetsPending: 1, spendUsd: 0 });
  });

  it('keeps brands with no activity, with zeros', () => {
    expect(buildMonthlyReport(clients, [], [], [])[1]).toMatchObject({ name: 'Beta', posts: 0, assets: 0, spendUsd: 0 });
  });
});

describe('approvalRate', () => {
  it('is a whole percentage, or null with nothing to approve', () => {
    expect(approvalRate({ posts: 3, postsApproved: 2 })).toBe(67);
    expect(approvalRate({ posts: 0, postsApproved: 0 })).toBeNull();
  });
});

describe('monthWindow', () => {
  it('spans the calendar month in UTC, including across a year end', () => {
    expect(monthWindow(new Date('2026-12-17T10:00:00Z'))).toEqual({
      start: '2026-12-01T00:00:00.000Z',
      end: '2027-01-01T00:00:00.000Z',
      label: 'December 2026',
    });
  });
});
