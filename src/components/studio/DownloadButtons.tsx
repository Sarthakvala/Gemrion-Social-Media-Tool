'use client';

import { useState } from 'react';
import { downloadMonth, downloadPost, type ZipPost } from '@/lib/studio/zip';

export function DownloadPostButton({ post, className = 'btn btn-ghost' }: { post: ZipPost; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      await downloadPost(post);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={className} onClick={run} disabled={busy || post.urls.length === 0}>
        {busy ? 'Zipping…' : 'Download post (.zip)'}
      </button>
      {error && <span className="mono text-failed">{error}</span>}
    </span>
  );
}

export function DownloadMonthButton({ posts, name }: { posts: ZipPost[]; name: string }) {
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState('');

  async function run() {
    setError('');
    setProgress(`0/${posts.length}`);
    try {
      await downloadMonth(posts, name, (d, t) => setProgress(`${d}/${t}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setProgress('');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn btn-ghost" onClick={run} disabled={!!progress || posts.length === 0}>
        {progress ? `Zipping ${progress}…` : `Download month (${posts.length} posts)`}
      </button>
      {error && <span className="mono text-failed">{error}</span>}
    </span>
  );
}
