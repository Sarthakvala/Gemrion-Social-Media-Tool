'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveTargets } from '@/app/console/posts/targets-actions';
import { validateForNetwork, networkLength } from '@/lib/publishing/text';
import { network, type NetworkId } from '@/lib/publishing/networks';

export interface ChannelOption {
  id: string;
  network: NetworkId;
  name: string;
  handle: string;
  defaultText: string;
  target: { text: string; firstComment: string; status: string } | null;
}

interface Props {
  postId: string;
  clientId: string;
  channels: ChannelOption[];
  imageCount: number;
  videoCount: number;
  hasPostTime: boolean;
}

type Row = { selected: boolean; text: string; firstComment: string; editing: boolean };
const LIVE = ['scheduled', 'publishing', 'published'];

/** Pick channels, tune text per network with live limits, then schedule at the post time, the next queue slot or now. */
export function TargetsPanel({ postId, clientId, channels, imageCount, videoCount, hasPostTime }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      channels.map((c) => [c.id, { selected: !!c.target && LIVE.includes(c.target.status), text: c.target?.text ?? '', firstComment: c.target?.firstComment ?? '', editing: !!c.target?.text }])
    )
  );
  const [when, setWhen] = useState<'post' | 'queue' | 'now'>(hasPostTime ? 'post' : 'queue');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const media = { images: imageCount, videos: videoCount, largestImageBytes: 0 };

  if (!channels.length) {
    return (
      <p className="text-muted text-[13px]">
        This brand has no connected channels.{' '}
        <Link className="underline" href={`/console/clients/${clientId}/channels`}>
          Connect channels
        </Link>
      </p>
    );
  }

  const set = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  function submit() {
    start(async () => {
      const r = await saveTargets({
        postId,
        when,
        channels: channels.map((c) => ({ channelId: c.id, selected: rows[c.id].selected, text: rows[c.id].editing ? rows[c.id].text : '', firstComment: rows[c.id].firstComment })),
      });
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {channels.map((c) => {
          const row = rows[c.id];
          const text = row.editing ? row.text : c.defaultText;
          const spec = network(c.network);
          const problems = row.selected ? validateForNetwork(c.network, text, media) : [];
          const length = networkLength(c.network, text);
          return (
            <li key={c.id} className={`border rounded-lg p-3 ${row.selected ? 'border-line-2' : 'border-line'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={row.selected} onChange={(e) => set(c.id, { selected: e.target.checked })} />
                <span className="font-medium text-[13.5px]">{c.name}</span>
                <span className="mono text-faint truncate">
                  {spec.name} · {c.handle}
                </span>
                <span className={`mono ml-auto ${length > spec.textLimit ? 'text-failed' : 'text-faint'}`}>
                  {length}/{spec.textLimit}
                </span>
              </label>
              {row.selected && (
                <div className="mt-2.5 flex flex-col gap-2">
                  {row.editing ? (
                    <textarea rows={4} value={row.text} onChange={(e) => set(c.id, { text: e.target.value })} aria-label={`Text for ${c.name}`} />
                  ) : (
                    <p className="text-[12.5px] text-ink-2 whitespace-pre-wrap bg-canvas rounded-md p-2.5 max-h-[140px] overflow-y-auto">{c.defaultText || '(no text)'}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(c.id, row.editing ? { editing: false, text: '' } : { editing: true, text: c.defaultText })}>
                      {row.editing ? 'Use the generated text' : 'Edit for this channel'}
                    </button>
                    {spec.firstComment && (
                      <input
                        className="flex-1 min-w-[200px]"
                        value={row.firstComment}
                        onChange={(e) => set(c.id, { firstComment: e.target.value })}
                        placeholder="First comment / reply (optional)"
                        maxLength={2000}
                      />
                    )}
                  </div>
                  {problems.map((p) => (
                    <span key={p} className="mono text-failed">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 flex-wrap">
        {(
          [
            ['post', 'At the post time', !hasPostTime],
            ['queue', 'Next queue slot', false],
            ['now', 'Now', false],
          ] as const
        ).map(([value, label, disabled]) => (
          <label key={value} className={`flex items-center gap-1.5 text-[13px] ${disabled ? 'opacity-50' : ''}`}>
            <input type="radio" name="when" checked={when === value} onChange={() => setWhen(value)} disabled={disabled} />
            {label}
          </label>
        ))}
        <button type="button" className="btn btn-accent btn-sm ml-auto" onClick={submit} disabled={saving || selectedCount === 0}>
          {saving ? 'Saving…' : `Schedule on ${selectedCount} channel${selectedCount === 1 ? '' : 's'}`}
        </button>
      </div>
      {message && <p className={`mono ${message.ok ? 'text-faint' : 'text-failed'}`}>{message.text}</p>}
    </div>
  );
}
