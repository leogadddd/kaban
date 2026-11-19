-- Fix: "permission denied for table mfa_factors" when pulling records.
--
-- The restrictive policy on public.records read auth.mfa_factors directly. Policies run as the signed-in
-- user, and hosted Supabase doesn't let the `authenticated` role read the auth schema, so every select on
-- records failed. Wrap the lookup in a SECURITY DEFINER function (runs as its owner, like push_records)
-- that only ever answers for the caller's own account.

create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

drop policy if exists "require mfa when enrolled" on public.records;

create policy "require mfa when enrolled" on public.records
  as restrictive for select to authenticated using ((select public.mfa_satisfied()));
