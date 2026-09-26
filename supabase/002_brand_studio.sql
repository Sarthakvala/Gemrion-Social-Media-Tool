-- Brand Studio: per-brand kits the generator follows, few-shot examples, and
-- the structured creative fields a generated post needs. Additive only.

create table if not exists public.brand_profiles (
  client_id     uuid primary key references public.clients(id) on delete cascade,
  industry      text not null default '',
  offer         text not null default '',
  audience      text not null default '',
  voice         text not null default '',
  pillars       jsonb not null default '[]'::jsonb,
  dos           text not null default '',
  donts         text not null default '',
  banned_words  text not null default '',
  cta_style     text not null default '',
  hashtags      text not null default '',
  language      text not null default 'English',
  timezone      text not null default 'Asia/Kolkata',
  handle        text not null default '',
  palette       jsonb not null default
    '{"bg":"#0b1b3a","fg":"#ffffff","accent":"#ff5a1f","muted":"#9fb0d0"}'::jsonb,
  heading_font  text not null default 'Inter',
  body_font     text not null default 'Inter',
  logo_url      text not null default '',
  updated_at    timestamptz not null default now()
);

create table if not exists public.brand_examples (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  platform    text not null default '',
  body        text not null,
  post_id     uuid references public.posts(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists brand_examples_client_idx
  on public.brand_examples (client_id, created_at desc);

alter table public.posts add column if not exists pillar            text  not null default '';
alter table public.posts add column if not exists hook              text  not null default '';
alter table public.posts add column if not exists format            text  not null default 'single';
alter table public.posts add column if not exists aspect            text  not null default '4:5';
alter table public.posts add column if not exists slides_content    jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists platform_captions jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists visual_brief      text  not null default '';

do $$ begin
  alter table public.posts add constraint posts_format_chk
    check (format in ('single','carousel','story'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.posts add constraint posts_aspect_chk
    check (aspect in ('1:1','4:5','9:16'));
exception when duplicate_object then null; end $$;

drop trigger if exists brand_profiles_touch on public.brand_profiles;
create trigger brand_profiles_touch
  before update on public.brand_profiles
  for each row execute function public.touch_updated_at();

-- RLS: clients can read their own brand kit (the slide renderer needs it);
-- only agency reads examples. All writes go through the service key behind
-- requireAgency(), so no write policies or grants for authenticated.
alter table public.brand_profiles enable row level security;
alter table public.brand_examples enable row level security;

drop policy if exists brand_profiles_read on public.brand_profiles;
create policy brand_profiles_read on public.brand_profiles for select
  using (public.can_access_client(client_id));

drop policy if exists brand_examples_read on public.brand_examples;
create policy brand_examples_read on public.brand_examples for select
  using (public.is_agency());

revoke all on public.brand_profiles from anon, authenticated;
revoke all on public.brand_examples from anon, authenticated;
grant select on public.brand_profiles to authenticated;
grant select on public.brand_examples to authenticated;

-- clients may reword per-platform captions, same as caption/copy/hashtags
grant update (platform_captions) on public.posts to authenticated;
