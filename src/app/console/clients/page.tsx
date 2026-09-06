import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shell } from '@/components/Shell';
import { EmptyState } from '@/components/ui';
import { PLATFORMS, PLATFORM_NAMES, type Client } from '@/lib/types';
import {
  createClientAction,
  inviteUserAction,
  removeUserAction,
  deleteClientAction,
} from './actions';

export default async function ClientsPage() {
  const profile = await requireAgency();

  const admin = createAdminClient();
  const [{ data: clients }, { data: accounts }, { data: access }, { data: counts }] =
    await Promise.all([
      admin.from('clients').select('id, name, color, created_at').order('name'),
      admin.from('social_accounts').select('id, client_id, platform, connected, handle, is_real'),
      admin.from('client_users').select('user_id, client_id, profiles(id, email)'),
      admin.from('posts').select('client_id'),
    ]);

  const postCount = new Map<string, number>();
  for (const row of counts ?? []) {
    postCount.set(row.client_id, (postCount.get(row.client_id) ?? 0) + 1);
  }

  return (
    <Shell
      profile={profile}
      nav={[
        { href: '/console', label: 'Posts' },
        { href: '/console/calendar', label: 'Calendar' },
        { href: '/console/clients', label: 'Clients', active: true },
      ]}
    >
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Clients</h1>
          <p className="text-muted text-[13.5px] mt-1">
            Each client is a workspace with its own connected accounts and portal users.
          </p>
        </div>
      </div>

      {/* Create client form */}
      <form action={createClientAction} className="panel p-4 mb-5">
        <span className="lbl">Add new client</span>
        <div className="flex gap-2.5 mt-2 items-end">
          <div className="flex-1">
            <input
              name="name"
              placeholder="Client name"
              required
            />
          </div>
          <div className="w-20">
            <input
              name="color"
              type="color"
              defaultValue="#ff5a1f"
              className="!p-1 h-[38px]"
            />
          </div>
          <button type="submit" className="btn btn-accent">
            Add client
          </button>
        </div>
      </form>

      {!clients?.length ? (
        <EmptyState title="No clients yet" hint="Add one above to get started." />
      ) : (
        <div className="flex flex-col gap-4">
          {(clients as Client[]).map((c) => {
            const accts = (accounts ?? []).filter(
              (a) => a.client_id === c.id
            );
            const users = (access ?? []).filter(
              (a) => a.client_id === c.id
            );

            return (
              <div key={c.id} className="panel p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-[10px] h-[10px] rounded-full"
                    style={{ background: c.color }}
                  />
                  <h3 className="font-medium">{c.name}</h3>
                  <span className="mono text-faint ml-auto">
                    {postCount.get(c.id) ?? 0} posts
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mt-3.5">
                  {/* Connected accounts */}
                  <div>
                    <span className="lbl">Connected accounts</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {PLATFORMS.map((pl) => {
                        const a = accts.find((x) => x.platform === pl);
                        const on = a?.connected;
                        return (
                          <a
                            key={pl}
                            href={`/api/oauth/${pl}/start?client_id=${c.id}`}
                            title={
                              on
                                ? `${PLATFORM_NAMES[pl]}: ${a?.handle || 'connected'}`
                                : `Connect ${PLATFORM_NAMES[pl]}`
                            }
                            className={`pill cursor-pointer hover:opacity-80 transition ${
                              on
                                ? a?.is_real
                                  ? 'pill-published'
                                  : 'pill-scheduled'
                                : 'pill-draft'
                            }`}
                          >
                            {pl}{' '}
                            {on ? (a?.is_real ? 'live' : 'demo') : 'connect'}
                          </a>
                        );
                      })}
                    </div>
                    {accts.some((a) => a.connected && !a.is_real) && (
                      <p className="mono text-faint mt-1.5">
                        Demo connections simulate publishing. Set platform credentials in env to go live.
                      </p>
                    )}
                  </div>

                  {/* Portal access */}
                  <div>
                    <span className="lbl">Portal access</span>
                    <div className="mt-1.5 flex flex-col gap-1">
                      {users.length === 0 ? (
                        <span className="mono text-faint">nobody yet</span>
                      ) : (
                        users.map((u) => {
                          const p = u.profiles as { id?: string; email?: string } | null;
                          return (
                            <div
                              key={u.user_id}
                              className="flex items-center gap-2"
                            >
                              <span className="mono text-ink-2 flex-1">
                                {p?.email ?? 'unknown'}
                              </span>
                              <form action={removeUserAction}>
                                <input type="hidden" name="user_id" value={u.user_id} />
                                <input type="hidden" name="client_id" value={c.id} />
                                <button
                                  type="submit"
                                  className="mono text-failed text-[10px] hover:underline"
                                >
                                  remove
                                </button>
                              </form>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Invite form */}
                    <form
                      action={inviteUserAction}
                      className="flex gap-1.5 mt-2"
                    >
                      <input type="hidden" name="client_id" value={c.id} />
                      <input
                        name="email"
                        type="email"
                        placeholder="client@example.com"
                        required
                        className="flex-1 !text-[12px] !py-1.5"
                      />
                      <button
                        type="submit"
                        className="btn btn-ghost btn-sm"
                      >
                        Invite
                      </button>
                    </form>
                  </div>
                </div>

                {/* Delete client */}
                <div className="mt-3 pt-3 border-t border-line">
                  <form action={deleteClientAction} className="flex items-center gap-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <button
                      type="submit"
                      className="mono text-failed text-[10px] hover:underline"
                    >
                      delete client
                    </button>
                    <span className="mono text-faint text-[10px]">
                      (also deletes all posts and access)
                    </span>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
