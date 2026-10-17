-- Review follow-ups for 004 (jobs + assets).

-- 1. Approval stamping: resetting to pending clears the approver too, and a
--    superseded version can no longer be approved through a user JWT (the UI
--    already hides it; this closes the direct-API path). Service-key writes
--    (auth.uid() is null) stay unrestricted for agency tooling.
create or replace function public.stamp_asset_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.approval is distinct from old.approval then
    if auth.uid() is not null and exists (select 1 from public.assets c where c.parent_id = new.id) then
      raise exception 'This version has been replaced. Review the latest version instead.'
        using errcode = 'check_violation';
    end if;
    if new.approval = 'pending' then
      new.approved_by := null;
      new.approved_at := null;
    else
      new.approved_by := coalesce(auth.uid(), new.approved_by);
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- 2. One child per version: two concurrent "new version" uploads cannot fork the chain.
create unique index if not exists assets_one_child_per_version on public.assets (parent_id)
  where parent_id is not null;

-- 3. Cost precision: a short Haiku call costs well under $0.0001.
alter table public.jobs alter column cost_usd type numeric(12,6);

-- 4. Monthly spend aggregated in SQL, so the Jobs page total is never truncated
--    by PostgREST's row cap. Service role only, like the table itself.
create or replace function public.spend_by_brand(since timestamptz)
returns table (client_id uuid, cost_usd numeric, unpriced_jobs bigint)
language sql
stable
security definer
set search_path = public
as $$
  select j.client_id,
         coalesce(sum(j.cost_usd), 0),
         count(*) filter (where j.cost_usd is null)
    from public.jobs j
   where j.created_at >= since
     and (j.input_tokens > 0 or j.output_tokens > 0)
   group by j.client_id;
$$;

revoke all on function public.spend_by_brand(timestamptz) from public, anon, authenticated;
grant execute on function public.spend_by_brand(timestamptz) to service_role;
