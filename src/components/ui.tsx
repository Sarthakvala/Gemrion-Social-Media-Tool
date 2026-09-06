import type { Post, Platform } from '@/lib/types';

export function StatusPill({ value }: { value: string }) {
  return <span className={`pill pill-${value}`}>{value.replace('_', ' ')}</span>;
}

export function PlatformTags({ platforms }: { platforms: Platform[] }) {
  if (!platforms?.length) return <span className="mono text-faint">no platform</span>;
  return (
    <span className="flex gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className="mono text-[10px] px-1.5 py-[1px] rounded border border-line-2 text-ink-2"
        >
          {p}
        </span>
      ))}
    </span>
  );
}

/** Post creative: cover image, carousel count, or reel badge. */
export function Thumb({ post, size = 92 }: { post: Post; size?: number }) {
  const slideCount = post.slides?.length || (post.image_url ? 1 : 0);
  const isVideo = !!post.video_url;

  if (!post.image_url) {
    return (
      <div
        style={{ width: size, height: size }}
        className="shrink-0 grid place-items-center rounded-lg border border-dashed border-line-2 bg-canvas mono text-faint text-[9px] text-center leading-tight"
      >
        NO
        <br />
        CREATIVE
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0 rounded-lg overflow-hidden border border-line bg-canvas"
    >
      {/* plain img: these are Supabase Storage / remote URLs */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.image_url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {isVideo && (
        <span className="absolute inset-0 grid place-items-center bg-black/25 text-white text-lg">
          ▶
        </span>
      )}
      {slideCount > 1 && (
        <span className="absolute bottom-1 right-1 mono text-[9px] px-1.5 py-[1px] rounded bg-black/70 text-white">
          1/{slideCount}
        </span>
      )}
    </div>
  );
}

export function formatSlot(iso: string | null) {
  if (!iso) return 'unscheduled';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="panel p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="text-muted text-[13px] mt-1.5">{hint}</p>}
    </div>
  );
}
