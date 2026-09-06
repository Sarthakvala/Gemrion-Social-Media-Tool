import Link from 'next/link';
import type { Profile } from '@/lib/types';

/** Top bar shared by the console and the portal. */
export function Shell({
  profile,
  nav,
  children,
}: {
  profile: Profile;
  nav: { href: string; label: string; active?: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line bg-panel sticky top-0 z-20">
        <div className="max-w-[1180px] mx-auto px-5 h-[52px] flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="w-[9px] h-[9px] rounded-full bg-accent" />
            <span className="mono font-semibold tracking-tight">AGENCYFLOW</span>
          </Link>

          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-2.5 py-1 rounded text-[13px] ${
                  n.active
                    ? 'text-ink font-medium bg-canvas'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="mono text-faint hidden sm:inline">
              {profile.email}
            </span>
            <span
              className={`pill ${
                profile.role === 'agency' ? 'pill-scheduled' : 'pill-pending'
              }`}
            >
              {profile.role}
            </span>
            <form action="/auth/signout" method="post">
              <button className="btn btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1180px] w-full mx-auto px-5 py-7">
        {children}
      </main>
    </>
  );
}
