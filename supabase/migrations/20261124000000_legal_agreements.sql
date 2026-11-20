-- Terms of Service and Privacy Policy acceptance, saved on the user's profile.
--
-- Purely additive: three nullable columns on public.profiles and two new RPCs. Nothing existing is
-- changed or dropped. Older clients keep calling get_my_profile / save_my_profile unchanged, and
-- save_my_profile's upsert only sets its own columns, so it never clears an acceptance.

alter table public.profiles
  add column if not exists terms_version   text check (terms_version is null or char_length(terms_version) between 1 and 32),
  add column if not exists privacy_version text check (privacy_version is null or char_length(privacy_version) between 1 and 32),
  add column if not exists legal_accepted_at timestamptz;

create or replace function public.get_my_agreement() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  p public.profiles;
begin
  select * into p from public.profiles where user_id = uid;
  return jsonb_build_object(
    'terms_version', p.terms_version,
    'privacy_version', p.privacy_version,
    'accepted_at', p.legal_accepted_at
  );
end $$;

-- Records the versions the user agreed to. accepted_at is when they tapped Agree on the device (it may
-- have been offline), clamped so a wrong clock can't put it in the future.
create or replace function public.accept_my_agreement(p_terms_version text, p_privacy_version text, p_accepted_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  at timestamptz := least(coalesce(p_accepted_at, now()), now());
begin
  if kaban_private.clean_text(p_terms_version, 32) is null or kaban_private.clean_text(p_privacy_version, 32) is null then
    raise exception 'both versions are required' using errcode = '22023';
  end if;
  insert into public.profiles as p (user_id, terms_version, privacy_version, legal_accepted_at, updated_at)
  values (uid, kaban_private.clean_text(p_terms_version, 32), kaban_private.clean_text(p_privacy_version, 32), at, now())
  on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        privacy_version = excluded.privacy_version,
        legal_accepted_at = excluded.legal_accepted_at,
        updated_at = now();
  return public.get_my_agreement();
end $$;

revoke all on function public.get_my_agreement() from public, anon;
revoke all on function public.accept_my_agreement(text, text, timestamptz) from public, anon;
grant execute on function public.get_my_agreement() to authenticated;
grant execute on function public.accept_my_agreement(text, text, timestamptz) to authenticated;
