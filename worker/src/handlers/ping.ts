import { PermanentError, type Handler } from '../types.ts';

/**
 * Round-trip check for the whole pipeline: claim, write a small file to the
 * private assets bucket, record it as an asset, finish the job. If this works,
 * the same path works for rendered videos.
 */
export const pingHandler: Handler = async (job, ctx) => {
  if (!job.client_id) throw new PermanentError('A worker test needs a brand.');
  const at = new Date().toISOString();
  const body = [`AgencyFlow worker check`, `worker: ${ctx.workerId}`, `job: ${job.id}`, `attempt: ${job.attempts}`, `at: ${at}`, ''].join('\n');

  const { assetId, path } = await ctx.uploadAsset({
    clientId: job.client_id,
    jobId: job.id,
    fileName: 'worker-check.txt',
    body,
    contentType: 'text/plain',
    kind: 'document',
    title: `Worker check ${at.slice(0, 16).replace('T', ' ')}`,
    meta: { source: 'worker_ping' },
  });
  return { asset_id: assetId, path, worker: ctx.workerId, at };
};
