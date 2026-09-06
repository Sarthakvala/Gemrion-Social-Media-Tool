-- ============================================================================
-- AgencyFlow - schema + row level security
-- ============================================================================
-- Run this once in the Supabase SQL editor.
--
-- SECURITY MODEL (read before changing anything):
--
--   Two kinds of logged-in user, both live in auth.users and both carry the
--   `authenticated` postgres role. They are told apart by profiles.role:
--
--     'agency'  -> your team. Sees every client. Writes go through Next.js
--                  server routes using the SERVICE key, which bypasses RLS.
--     'client'  -> a customer. Sees ONLY the clients listed for them in
--                  client_users. Writes go through their own JWT, so RLS and
--                  the column grants at the bottom of this file are what
--                  actually contain them.
--
--   Clients may edit ONLY caption / copy / hashtags. That limit is enforced by
--   column-level GRANTs, because a RLS policy cannot restrict columns.
--
--   OAuth access tokens live in social_accounts, which has NO client policy at
--   all. A client JWT cannot read that table under any circumstance.
-- ============================================================================

-- ---------------------------------------------------------------- extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------- tables

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text default '',
  role       text not null default 'client' check (role in ('agency','client')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#ff5a1f',
  created_at timestamptz not null default now()
);

-- which client workspaces a 'client' user may see
create table if not exists public.client_users (
  user_id   uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  primary key (user_id, client_id)
);

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  title        text not null default '',
  copy         text not null default '',
  caption      text not null default '',
  hashtags     text not null default '',
  link         text not null default '',
  platforms    text[] not null default '{}',
  scheduled_at timestamptz,
  status       text not null default 'draft'
               check (status in ('draft','scheduled','published','failed')),
  approval     text not null default 'pending'
               check (approval in ('pending','approved','changes_requested')),
  -- the safety gate: false means this never publishes, enforced server side too
  enabled      boolean not null default true,
  image_url    text not null default '',
  slides       text[] not null default '{}',
  video_url    text not null default '',
  published_at timestamptz,
  publish_error text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists posts_client_sched_idx
  on public.posts (client_id, scheduled_at);

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments (post_id, created_at);

-- OAuth connections + tokens. Agency only. Never exposed to a client JWT.
create table if not exists public.social_accounts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  platform      text not null check (platform in ('IG','FB','X','LI','TT')),
  handle        text not null default '',
  connected     boolean not null default false,
  is_real       boolean not null default false,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  meta          jsonb not null default '{}'::jsonb,
  unique (client_id, platform)
);

-- ---------------------------------------------------------------- functions

-- SECURITY DEFINER so the policies below can read profiles/client_users
-- without recursively re-triggering RLS on those same tables.
create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agency'
  );
$$;

create or replace function public.can_access_client(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_agency() or exists (
    select 1 from public.client_users
    where user_id = auth.uid() and client_id = cid
  );
$$;

-- give every new auth user a profile row (defaults to the 'client' role)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists posts_touch_updated on public.posts;
create trigger posts_touch_updated
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------- RLS

alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.client_users   enable row level security;
alter table public.posts          enable row level security;
alter table public.post_comments  enable row level security;
alter table public.social_accounts enable row level security;

-- profiles: you can always read yourself; agency can read everyone
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_agency());

-- clients: agency sees all, a client sees only theirs
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.can_access_client(id));

drop policy if exists clients_write on public.clients;
create policy clients_write on public.clients for all
  using (public.is_agency()) with check (public.is_agency());

-- client_users: you may see your own mapping; agency sees all
drop policy if exists client_users_select on public.client_users;
create policy client_users_select on public.client_users for select
  using (user_id = auth.uid() or public.is_agency());

drop policy if exists client_users_write on public.client_users;
create policy client_users_write on public.client_users for all
  using (public.is_agency()) with check (public.is_agency());

-- posts: readable by agency and by the owning client's users
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
  using (public.can_access_client(client_id));

-- clients may UPDATE their own posts, but the column grants further down mean
-- the only columns they can actually write are caption / copy / hashtags.
-- The with-check clause stops them moving a post to another client.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

-- only agency may create or delete posts
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (public.is_agency());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (public.is_agency());

-- comments: readable and writable by anyone who can see the post
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select
  using (exists (
    select 1 from public.posts p
    where p.id = post_id and public.can_access_client(p.client_id)
  ));

drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.posts p
      where p.id = post_id and public.can_access_client(p.client_id)
    )
  );

drop policy if exists comments_delete on public.post_comments;
create policy comments_delete on public.post_comments for delete
  using (user_id = auth.uid() or public.is_agency());

-- social_accounts: AGENCY ONLY. Deliberately no client-facing policy, so a
-- client JWT can never read access_token / refresh_token.
drop policy if exists social_accounts_all on public.social_accounts;
create policy social_accounts_all on public.social_accounts for all
  using (public.is_agency()) with check (public.is_agency());

-- ------------------------------------------------------------------ grants
--
-- This is what actually stops a client rewriting the schedule or flipping the
-- safety gate. RLS decides WHICH ROWS; these grants decide WHICH COLUMNS.
-- The agency console does not rely on these because it writes with the service
-- key, which bypasses both RLS and grants.

revoke all on public.posts from anon, authenticated;
grant select on public.posts to authenticated;
-- caption/copy/hashtags: the client may reword the post.
-- approval: the client's own approve / request-changes signal.
-- Everything else (enabled, status, scheduled_at, platforms, image_url,
-- client_id) stays agency-only and is unwritable through a client JWT.
grant update (caption, copy, hashtags, approval) on public.posts to authenticated;

revoke all on public.social_accounts from anon, authenticated;

grant select on public.clients      to authenticated;
grant select on public.profiles     to authenticated;
grant select on public.client_users to authenticated;
grant select, insert, delete on public.post_comments to authenticated;

-- ----------------------------------------------------------------- storage
-- Bucket for post creatives. Public read so Instagram can fetch the image URL
-- at publish time; writes are restricted to agency users.
insert into storage.buckets (id, name, public)
values ('creatives', 'creatives', true)
on conflict (id) do nothing;

drop policy if exists creatives_read on storage.objects;
create policy creatives_read on storage.objects for select
  using (bucket_id = 'creatives');

drop policy if exists creatives_write on storage.objects;
create policy creatives_write on storage.objects for insert
  with check (bucket_id = 'creatives' and public.is_agency());

-- ------------------------------------------------------------ bootstrap you
-- After your first magic-link login, promote yourself to agency:
--
--   update public.profiles set role = 'agency' where email = 'you@example.com';
--
-- To give a client access to a workspace:
--
--   insert into public.client_users (user_id, client_id)
--   select p.id, c.id from public.profiles p, public.clients c
--   where p.email = 'client@example.com' and c.name = 'Gemrion';
