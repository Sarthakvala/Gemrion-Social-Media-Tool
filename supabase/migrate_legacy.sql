-- ============================================================================
-- One-off: copy the old key/value tables (af_clients, af_posts) into the new
-- relational schema. Safe to re-run: it matches on legacy_id and skips dupes.
-- ============================================================================

alter table public.clients add column if not exists legacy_id text unique;

-- clients -------------------------------------------------------------------
insert into public.clients (name, color, legacy_id)
select
  coalesce(c.data->>'name', 'Untitled'),
  coalesce(nullif(c.data->>'color',''), '#ff5a1f'),
  c.id
from public.af_clients c
on conflict (legacy_id) do nothing;

-- posts ---------------------------------------------------------------------
insert into public.posts (
  client_id, title, copy, caption, hashtags, link,
  platforms, scheduled_at, status, enabled,
  image_url, slides, video_url, created_at
)
select
  cl.id,
  coalesce(p.data->>'title', ''),
  coalesce(p.data->>'copy', ''),
  coalesce(p.data->>'caption', ''),
  coalesce(p.data->>'tags', ''),
  coalesce(p.data->>'link', ''),
  coalesce(
    (select array_agg(v) from jsonb_array_elements_text(p.data->'platforms') v),
    '{}'::text[]
  ),
  -- old model stored date + time separately
  case
    when coalesce(p.data->>'date','') <> '' then
      ((p.data->>'date') || ' ' || coalesce(nullif(p.data->>'time',''),'10:00'))::timestamp
      at time zone 'UTC'
    else null
  end,
  case
    when coalesce(p.data->>'status','') in ('draft','scheduled','published','failed')
      then p.data->>'status'
    else 'scheduled'
  end,
  coalesce((p.data->>'enabled')::boolean, true),
  coalesce(p.data->>'image', ''),
  coalesce(
    (select array_agg(v) from jsonb_array_elements_text(p.data->'slides') v),
    '{}'::text[]
  ),
  coalesce(p.data->>'video', ''),
  case
    when (p.data->>'createdAt') ~ '^[0-9]+$'
      then to_timestamp(((p.data->>'createdAt')::bigint) / 1000.0)
    else now()
  end
from public.af_posts p
join public.clients cl on cl.legacy_id = p.data->>'clientId'
-- do not double-import on a re-run
where not exists (
  select 1 from public.posts x
  where x.client_id = cl.id
    and x.title = coalesce(p.data->>'title','')
    and coalesce(x.image_url,'') = coalesce(p.data->>'image','')
);

-- report --------------------------------------------------------------------
select
  (select count(*) from public.clients) as clients,
  (select count(*) from public.posts)   as posts,
  (select count(*) from public.posts where video_url <> '') as with_video,
  (select count(*) from public.posts where array_length(slides,1) > 1) as carousels;
