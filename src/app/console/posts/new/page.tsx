import Link from 'next/link';
import { requireAgency, getVisibleClients } from '@/lib/auth';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { PostForm } from '@/components/PostForm';
import { EmptyState } from '@/components/ui';

export default async function NewPostPage() {
  const profile = await requireAgency();
  const clients = await getVisibleClients();

  return (
    <Shell
      profile={profile}
      nav={consoleNav('posts')}
    >
      <Link href="/console" className="mono text-muted hover:text-ink">
        ← back to posts
      </Link>
      <h1 className="text-[22px] font-semibold tracking-tight mt-3 mb-5">New post</h1>

      {clients.length === 0 ? (
        <EmptyState
          title="Add a client first"
          hint="A post has to belong to a client workspace."
        />
      ) : (
        <PostForm post={null} clients={clients} />
      )}
    </Shell>
  );
}
