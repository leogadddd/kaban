-- Quick add from outside the app (iOS Shortcuts, Android automations, scripts).
--
-- Additive only. A user creates a personal token in Settings; anything holding it can *propose* an
-- entry, nothing more. Proposals wait in quick_add_entries until the user approves or rejects them on
-- one of their devices, which then saves an approved entry into its own ledger through the normal push
-- path. A token can't read anything, edit anything, or touch public.records.
--
-- Tokens are stored as SHA-256 hashes; the plain token is shown once, when it's created. Tokens and
-- entries are never hard-deleted by these functions (revoked / decided instead).

create table public.quick_add_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  token_hash   bytea not null unique,
  -- Last four characters, so the user can tell tokens apart.
  hint         text not null check (char_length(hint) = 4),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index quick_add_tokens_user on public.quick_add_tokens (user_id) where revoked_at is null;

create table public.quick_add_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_id   uuid references public.quick_add_tokens (id) on delete set null,
  data       jsonb not null check (octet_length(data::text) <= 2048),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index quick_add_entries_user on public.quick_add_entries (user_id, status, created_at);
create index quick_add_entries_token on public.quick_add_entries (token_id, created_at);

alter table public.quick_add_tokens enable row level security;
alter table public.quick_add_entries enable row level security;
revoke all on public.quick_add_tokens from anon, authenticated;
revoke all on public.quick_add_entries from anon, authenticated;

-- ---------- Token management (signed in, 2FA satisfied) ----------

create function public.list_quick_add_tokens() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'hint', t.hint, 'created_at', t.created_at, 'last_used_at', t.last_used_at
    ) order by t.created_at)
    from public.quick_add_tokens t
    where t.user_id = uid and t.revoked_at is null
  ), '[]'::jsonb);
end $$;

-- Returns the plain token. It is not stored and can't be shown again.
create function public.create_quick_add_token(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_name text := kaban_private.clean_text(p_name, 40);
  v_token text;
  v_id uuid;
begin
  if v_name is null then
    raise exception 'Give the token a name' using hint = 'invalid';
  end if;
  if (select count(*) from public.quick_add_tokens where user_id = uid and revoked_at is null) >= 5 then
    raise exception 'You can have up to 5 quick add tokens. Revoke one first.' using hint = 'limit';
  end if;
  -- Two v4 UUIDs: 244 random bits.
  v_token := 'kbn_' || encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'hex');
  insert into public.quick_add_tokens (user_id, name, token_hash, hint)
  values (uid, v_name, sha256(convert_to(v_token, 'UTF8')), right(v_token, 4))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', v_token);
end $$;

create function public.revoke_quick_add_token(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.quick_add_tokens set revoked_at = now()
    where id = p_id and user_id = uid and revoked_at is null;
end $$;

-- ---------- Submitting (anyone holding a token) ----------

-- Returns 'ok', 'unauthorized', 'invalid', 'rate' or 'limit'. Validates everything itself: it is
-- reachable directly with the public API key, not only through the app's /api/quick-add route.
create function public.quick_add_submit(p_token text, p_entry jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  tok public.quick_add_tokens;
  v_amount numeric;
  v_type text;
  v_description text;
  v_category text;
  v_account text;
  v_date text;
  v_clean jsonb;
begin
  if p_token is null or char_length(p_token) <> 68 or p_token !~ '^kbn_[0-9a-f]{64}$' then
    return 'unauthorized';
  end if;
  select * into tok from public.quick_add_tokens
    where token_hash = sha256(convert_to(p_token, 'UTF8')) and revoked_at is null;
  if not found then
    return 'unauthorized';
  end if;

  if jsonb_typeof(p_entry) is distinct from 'object' or octet_length(p_entry::text) > 2048
     or jsonb_typeof(p_entry -> 'amountMinor') is distinct from 'number' then
    return 'invalid';
  end if;
  v_amount := (p_entry ->> 'amountMinor')::numeric;
  v_type := coalesce(p_entry ->> 'type', 'expense');
  v_description := kaban_private.clean_text(p_entry ->> 'description', 80);
  v_category := kaban_private.clean_text(p_entry ->> 'category', 40);
  v_account := kaban_private.clean_text(p_entry ->> 'account', 60);
  v_date := p_entry ->> 'date';
  if v_amount <> trunc(v_amount) or v_amount < 1 or v_amount > 100000000000
     or v_type not in ('expense', 'income')
     or (v_date is not null and v_date !~ '^\d{4}-\d{2}-\d{2}$') then
    return 'invalid';
  end if;
  if v_date is not null then
    begin
      if to_char(to_date(v_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_date then
        return 'invalid';
      end if;
    exception when others then
      return 'invalid';
    end;
  end if;

  if (select count(*) from public.quick_add_entries where token_id = tok.id and created_at > now() - interval '1 hour') >= 60 then
    return 'rate';
  end if;
  if (select count(*) from public.quick_add_entries where user_id = tok.user_id and status = 'pending') >= 100 then
    return 'limit';
  end if;

  v_clean := jsonb_strip_nulls(jsonb_build_object(
    'amountMinor', v_amount::bigint,
    'type', v_type,
    'description', v_description,
    'category', v_category,
    'account', v_account,
    'date', v_date,
    'source', tok.name
  ));
  insert into public.quick_add_entries (user_id, token_id, data) values (tok.user_id, tok.id, v_clean);
  update public.quick_add_tokens set last_used_at = now() where id = tok.id;
  return 'ok';
end $$;

-- ---------- Approving (signed in, 2FA satisfied) ----------

create function public.pull_quick_add_entries() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'data', e.data, 'created_at', e.created_at) order by e.created_at)
    from (
      select * from public.quick_add_entries
      where user_id = uid and status = 'pending'
      order by created_at limit 100
    ) e
  ), '[]'::jsonb);
end $$;

-- 'approved' once the device has saved them into its ledger; 'rejected' when the user turns them down.
create function public.decide_quick_add_entries(p_ids uuid[], p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid status' using hint = 'invalid';
  end if;
  update public.quick_add_entries set status = p_status, decided_at = now()
    where user_id = uid and status = 'pending' and id = any (p_ids);
end $$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.list_quick_add_tokens()',
    'public.create_quick_add_token(text)',
    'public.revoke_quick_add_token(uuid)',
    'public.pull_quick_add_entries()',
    'public.decide_quick_add_entries(uuid[], text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
  execute 'revoke all on function public.quick_add_submit(text, jsonb) from public';
  execute 'grant execute on function public.quick_add_submit(text, jsonb) to anon, authenticated';
end $$;
