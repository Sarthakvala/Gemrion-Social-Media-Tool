import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: LayoutProps<'/login'>) {
  return children;
}
