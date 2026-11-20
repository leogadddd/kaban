-- Delete my account, with 30 days to change your mind.
--
-- Additive only: one new table, new functions, and a daily pg_cron job. Nothing existing is changed.
-- Requesting deletion only records a date (and revokes quick add tokens). Nothing is erased until the
-- purge runs after the grace period, so signing in and choosing "Recover" restores everything.
--
-- The purge hands each family the user owns to its next admin (or oldest member), or deletes it when
-- they were alone, then deletes the auth user. Every other table cascades from auth.users.

create table public.account_deletions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  purge_after  timestamptz not null
);

alter table public.account_deletions enable row level security;
-- Reached only through the functions below.
revoke all on public.account_deletions from anon, authenticated;

create function kaban_private.deletion_json(d public.account_deletions) returns jsonb
language sql immutable set search_path = '' as $$
  select case when d.user_id is null then jsonb_build_object('pending', false)
    else jsonb_build_object('pending', true, 'requested_at', d.requested_at, 'purge_after', d.purge_after) end;
$$;

create function public.get_my_account_deletion() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  d public.account_deletions;
begin
  select * into d from public.account_deletions where user_id = uid;
  return kaban_private.deletion_json(d);
end $$;

-- Asking again keeps the original date: the clock never restarts.
create function public.request_account_deletion() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  d public.account_deletions;
begin
  insert into public.account_deletions (user_id, purge_after) values (uid, now() + interval '30 days')
  on conflict (user_id) do nothing;
  -- A token is the one way in that skips sign-in, so stop it now rather than in 30 days.
  update public.quick_add_tokens set revoked_at = now() where user_id = uid and revoked_at is null;
  select * into d from public.account_deletions where user_id = uid;
  return kaban_private.deletion_json(d);
end $$;

create function public.cancel_account_deletion() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  d public.account_deletions;
begin
  delete from public.account_deletions where user_id = uid;
  return kaban_private.deletion_json(d);
end $$;

-- Removes one user for good. Families keep working for everyone else.
create function kaban_private.purge_account(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam record;
  heir uuid;
begin
  for fam in select family_id from public.family_members where user_id = uid and role = 'owner' loop
    select user_id into heir from public.family_members
      where family_id = fam.family_id and user_id <> uid
      order by (role = 'admin') desc, joined_at asc
      limit 1;
    if heir is null then
      delete from public.families where id = fam.family_id;
    else
      update public.family_members set role = 'owner' where family_id = fam.family_id and user_id = heir;
      delete from public.family_members where family_id = fam.family_id and user_id = uid;
    end if;
  end loop;
  -- Columns without a cascade: point them at the family's current owner.
  update public.families f set created_by = m.user_id
    from public.family_members m
    where f.created_by = uid and m.family_id = f.id and m.role = 'owner';
  update public.family_invites i set created_by = m.user_id
    from public.family_members m
    where i.created_by = uid and m.family_id = i.family_id and m.role = 'owner';
  delete from auth.users where id = uid;
end $$;

-- Run daily by pg_cron. Each user is purged on their own, so one failure doesn't stop the rest.
create function kaban_private.purge_deleted_accounts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in select user_id from public.account_deletions where purge_after <= now() order by purge_after limit 500 loop
    begin
      perform kaban_private.purge_account(r.user_id);
      n := n + 1;
    exception when others then
      raise warning 'purge of % failed: %', r.user_id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

revoke all on function kaban_private.deletion_json(public.account_deletions) from public, anon, authenticated;
revoke all on function kaban_private.purge_account(uuid) from public, anon, authenticated;
revoke all on function kaban_private.purge_deleted_accounts() from public, anon, authenticated;
revoke all on function public.get_my_account_deletion() from public, anon;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.get_my_account_deletion() to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;

-- Schedule the purge. If pg_cron isn't enabled on this project, the migration still applies; enable it
-- (Database → Extensions → pg_cron) and run the cron.schedule line below by hand.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('kaban-purge-deleted-accounts', '17 3 * * *', 'select kaban_private.purge_deleted_accounts()');
exception when others then
  raise notice 'pg_cron unavailable (%); schedule kaban_private.purge_deleted_accounts() manually', sqlerrm;
end $$;
