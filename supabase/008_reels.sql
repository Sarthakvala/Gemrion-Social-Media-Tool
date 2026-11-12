-- Phase 2: reels. A reel is a script (from the reel-scripter playbook) plus the
-- render spec staff edit before rendering. Render status is NOT stored here:
-- it is read from the render job (render_job_id), so jobs stay the single
-- source of truth; the rendered MP4 is an asset whose job_id is that job.
--
-- Agency only, like jobs: zero grants for anon/authenticated. Clients see the
-- finished video through assets (Files in the portal), never the script.

create table if not exists public.reels (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  title          text not null default '' check (char_length(title) <= 120),
  script         jsonb not null default '{}'::jsonb,
  spec           jsonb not null default '{}'::jsonb,
  script_job_id  uuid references public.jobs(id) on delete set null,
  render_job_id  uuid references public.jobs(id) on delete set null,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists reels_client_idx on public.reels (client_id, created_at desc);

drop trigger if exists reels_touch on public.reels;
create trigger reels_touch before update on public.reels
  for each row execute function public.touch_updated_at();

alter table public.reels enable row level security;
revoke all on public.reels from anon, authenticated;
