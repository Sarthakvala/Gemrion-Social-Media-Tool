-- Agency-wide AI settings: provider choice, models, and API keys.
-- Keys are stored AES-256-GCM encrypted by the app (key derived from the
-- service role secret), and the table has ZERO grants for anon/authenticated,
-- same as social_accounts: only the service key behind requireAgency() reads it.

create table if not exists public.ai_settings (
  id               int primary key default 1 check (id = 1),
  provider         text not null default 'anthropic' check (provider in ('anthropic','openai')),
  anthropic_model  text not null default 'claude-opus-5',
  openai_model     text not null default 'gpt-5.5',
  anthropic_key    text not null default '',
  openai_key       text not null default '',
  anthropic_hint   text not null default '',
  openai_hint      text not null default '',
  updated_at       timestamptz not null default now()
);

insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists ai_settings_touch on public.ai_settings;
create trigger ai_settings_touch
  before update on public.ai_settings
  for each row execute function public.touch_updated_at();

alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from anon, authenticated;
