import Link from 'next/link';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
} from 'date-fns';
import type { Post, Client } from '@/lib/types';

type PostRow = Post & { clients?: Pick<Client, 'name' | 'color'> | null };

/**
 * Month grid. Server-rendered; navigation is plain links carrying ?m=YYYY-MM
 * so it works without client JS and every month is a shareable URL.
 */
export function Calendar({
  posts,
  month,
  basePath,
}: {
  posts: PostRow[];
  month: Date;
  basePath: '/console/calendar' | '/portal/calendar';
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = new Map<string, PostRow[]>();
  for (const p of posts) {
    if (!p.scheduled_at) continue;
    const key = format(new Date(p.scheduled_at), 'yyyy-MM-dd');
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }

  const prev = format(addMonths(month, -1), 'yyyy-MM');
  const next = format(addMonths(month, 1), 'yyyy-MM');
  const postHref = basePath === '/console/calendar' ? '/console/posts' : '/portal/posts';

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {format(month, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-1 ml-auto">
          <Link href={`${basePath}?m=${prev}`} className="btn btn-ghost btn-sm">
            ←
          </Link>
          <Link href={basePath} className="btn btn-ghost btn-sm">
            Today
          </Link>
          <Link href={`${basePath}?m=${next}`} className="btn btn-ghost btn-sm">
            →
          </Link>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-canvas">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="lbl px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = byDay.get(key) ?? [];
            const dim = !isSameMonth(day, month);
            const today = isSameDay(day, new Date());

            return (
              <div
                key={key}
                className={`min-h-[104px] border-r border-b border-line p-1.5 last:border-r-0 ${
                  dim ? 'bg-canvas/60' : ''
                }`}
              >
                <div
                  className={`mono mb-1 ${
                    today
                      ? 'text-accent font-semibold'
                      : dim
                        ? 'text-faint'
                        : 'text-muted'
                  }`}
                >
                  {format(day, 'd')}
                </div>

                <div className="flex flex-col gap-1">
                  {items.slice(0, 3).map((p) => (
                    <Link
                      key={p.id}
                      href={`${postHref}/${p.id}`}
                      title={p.title || 'Untitled'}
                      className={`block text-[11px] leading-tight px-1.5 py-1 rounded border truncate hover:border-ink ${
                        p.enabled ? 'border-line-2' : 'border-failed gate-off'
                      }`}
                      style={
                        p.clients?.color
                          ? { borderLeft: `3px solid ${p.clients.color}` }
                          : undefined
                      }
                    >
                      {p.title || 'Untitled'}
                    </Link>
                  ))}
                  {items.length > 3 && (
                    <span className="mono text-faint px-1">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Parse ?m=YYYY-MM into a Date, defaulting to this month. */
export function monthFromParam(m?: string): Date {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1);
  }
  return startOfMonth(new Date());
}
