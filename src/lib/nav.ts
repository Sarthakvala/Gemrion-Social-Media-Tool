import type { NavGroup } from '@/components/Shell';

export type ConsoleSection =
  | 'studio'
  | 'playbooks'
  | 'video'
  | 'posts'
  | 'calendar'
  | 'ads'
  | 'seo'
  | 'assets'
  | 'reports'
  | 'jobs'
  | 'clients'
  | 'settings';

interface Entry {
  section: ConsoleSection;
  href: string;
  label: string;
  badge?: string;
}

/**
 * The console follows the monthly loop in the plan: create, publish, grow,
 * then measure. Sections that ship in a later phase carry a badge.
 */
const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Create',
    entries: [
      { section: 'studio', href: '/console/studio', label: 'Studio' },
      { section: 'playbooks', href: '/console/playbooks', label: 'Playbooks' },
      { section: 'video', href: '/console/video', label: 'Video & reels', badge: 'phase 2' },
    ],
  },
  {
    title: 'Publish',
    entries: [
      { section: 'posts', href: '/console', label: 'Posts' },
      { section: 'calendar', href: '/console/calendar', label: 'Calendar' },
    ],
  },
  {
    title: 'Grow',
    entries: [
      { section: 'ads', href: '/console/ads', label: 'Meta ads', badge: 'phase 3' },
      { section: 'seo', href: '/console/seo', label: 'SEO · AEO · GEO', badge: 'phase 4' },
    ],
  },
  {
    title: 'Library',
    entries: [
      { section: 'assets', href: '/console/assets', label: 'Assets' },
      { section: 'clients', href: '/console/clients', label: 'Brands' },
    ],
  },
  {
    title: 'Measure',
    entries: [
      { section: 'reports', href: '/console/reports', label: 'Reports' },
      { section: 'jobs', href: '/console/jobs', label: 'Jobs & spend' },
      { section: 'settings', href: '/console/settings', label: 'Settings' },
    ],
  },
];

export function consoleNav(active: ConsoleSection): NavGroup[] {
  return GROUPS.map((g) => ({
    title: g.title,
    items: g.entries.map((e) => ({ href: e.href, label: e.label, badge: e.badge, active: e.section === active })),
  }));
}

export type PortalSection = 'posts' | 'calendar' | 'files';

export function portalNav(active: PortalSection) {
  return [
    { href: '/portal', label: 'Your posts', active: active === 'posts' },
    { href: '/portal/calendar', label: 'Calendar', active: active === 'calendar' },
    { href: '/portal/assets', label: 'Files', active: active === 'files' },
  ];
}
