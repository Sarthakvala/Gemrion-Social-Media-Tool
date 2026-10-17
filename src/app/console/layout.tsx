import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { template: '%s · Console · AgencyFlow', default: 'Console' },
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: LayoutProps<'/console'>) {
  return children;
}
