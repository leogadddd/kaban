-- Family card payments and edit requests.
--
-- Additive: one new transaction type, two new contribution columns, a wider status check, and new or
-- replaced functions. No rows are deleted or rewritten.
--
-- member_payment: a family member paid this user's credit card from their own money. It lowers the card's
-- balance and is neither spending nor income for the owner.
--
-- Edit requests: a member changes or voids something they added after the owner's device imported it. The
-- owner's device applies it only if the owner hasn't changed that transaction since; otherwise it is
-- marked as a conflict and the owner's version stays.

-- ---------- Transaction type ----------

create or replace function kaban_private.valid_record(entity text, id text, version integer, updated_ms bigint, data jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  allowed text[];
  common constant text[] := array['id', 'version', 'createdAt', 'updatedAt'];
  valid boolean;
begin
  if jsonb_typeof(data) is distinct from 'object' or not kaban_private.is_id(data->'id')
     or (data->>'id') is distinct from id then
    return false;
  end if;

  if entity <> 'split' and (
    not kaban_private.is_integer(data->'version', 1, 2147483647)
    or not kaban_private.is_integer(data->'createdAt', 0)
    or not kaban_private.is_integer(data->'updatedAt', 0)
  ) then
    return false;
  end if;
  if entity <> 'split' and ((data->'version')::numeric <> version or (data->'updatedAt')::numeric <> updated_ms) then
    return false;
  end if;

  case entity
    when 'account' then
      allowed := common || array['type','name','openingMinor','openingDate','creditLimitMinor','closingDay','dueDaysAfterClosing','issuer','bankId','last4','color','archived','sortOrder'];
      valid := (data->>'type') in ('cash','debit','credit')
        and kaban_private.is_text(data->'name') and (data->>'name') ~ '[^[:space:]]'
        and kaban_private.is_integer(data->'openingMinor', -9007199254740991)
        and kaban_private.is_date(data->'openingDate')
        and (not (data ? 'creditLimitMinor') or kaban_private.is_integer(data->'creditLimitMinor', 0))
        and (not (data ? 'closingDay') or kaban_private.is_integer(data->'closingDay', 1, 31))
        and (not (data ? 'dueDaysAfterClosing') or kaban_private.is_integer(data->'dueDaysAfterClosing', 1, 60))
        and (not (data ? 'issuer') or kaban_private.is_text(data->'issuer'))
        and (not (data ? 'bankId') or kaban_private.is_id(data->'bankId'))
        and (not (data ? 'last4') or (kaban_private.is_text(data->'last4', 4) and (data->>'last4') ~ '^[0-9]{4}$'))
        and (data->>'color') ~ '^#[a-fA-F0-9]{6}$'
        and jsonb_typeof(data->'archived') = 'boolean'
        and kaban_private.is_integer(data->'sortOrder', 0);
    when 'transaction' then
      allowed := common || array['type','accountId','toAccountId','amountMinor','currency','date','description','category','notes','arrangement','instalmentCount','debtId','personId','state'];
      valid := (data->>'type') in ('expense','income','transfer','card_payment','adjustment','reimbursement','refund','member_payment')
        and kaban_private.is_id(data->'accountId')
        and (not (data ? 'toAccountId') or kaban_private.is_id(data->'toAccountId'))
        and ((data->>'type') not in ('transfer','card_payment')
          or (kaban_private.is_id(data->'toAccountId') and (data->>'toAccountId') <> (data->>'accountId')))
        and kaban_private.is_integer(data->'amountMinor', case when data->>'type' = 'adjustment' then -9007199254740991 else 1 end)
        and (data->'amountMinor') <> '0'::jsonb
        and (data->>'currency') = 'PHP'
        and kaban_private.is_date(data->'date')
        and kaban_private.is_text(data->'description')
        and (not (data ? 'category') or kaban_private.is_text(data->'category'))
        and (not (data ? 'notes') or kaban_private.is_text(data->'notes'))
        and (not (data ? 'arrangement') or (data->>'arrangement') in ('regular','deferred','instalment'))
        and (not (data ? 'instalmentCount') or kaban_private.is_integer(data->'instalmentCount', 2, 60))
        and ((data->>'arrangement') is distinct from 'instalment'
          or ((data->>'type') = 'expense' and kaban_private.is_integer(data->'instalmentCount', 2, 60)))
        and (not (data ? 'debtId') or kaban_private.is_id(data->'debtId'))
        and (not (data ? 'personId') or kaban_private.is_id(data->'personId'))
        and (data->>'state') in ('active','void');
    when 'person' then
      allowed := common || array['name','nickname','color','archived'];
      valid := kaban_private.is_text(data->'name') and (data->>'name') ~ '[^[:space:]]'
        and (not (data ? 'nickname') or kaban_private.is_text(data->'nickname'))
        and (data->>'color') ~ '^#[a-fA-F0-9]{6}$'
        and jsonb_typeof(data->'archived') = 'boolean';
    when 'debt' then
      allowed := common || array['personId','transactionId','amountMinor','description','date','state'];
      valid := kaban_private.is_id(data->'personId')
        and (not (data ? 'transactionId') or kaban_private.is_id(data->'transactionId'))
        and kaban_private.is_integer(data->'amountMinor', 1)
        and kaban_private.is_text(data->'description')
        and kaban_private.is_date(data->'date')
        and (data->>'state') in ('active','void');
    when 'split' then
      allowed := array['id','transactionId','personId','amountMinor'];
      valid := version = 1 and updated_ms = 0
        and kaban_private.is_id(data->'transactionId')
        and kaban_private.is_id(data->'personId')
        and kaban_private.is_integer(data->'amountMinor', 1);
    else return false;
  end case;
  return coalesce(valid, false) and data - allowed = '{}'::jsonb;
end $$;

-- ---------- Contributions: edits and conflicts ----------

alter table public.family_contributions
  add column if not exists kind text not null default 'new' check (kind in ('new', 'edit')),
  -- For edits: updatedAt of the version the member was editing. The owner applies the edit only if their
  -- copy still has exactly this timestamp.
  add column if not exists base_updated_ms bigint;

alter table public.family_contributions drop constraint if exists family_contributions_status_check;
alter table public.family_contributions add constraint family_contributions_status_check
  check (status in ('pending', 'imported', 'cancelled', 'conflict'));

create or replace function kaban_private.family_txn_ok(p_txn jsonb, p_account text, p_version integer, p_credit boolean) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_txn) = 'object'
    and octet_length(p_txn::text) <= 16384
    and (p_txn ->> 'type') in ('expense', 'income', 'refund', 'member_payment')
    and ((p_txn ->> 'type') <> 'member_payment' or (p_credit and not (p_txn ? 'arrangement')))
    and ((p_txn ->> 'type') <> 'income' or not p_credit)
    and (p_txn ->> 'accountId') is not distinct from p_account
    and not (p_txn ? 'toAccountId') and not (p_txn ? 'debtId') and not (p_txn ? 'personId')
    and (p_txn ->> 'state') in ('active', 'void')
    and (p_txn ->> 'version') = p_version::text
    and kaban_private.valid_record('transaction', p_txn ->> 'id', p_version, (p_txn ->> 'updatedAt')::bigint, p_txn);
$$;

create or replace function public.add_family_transaction(p_family uuid, p_owner uuid, p_account text, p_txn jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_id text := p_txn ->> 'id';
  v_credit boolean;
  prev public.family_contributions;
begin
  select (s.snapshot -> 'account' ->> 'type') = 'credit' into v_credit
  from public.family_shared_accounts s
  where s.family_id = p_family and s.owner_id = p_owner and s.account_id = p_account and s.allow_add;
  if kaban_private.member_role(p_family, uid) is null or p_owner = uid or v_credit is null then
    return 'not_shared';
  end if;

  select * into prev from public.family_contributions where id = v_id;
  if found then
    return case when prev.author_id = uid and prev.data = p_txn then 'ok' else 'invalid' end;
  end if;

  if (p_txn ->> 'state') is distinct from 'active' or not kaban_private.family_txn_ok(p_txn, p_account, 1, v_credit) then
    return 'invalid';
  end if;
  if (select count(*) from public.family_contributions where author_id = uid and status = 'pending') >= 500 then
    return 'limit';
  end if;

  insert into public.family_contributions (id, family_id, owner_id, account_id, author_id, data, bytes)
  values (v_id, p_family, p_owner, p_account, uid, p_txn, octet_length(p_txn::text));
  return 'ok';
end $$;

-- Change or void something this user added. Returns ok, conflict (owner already changed it), not_shared
-- or invalid.
create function public.update_family_transaction(p_txn jsonb, p_base_updated_ms bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  prev public.family_contributions;
  v_credit boolean;
  v_version integer;
begin
  select * into prev from public.family_contributions where id = p_txn ->> 'id' and author_id = uid for update;
  if not found or prev.status = 'cancelled' then
    return 'invalid';
  end if;
  if prev.status = 'conflict' then
    return 'conflict';
  end if;
  if prev.family_id is null or kaban_private.member_role(prev.family_id, uid) is null then
    return 'not_shared';
  end if;
  select (s.snapshot -> 'account' ->> 'type') = 'credit' into v_credit
  from public.family_shared_accounts s
  where s.family_id = prev.family_id and s.owner_id = prev.owner_id and s.account_id = prev.account_id;
  if v_credit is null then
    return 'not_shared';
  end if;

  v_version := (prev.data ->> 'version')::integer + 1;
  if (p_txn ->> 'type') is distinct from (prev.data ->> 'type')
     or not kaban_private.family_txn_ok(p_txn, prev.account_id, v_version, v_credit) then
    return 'invalid';
  end if;

  if prev.status = 'pending' and prev.kind = 'new' then
    -- Not imported yet: just replace what will be imported.
    update public.family_contributions set data = p_txn, bytes = octet_length(p_txn::text) where id = prev.id;
  else
    update public.family_contributions
      set data = p_txn,
          bytes = octet_length(p_txn::text),
          kind = 'edit',
          -- Several edits before the owner syncs all compare against the version the owner actually has.
          base_updated_ms = case when prev.status = 'pending' then prev.base_updated_ms else p_base_updated_ms end,
          status = 'pending',
          decided_at = null
      where id = prev.id;
  end if;
  return 'ok';
end $$;

create or replace function public.cancel_family_transaction(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.family_contributions set status = 'cancelled', decided_at = now()
    where id = p_id and author_id = uid and status = 'pending' and kind = 'new';
end $$;

create or replace function public.pull_family_contributions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'family_id', c.family_id,
      'account_id', c.account_id,
      'author_id', c.author_id,
      'author_name', p.display_name,
      'kind', c.kind,
      'base_updated_ms', c.base_updated_ms,
      'data', c.data,
      'created_at', c.created_at
    ) order by c.created_at)
    from (
      select * from public.family_contributions
      where owner_id = uid and status = 'pending'
      order by created_at limit 500
    ) c left join public.profiles p on p.user_id = c.author_id
  ), '[]'::jsonb);
end $$;

create function public.reject_family_contributions(p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.family_contributions set status = 'conflict', decided_at = now()
    where owner_id = uid and status = 'pending' and kind = 'edit' and id = any (p_ids);
end $$;

-- ---------- Reads ----------

create or replace function public.get_my_families() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  return jsonb_build_object(
    'max_families', kaban_private.max_families(uid),
    'families', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'description', f.description,
        'icon', f.icon,
        'color', f.color,
        'created_at', f.created_at,
        'role', me.role,
        'members', (
          select jsonb_agg(jsonb_build_object(
            'user_id', m.user_id,
            'role', m.role,
            'joined_at', m.joined_at,
            'display_name', p.display_name,
            'avatar', p.avatar
          ) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at)
          from public.family_members m left join public.profiles p on p.user_id = m.user_id
          where m.family_id = f.id
        ),
        'invite', case when me.role in ('owner', 'admin') then (
          select jsonb_build_object('code', i.code, 'expires_at', i.expires_at)
          from public.family_invites i where i.family_id = f.id
        ) end,
        'requests', case when me.role in ('owner', 'admin') then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', r.id,
            'user_id', r.user_id,
            'created_at', r.created_at,
            'display_name', p.display_name,
            'avatar', p.avatar
          ) order by r.created_at)
          from public.family_join_requests r left join public.profiles p on p.user_id = r.user_id
          where r.family_id = f.id and r.status = 'pending'
        ), '[]'::jsonb) else '[]'::jsonb end,
        'shared', coalesce((
          select jsonb_agg(jsonb_build_object(
            'owner_id', s.owner_id,
            'account_id', s.account_id,
            'visibility', s.visibility,
            'allow_add', s.allow_add,
            'snapshot', s.snapshot,
            'updated_at', s.updated_at
          ) order by s.updated_at desc)
          from public.family_shared_accounts s where s.family_id = f.id
        ), '[]'::jsonb),
        -- This user's transactions on others' shared accounts that the owner hasn't brought in yet.
        'my_pending', coalesce((
          select jsonb_agg(c.id)
          from public.family_contributions c
          where c.family_id = f.id and c.author_id = uid and c.status = 'pending'
        ), '[]'::jsonb),
        -- Edits the owner's device turned down because the owner had already changed that transaction.
        'my_conflicts', coalesce((
          select jsonb_agg(c.id)
          from public.family_contributions c
          where c.family_id = f.id and c.author_id = uid and c.status = 'conflict' and c.decided_at > now() - interval '60 days'
        ), '[]'::jsonb)
      ) order by me.joined_at)
      from public.family_members me join public.families f on f.id = me.family_id
      where me.user_id = uid
    ), '[]'::jsonb),
    'my_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'family_id', r.family_id,
        'family_name', f.name,
        'family_icon', f.icon,
        'family_color', f.color,
        'status', r.status,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.family_join_requests r join public.families f on f.id = r.family_id
      where r.user_id = uid and (r.status = 'pending' or r.decided_at > now() - interval '14 days')
    ), '[]'::jsonb)
  );
end $$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.add_family_transaction(uuid, uuid, text, jsonb)',
    'public.update_family_transaction(jsonb, bigint)',
    'public.cancel_family_transaction(text)',
    'public.pull_family_contributions()',
    'public.reject_family_contributions(text[])',
    'public.get_my_families()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

revoke all on all functions in schema kaban_private from public, anon, authenticated;
