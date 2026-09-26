import { ASPECT_CLASS } from '@/lib/studio/urls';

export function SlidePreview({ urls, aspect }: { urls: string[]; aspect: string }) {
  if (urls.length === 0) {
    return (
      <div className={`${ASPECT_CLASS[aspect] ?? 'aspect-[4/5]'} grid place-items-center rounded-lg border border-dashed border-line-2 mono text-faint`}>
        no creative yet
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x">
      {urls.map((src, i) => (
        <figure key={src} className="shrink-0 w-[240px] snap-start">
          <div className={`${ASPECT_CLASS[aspect] ?? 'aspect-[4/5]'} relative rounded-lg overflow-hidden border border-line bg-canvas`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Slide ${i + 1}`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <figcaption className="flex items-center justify-between mt-1.5">
            <span className="mono text-faint">slide {i + 1}</span>
            {src.startsWith('/api/render') && (
              <a href={`${src}&download=1`} className="mono text-muted hover:text-ink">png ↓</a>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
