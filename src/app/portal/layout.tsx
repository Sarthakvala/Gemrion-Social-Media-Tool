import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s · Client portal · AgencyFlow', default: 'Client portal' },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: LayoutProps<'/portal'>) {
  return children;
}
