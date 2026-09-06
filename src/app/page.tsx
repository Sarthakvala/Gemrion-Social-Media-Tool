import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

/** Front door: agency staff get the console, clients get their portal. */
export default async function Home() {
  const profile = await requireUser();
  redirect(profile.role === 'agency' ? '/console' : '/portal');
}
