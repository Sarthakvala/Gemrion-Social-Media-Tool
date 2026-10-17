import Link from 'next/link';
import type { Profile } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  active?: boolean;
  /** Shown as a quiet tag, e.g. the phase a section ships in. */
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="w-[9px] h-[9px] rounded-full bg-accent" />
      <span className="mono font-semibold tracking-tight">AGENCYFLOW</span>
    </Link>
  );
}

function Account({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3">
      <span className="mono text-faint hidden sm:inline truncate max-w-[200px]">{profile.email}</span>
      <span className={`pill hidden sm:inline-flex ${profile.role === 'agency' ? 'pill-scheduled' : 'pill-pending'}`}>{profile.role}</span>
      <form action="/auth/signout" method="post">
        <button className="btn btn-ghost btn-sm" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}

function ItemLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-[13px] ${
        item.active ? 'text-ink font-medium bg-canvas' : 'text-muted hover:text-ink'
      }`}
    >
      <span>{item.label}</span>
      {item.badge && <span className="mono text-[9.5px] text-faint uppercase">{item.badge}</span>}
    </Link>
  );
}

/**
 * Shared frame. Pass `groups` for the console (grouped sidebar, collapses to a
 * menu on phones) or flat `nav` for the client portal's top bar.
 */
export function Shell({
  profile,
  nav,
  groups,
  children,
}: {
  profile: Profile;
  nav?: NavItem[];
  groups?: NavGroup[];
  children: React.ReactNode;
}) {
  if (!groups) {
    return (
      <>
        <header className="border-b border-line bg-panel sticky top-0 z-20">
          <div className="max-w-[1180px] mx-auto px-5 h-[52px] flex items-center gap-6">
            <Brand />
            <nav className="flex items-center gap-1 overflow-x-auto">
              {(nav ?? []).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-2.5 py-1 rounded text-[13px] whitespace-nowrap ${n.active ? 'text-ink font-medium bg-canvas' : 'text-muted hover:text-ink'}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <Account profile={profile} />
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-[1180px] w-full mx-auto px-5 py-7">{children}</main>
      </>
    );
  }

  const current = groups.flatMap((g) => g.items).find((i) => i.active);
  const sections = groups.map((g) => (
    <div key={g.title} className="flex flex-col gap-0.5">
      <span className="lbl px-2.5 mb-1">{g.title}</span>
      {g.items.map((i) => (
        <ItemLink key={i.href} item={i} />
      ))}
    </div>
  ));

  return (
    <>
      <header className="border-b border-line bg-panel sticky top-0 z-20">
        <div className="px-4 sm:px-5 h-[52px] flex items-center gap-3 sm:gap-4">
          <Brand />
          {/* phones: the sidebar becomes a menu */}
          <details className="lg:hidden relative">
            <summary className="btn btn-ghost btn-sm list-none cursor-pointer">{current?.label ?? 'Menu'} ▾</summary>
            <nav aria-label="Console" className="absolute left-0 mt-2 w-[240px] panel p-3 flex flex-col gap-4 shadow-lg z-30">
              {sections}
            </nav>
          </details>
          <div className="ml-auto">
            <Account profile={profile} />
          </div>
        </div>
      </header>
      <div className="flex-1 flex w-full">
        <nav aria-label="Console" className="hidden lg:flex flex-col gap-5 w-[212px] shrink-0 border-r border-line bg-panel px-3 py-5 sticky top-[52px] h-[calc(100vh-52px)] overflow-y-auto">
          {sections}
        </nav>
        <main className="flex-1 min-w-0 max-w-[1180px] w-full mx-auto px-5 py-7">{children}</main>
      </div>
    </>
  );
}
