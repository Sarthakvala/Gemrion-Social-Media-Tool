export type ConsoleSection = 'studio' | 'posts' | 'calendar' | 'clients' | 'settings';

export function consoleNav(active: ConsoleSection) {
  return [
    { href: '/console/studio', label: 'Studio', active: active === 'studio' },
    { href: '/console', label: 'Posts', active: active === 'posts' },
    { href: '/console/calendar', label: 'Calendar', active: active === 'calendar' },
    { href: '/console/clients', label: 'Brands', active: active === 'clients' },
    { href: '/console/settings', label: 'Settings', active: active === 'settings' },
  ];
}
