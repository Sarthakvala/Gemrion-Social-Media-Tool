-- Fix: comment queries embed `profiles(email)`, but comment authors only had a
-- foreign key to auth.users, so PostgREST rejected the embed (PGRST200) and the
-- note lists always came back empty. profiles.id is the auth user id, so a second
-- foreign key to profiles is always satisfiable and gives PostgREST the relationship.
-- RLS on profiles still applies: clients see only their own email on notes.

alter table public.post_comments
  drop constraint if exists post_comments_user_profile_fkey,
  add constraint post_comments_user_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.asset_comments
  drop constraint if exists asset_comments_user_profile_fkey,
  add constraint asset_comments_user_profile_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';
