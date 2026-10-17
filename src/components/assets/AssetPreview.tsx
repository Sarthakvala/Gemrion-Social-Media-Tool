import type { Asset } from '@/lib/types';

/** Renders an asset from a signed URL: image, video, audio, PDF, or a download link. */
export function AssetPreview({ asset, url, compact = false }: { asset: Pick<Asset, 'kind' | 'mime' | 'title'>; url?: string; compact?: boolean }) {
  const frame = compact ? 'aspect-square' : 'max-h-[70vh]';

  if (!url) {
    return <div className={`${frame} grid place-items-center rounded-lg border border-dashed border-line-2 mono text-faint`}>preview unavailable</div>;
  }
  if (asset.mime.startsWith('image/')) {
    // signed Storage URLs: plain img, next/image cannot optimise expiring links
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={asset.title} className={`w-full ${compact ? 'aspect-square object-cover' : 'max-h-[70vh] object-contain'} rounded-lg bg-canvas`} loading="lazy" />;
  }
  if (asset.mime.startsWith('video/')) {
    return compact ? (
      <div className="aspect-square grid place-items-center rounded-lg bg-ink text-white text-2xl">▶</div>
    ) : (
      <video src={url} controls preload="metadata" className="w-full max-h-[70vh] rounded-lg bg-black" />
    );
  }
  if (asset.mime.startsWith('audio/') && !compact) {
    return <audio src={url} controls className="w-full" />;
  }
  if (asset.mime === 'application/pdf' && !compact) {
    return <iframe src={url} title={asset.title} className="w-full h-[70vh] rounded-lg border border-line" />;
  }
  return (
    <div className={`${compact ? 'aspect-square' : 'py-10'} grid place-items-center rounded-lg border border-line bg-canvas`}>
      <span className="mono text-faint uppercase">{asset.kind}</span>
    </div>
  );
}
