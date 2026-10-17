-- Phase 1 foundation: a job queue for every AI / render run, a versioned asset
-- library, and client approval + comments on any asset.
--
-- Security model (same rules as schema.sql):
--   jobs           AGENCY ONLY. Zero grants for anon/authenticated. Written by the
--                  app with the service key behind requireAgency(), or by the
--                  /api/worker/* routes behind the worker token.
--   assets         Readable by agency and the owning client's users. Clients may
--                  change ONLY the approval column (column grant), and a trigger
--                  stamps who approved and when, so a client cannot forge it.
--   asset_comments Same rules as post_comments.
--   storage        Private bucket 'assets'. Nobody reads objects directly; the
--                  app hands out short-lived signed URLs after an access check.

-- ------------------------------------------------------------------- jobs

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete cascade,
  kind          text not null check (kind in ('playbook','video_render','worker_ping')),
  playbook      text not null default '',
  -- 'app' jobs run inside the web app; 'worker' jobs wait for the local Docker worker
  runner        text not null default 'app' check (runner in ('app','worker')),
  status        text not null default 'queued'
                check (status in ('queued','running','succeeded','failed','canceled')),
  input         jsonb not null default '{}'::jsonb,
  output        jsonb not null default '{}'::jsonb,
  error         text,
  attempts      int not null default 0,
  max_attempts  int not null default 3 check (max_attempts between 1 and 10),
  locked_by     text,
  locked_at     timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  model         text not null default '',
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  -- null when the model has no known price; tokens are still recorded
  cost_usd      numeric(10,4),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_queue_idx on public.jobs (runner, status, created_at)
  where status in ('queued','running');
create index if not exists jobs_client_idx on public.jobs (client_id, created_at desc);

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;

-- Atomically hand the oldest queued worker job to one worker. SKIP LOCKED means
-- two workers never get the same row. Jobs whose worker went silent for longer
-- than stale_after are requeued first (or failed once out of attempts).
create or replace function public.claim_job(worker_id text, kinds text[], stale_after interval default interval '15 minutes')
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         error  = case when attempts >= max_attempts then 'Worker stopped responding.' else error end,
         finished_at = case when attempts >= max_attempts then now() else null end,
         locked_by = null, locked_at = null
   where runner = 'worker' and status = 'running' and locked_at < now() - stale_after;

  return query
  update public.jobs j
     set status = 'running', locked_by = worker_id, locked_at = now(),
         started_at = coalesce(j.started_at, now()), attempts = j.attempts + 1
   where j.id = (
     select id from public.jobs
      where runner = 'worker' and status = 'queued' and kind = any(kinds)
      order by created_at, id
      limit 1
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_job(text, text[], interval) from public, anon, authenticated;
grant execute on function public.claim_job(text, text[], interval) to service_role;

-- ----------------------------------------------------------------- assets

create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  post_id       uuid references public.posts(id) on delete set null,
  -- previous version of the same asset; versions form a chain
  parent_id     uuid references public.assets(id) on delete set null,
  version       int not null default 1 check (version >= 1),
  kind          text not null
                check (kind in ('image','slide','video','reel','logo','document','audio','other')),
  title         text not null default '',
  storage_path  text not null unique,
  mime          text not null default '',
  bytes         bigint not null default 0 check (bytes >= 0),
  width         int,
  height        int,
  duration_ms   int,
  approval      text not null default 'pending'
                check (approval in ('pending','approved','changes_requested')),
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists assets_client_idx on public.assets (client_id, created_at desc);
create index if not exists assets_approval_idx on public.assets (client_id, approval);

drop trigger if exists assets_touch on public.assets;
create trigger assets_touch before update on public.assets
  for each row execute function public.touch_updated_at();

-- A client's approval is stamped with their own uid, never from input (they have
-- no grant on approved_by anyway). Agency writes use the service key, where
-- auth.uid() is null, so the app passes approved_by explicitly and it is kept.
create or replace function public.stamp_asset_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.approval is distinct from old.approval then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := case when new.approval = 'pending' then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_stamp_approval on public.assets;
create trigger assets_stamp_approval before update of approval on public.assets
  for each row execute function public.stamp_asset_approval();

alter table public.assets enable row level security;

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets for select
  using (public.can_access_client(client_id));

-- clients may update rows they can see; the column grant below limits them to approval
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets for update
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

revoke all on public.assets from anon, authenticated;
grant select on public.assets to authenticated;
grant update (approval) on public.assets to authenticated;

-- ---------------------------------------------------------- asset comments

create table if not exists public.asset_comments (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references public.assets(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists asset_comments_asset_idx on public.asset_comments (asset_id, created_at);

alter table public.asset_comments enable row level security;

drop policy if exists asset_comments_select on public.asset_comments;
create policy asset_comments_select on public.asset_comments for select
  using (exists (
    select 1 from public.assets a
    where a.id = asset_id and public.can_access_client(a.client_id)
  ));

drop policy if exists asset_comments_insert on public.asset_comments;
create policy asset_comments_insert on public.asset_comments for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.assets a
      where a.id = asset_id and public.can_access_client(a.client_id)
    )
  );

drop policy if exists asset_comments_delete on public.asset_comments;
create policy asset_comments_delete on public.asset_comments for delete
  using (user_id = auth.uid() or public.is_agency());

revoke all on public.asset_comments from anon, authenticated;
grant select, insert, delete on public.asset_comments to authenticated;

-- ----------------------------------------------------------------- storage
-- Private bucket. No storage.objects policies for anon/authenticated on purpose:
-- uploads and reads go through the service key (agency actions, worker routes)
-- and viewers get signed URLs that expire.
insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 524288000)
on conflict (id) do nothing;
