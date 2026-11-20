-- Age rules for new accounts: 13 and older, and 13–17 need a parent or guardian's agreement.
--
-- Additive only: one nullable column on profiles and two new triggers on auth.users. Existing accounts
-- and existing triggers are untouched.
--
-- The sign-up form sends `birthday` and `guardian_consent` in the user metadata. The check runs before
-- the user row is written, so an under-age sign-up never creates an account. Afterwards the birthday is
-- copied to the private profile and removed from the auth metadata, so it lives in one place.
-- Sign-ups without a birthday (app versions from before this change) are let through unchanged.

alter table public.profiles
  add column if not exists guardian_consent_at timestamptz;

create function kaban_private.signup_birthday(meta jsonb) returns date
language plpgsql stable set search_path = '' as $$
begin
  return nullif(meta->>'birthday', '')::date;
exception when others then
  return null;
end $$;

create function kaban_private.check_signup_age() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b date := kaban_private.signup_birthday(new.raw_user_meta_data);
  years integer;
begin
  if new.raw_user_meta_data ? 'birthday' and b is null then
    raise exception 'birthday is not a valid date' using errcode = '22023';
  end if;
  if b is null then
    return new;
  end if;
  if b > current_date or b < date '1900-01-01' then
    raise exception 'birthday is out of range' using errcode = '22023';
  end if;
  years := extract(year from age(current_date, b))::integer;
  if years < 13 then
    raise exception 'accounts are for people 13 and older' using errcode = 'P0001', hint = 'age';
  end if;
  if years < 18 and coalesce((new.raw_user_meta_data->>'guardian_consent')::boolean, false) is not true then
    raise exception 'a parent or guardian must agree for people under 18' using errcode = 'P0001', hint = 'guardian';
  end if;
  return new;
end $$;

create function kaban_private.store_signup_age() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b date := kaban_private.signup_birthday(new.raw_user_meta_data);
  consent boolean := coalesce((new.raw_user_meta_data->>'guardian_consent')::boolean, false);
begin
  if b is null then
    return new;
  end if;
  insert into public.profiles as p (user_id, birthday, guardian_consent_at, updated_at)
  values (new.id, b, case when consent then now() end, now())
  on conflict (user_id) do update
    set birthday = coalesce(p.birthday, excluded.birthday),
        guardian_consent_at = coalesce(p.guardian_consent_at, excluded.guardian_consent_at);
  update auth.users
    set raw_user_meta_data = raw_user_meta_data - 'birthday' - 'guardian_consent'
    where id = new.id;
  return new;
end $$;

create trigger kaban_check_signup_age
  before insert on auth.users
  for each row execute function kaban_private.check_signup_age();

create trigger kaban_store_signup_age
  after insert on auth.users
  for each row execute function kaban_private.store_signup_age();

revoke all on function kaban_private.signup_birthday(jsonb) from public, anon, authenticated;
revoke all on function kaban_private.check_signup_age() from public, anon, authenticated;
revoke all on function kaban_private.store_signup_age() from public, anon, authenticated;
