-- Native publishing engine (docs/decisions/0001-native-publishing-engine.md).
--
-- Security model:
--   channels, posting_slots, hashtag_groups, signatures, mastodon_apps:
--     AGENCY ONLY. Zero grants for anon/authenticated; written and read with the
--     service key behind requireAgency(). channels.secret holds AES-256-GCM
--     encrypted credentials (never plaintext tokens).
--   post_targets: readable by agency and the owning client's users (the portal
--     shows where and when a post goes out, and its live link). No client writes.
--   claim_due_targets(): service_role only. It refuses posts that are not
--     client-approved or are disabled, so the approval gate holds in the database.

-- ----------------------------------------------------------------- channels

create table if not exists public.channels (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  network      text not null check (network in (
                 'bluesky','mastodon','telegram','discord',
                 'facebook','instagram','threads','x','linkedin','linkedin_page',
                 'tiktok','youtube','pinterest','reddit','google_business')),
  name         text not null default '',
  handle       text not null default '',
  avatar_url   text not null default '',
  external_id  text not null,
  secret       text not null default '',
  status       text not null default 'active' check (status in ('active','expired','error','disabled')),
  settings     jsonb not null default '{}'::jsonb,
  last_error   text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, network, external_id)
);

create index if not exists channels_client_idx on public.channels (client_id, network);

drop trigger if exists channels_touch on public.channels;
create trigger channels_touch before update on public.channels
  for each row execute function public.touch_updated_at();

alter table public.channels enable row level security;
revoke all on public.channels from anon, authenticated;

-- ------------------------------------------------------------- post targets

create table if not exists public.post_targets (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  channel_id    uuid not null references public.channels(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  -- empty = use the post's text for this network
  text          text not null default '',
  settings      jsonb not null default '{}'::jsonb,
  status        text not null default 'draft'
                check (status in ('draft','scheduled','publishing','published','failed','canceled')),
  scheduled_at  timestamptz,
  attempts      int not null default 0,
  max_attempts  int not null default 3 check (max_attempts between 1 and 10),
  locked_at     timestamptz,
  external_id   text,
  external_url  text,
  error         text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (post_id, channel_id)
);

create index if not exists post_targets_due_idx on public.post_targets (scheduled_at)
  where status in ('scheduled','publishing');
create index if not exists post_targets_post_idx on public.post_targets (post_id);

drop trigger if exists post_targets_touch on public.post_targets;
create trigger post_targets_touch before update on public.post_targets
  for each row execute function public.touch_updated_at();

alter table public.post_targets enable row level security;

drop policy if exists post_targets_select on public.post_targets;
create policy post_targets_select on public.post_targets for select
  using (public.can_access_client(client_id));

revoke all on public.post_targets from anon, authenticated;
grant select on public.post_targets to authenticated;

-- Hands due, approved targets to one publisher at a time. Targets stuck in
-- 'publishing' longer than stale_after (crashed run) are retried, or failed once
-- out of attempts.
create or replace function public.claim_due_targets(batch int default 20, stale_after interval default interval '10 minutes')
returns setof public.post_targets
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.post_targets
     set status = case when attempts >= max_attempts then 'failed' else 'scheduled' end,
         error  = case when attempts >= max_attempts then 'Publishing stopped responding.' else error end,
         locked_at = null
   where status = 'publishing' and locked_at < now() - stale_after;

  return query
  update public.post_targets t
     set status = 'publishing', locked_at = now(), attempts = t.attempts + 1
   where t.id in (
     select pt.id
       from public.post_targets pt
       join public.posts p on p.id = pt.post_id
       join public.channels c on c.id = pt.channel_id
      where pt.status = 'scheduled'
        and pt.scheduled_at <= now()
        and p.approval = 'approved'
        and p.enabled
        and c.status = 'active'
      order by pt.scheduled_at, pt.id
      limit greatest(1, least(batch, 100))
      for update of pt skip locked
   )
  returning t.*;
end;
$$;

revoke all on function public.claim_due_targets(int, interval) from public, anon, authenticated;
grant execute on function public.claim_due_targets(int, interval) to service_role;

-- ---------------------------------------------------------- queue time slots

-- brand-wide queue times in the brand's time zone (brand_profiles.timezone)
create table if not exists public.posting_slots (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  local_time  time not null,
  created_at  timestamptz not null default now(),
  unique (client_id, weekday, local_time)
);

alter table public.posting_slots enable row level security;
revoke all on public.posting_slots from anon, authenticated;

-- ----------------------------------------------------- content helpers

create table if not exists public.hashtag_groups (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (client_id, name)
);

create table if not exists public.signatures (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  body       text not null check (char_length(body) <= 2000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, name)
);

-- one default signature per brand
create unique index if not exists signatures_one_default on public.signatures (client_id) where is_default;

alter table public.hashtag_groups enable row level security;
alter table public.signatures enable row level security;
revoke all on public.hashtag_groups from anon, authenticated;
revoke all on public.signatures from anon, authenticated;

-- --------------------------------------------- Mastodon per-instance apps
-- Mastodon lets any client register itself on an instance (POST /api/v1/apps),
-- so no developer portal is involved. One registration per instance is reused.

-- keyed by instance AND redirect URI: preview and production deployments each
-- need their own registration because the redirect is fixed at registration time.
-- client_secret is AES-256-GCM encrypted by the app.
create table if not exists public.mastodon_apps (
  instance      text not null check (instance ~ '^[a-z0-9.-]+$'),
  redirect_uri  text not null,
  client_id     text not null,
  client_secret text not null,
  created_at    timestamptz not null default now(),
  primary key (instance, redirect_uri)
);

alter table public.mastodon_apps enable row level security;
revoke all on public.mastodon_apps from anon, authenticated;
