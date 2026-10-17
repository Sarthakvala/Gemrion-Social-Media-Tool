'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ASSET_BUCKET, ASSET_KINDS, MAX_ASSET_BYTES, formatBytes, kindFromMime, type AssetKind } from '@/lib/assets/paths';
import { finalizeUpload, requestUpload } from '@/app/console/assets/actions';

type Stage = 'idle' | 'signing' | 'uploading' | 'saving' | 'error';

const STAGE_LABEL: Record<Stage, string> = {
  idle: 'Upload',
  signing: 'Preparing…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  error: 'Upload',
};

/**
 * Two-step upload: the server signs a one-time URL, the browser sends the file
 * directly to Storage, then the server records it. Pass `parentId` (and the
 * fixed `clientId`) to upload a new version of an existing asset.
 */
export function AssetUploader({
  clients,
  clientId: fixedClientId,
  parentId,
}: {
  clients: { id: string; name: string }[];
  clientId?: string;
  parentId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(fixedClientId ?? clients[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AssetKind>('other');
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState('');

  const busy = stage === 'signing' || stage === 'uploading' || stage === 'saving';
  const tooBig = !!file && file.size > MAX_ASSET_BYTES;

  function pick(f: File | null) {
    setFile(f);
    setMessage('');
    if (!f) return;
    setKind(kindFromMime(f.type));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  function failWith(text: string) {
    setStage('error');
    setMessage(text);
  }

  async function upload() {
    if (!file || !clientId || tooBig) return;
    setStage('signing');
    const ticket = await requestUpload({ clientId, fileName: file.name, size: file.size });
    if (!ticket.ok || !ticket.path || !ticket.token) return failWith(ticket.message);

    setStage('uploading');
    const { error } = await createClient()
      .storage.from(ASSET_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || 'application/octet-stream' });
    if (error) return failWith(`Upload failed: ${error.message}`);

    setStage('saving');
    const saved = await finalizeUpload({ clientId, path: ticket.path, title, kind, parentId });
    if (!saved.ok || !saved.id) return failWith(saved.message);

    setStage('idle');
    setFile(null);
    setTitle('');
    router.push(`/console/assets/${saved.id}`);
    router.refresh();
  }

  return (
    <div className="panel p-4 flex flex-col gap-3">
      <span className="lbl">{parentId ? 'Upload a new version' : 'Add a file'}</span>

      {!fixedClientId && (
        <label className="flex flex-col gap-1">
          <span className="mono text-faint">Brand</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={busy}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <input type="file" onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={busy} />
      {file && (
        <span className={`mono ${tooBig ? 'text-failed' : 'text-faint'}`}>
          {file.type || 'unknown type'} · {formatBytes(file.size)}
          {tooBig && ' · over the 500 MB limit'}
        </span>
      )}

      <div className="grid grid-cols-[1fr_140px] gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={200} disabled={busy} />
        <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)} disabled={busy}>
          {ASSET_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-accent btn-sm" onClick={upload} disabled={busy || !file || !clientId || tooBig}>
          {STAGE_LABEL[stage]}
        </button>
        {message && <span className={`mono ${stage === 'error' ? 'text-failed' : 'text-faint'}`}>{message}</span>}
      </div>
    </div>
  );
}
