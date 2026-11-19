-- A generation fences every paged pull and write against cloud deletion.
alter table public.user_quota
  add column sync_generation bigint not null default 1,
  add column row_count integer not null default 0;

insert into public.user_quota (user_id)
  select id from auth.users on conflict do nothing;

update public.user_quota q
set row_count = counts.rows, record_count = counts.records, byte_count = counts.bytes
from (
  select q.user_id,
    count(r.id)::integer as rows,
    (count(r.id) filter (where not r.deleted))::integer as records,
    coalesce(sum(r.bytes), 0) as bytes
  from public.user_quota q left join public.records r on r.user_id = q.user_id
  group by q.user_id
) counts
where q.user_id = counts.user_id;

grant select on public.user_quota to authenticated;

create schema kaban_private;
revoke all on schema kaban_private from public, anon, authenticated;

create function kaban_private.is_integer(value jsonb, minimum bigint, maximum bigint default 9007199254740991)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'number' then
    value::numeric between minimum and maximum and trunc(value::numeric) = value::numeric
  else false end;
$$;

create function kaban_private.is_text(value jsonb, maximum integer default 8192)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'string' and char_length(value #>> '{}') <= maximum, false);
$$;

create function kaban_private.is_id(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select kaban_private.is_text(value, 80) and (value #>> '{}') ~ '^[a-zA-Z0-9_-]{1,80}$';
$$;

create function kaban_private.is_date(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if not kaban_private.is_text(value, 10) or (value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  perform (value #>> '{}')::date;
  return true;
exception when datetime_field_overflow or invalid_datetime_format then
  return false;
end $$;

create function kaban_private.valid_record(entity text, id text, version integer, updated_ms bigint, data jsonb)
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
      valid := (data->>'type') in ('expense','income','transfer','card_payment','adjustment','reimbursement','refund')
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

-- Removing the old signature prevents earlier clients from writing without a generation.
drop function public.push_records(jsonb);

create function public.push_records(p_changes jsonb, p_generation bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.user_quota;
  c jsonb;
  prev public.records;
  v_entity text;
  v_id text;
  v_version integer;
  v_ms bigint;
  v_deleted boolean;
  v_data jsonb;
  v_bytes integer;
  d_count integer;
  d_rows integer;
  d_bytes bigint;
  results jsonb := '[]'::jsonb;
begin
  if uid is null or not public.mfa_satisfied() then
    raise exception 'an authenticated session with required MFA is needed' using errcode = '28000';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'expected an array of changes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) > 500 or octet_length(p_changes::text) > 33554432 then
    raise exception 'change batch is too large' using errcode = '22023';
  end if;

  select * into strict q from public.user_quota where user_id = uid for update;
  if p_generation is distinct from q.sync_generation then
    raise exception 'cloud ledger was reset' using errcode = '40001';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    v_entity := c->>'entity';
    v_id := c->>'id';
    if v_entity is null or v_entity not in ('account','transaction','person','debt','split')
       or not kaban_private.is_id(c->'id')
       or not kaban_private.is_integer(c->'version', 1, 2147483647)
       or not kaban_private.is_integer(c->'updated_ms', 0)
       or jsonb_typeof(c->'deleted') is distinct from 'boolean' then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'invalid');
      continue;
    end if;
    v_version := ((c->'version')::numeric)::integer;
    v_ms := ((c->'updated_ms')::numeric)::bigint;
    v_deleted := (c->'deleted')::boolean;
    v_data := case when v_deleted then null else c->'data' end;
    v_bytes := coalesce(octet_length(v_data::text), 0);
    if v_bytes > 65536 or (not v_deleted and not kaban_private.valid_record(v_entity, v_id, v_version, v_ms, v_data)) then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'invalid');
      continue;
    end if;

    select * into prev from public.records r where r.user_id = uid and r.entity = v_entity and r.id = v_id;
    d_rows := case when found then 0 else 1 end;
    if d_rows = 0 and (prev.version, prev.updated_ms) >= (v_version, v_ms) then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'stale');
      continue;
    end if;

    d_count := (case when v_deleted then 0 else 1 end) - (case when d_rows = 0 and not prev.deleted then 1 else 0 end);
    d_bytes := v_bytes - coalesce(prev.bytes, 0);
    if (d_rows > 0 and q.row_count >= q.max_records)
       or (d_bytes > 0 and q.byte_count + d_bytes > q.max_bytes) then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'quota');
      continue;
    end if;

    insert into public.records as r (user_id, entity, id, version, updated_ms, data, deleted, bytes)
      values (uid, v_entity, v_id, v_version, v_ms, v_data, v_deleted, v_bytes)
    on conflict (user_id, entity, id) do update
      set version = excluded.version,
          updated_ms = excluded.updated_ms,
          data = excluded.data,
          deleted = excluded.deleted,
          bytes = excluded.bytes,
          server_seq = nextval('public.records_seq'),
          updated_at = now();

    q.row_count := q.row_count + d_rows;
    q.record_count := q.record_count + d_count;
    q.byte_count := q.byte_count + d_bytes;
    results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'ok');
  end loop;

  update public.user_quota
    set row_count = q.row_count, record_count = q.record_count, byte_count = q.byte_count, updated_at = now()
    where user_id = uid;
  return results;
end $$;

create function public.pull_records(p_generation bigint, p_cursor bigint, p_limit integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  generation bigint;
  result jsonb;
begin
  if uid is null or not public.mfa_satisfied() then
    raise exception 'an authenticated session with required MFA is needed' using errcode = '28000';
  end if;
  if p_cursor is null or p_cursor < 0 or p_limit is null or p_limit not between 1 and 500 then
    raise exception 'invalid pull page' using errcode = '22023';
  end if;

  select sync_generation into strict generation from public.user_quota where user_id = uid for share;
  if p_generation is distinct from generation then
    raise exception 'cloud ledger was reset' using errcode = '40001';
  end if;
  select coalesce(jsonb_agg(page order by page.server_seq), '[]'::jsonb) into result from (
    select entity, id, version, updated_ms, data, deleted, server_seq
    from public.records where user_id = uid and server_seq > p_cursor
    order by server_seq limit p_limit
  ) page;
  return result;
end $$;

drop function public.delete_my_cloud_data();
create function public.delete_my_cloud_data() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  generation bigint;
begin
  if uid is null or not public.mfa_satisfied() then
    raise exception 'an authenticated session with required MFA is needed' using errcode = '28000';
  end if;

  update public.user_quota
    set sync_generation = sync_generation + 1, row_count = 0, record_count = 0, byte_count = 0, updated_at = now()
    where user_id = uid returning sync_generation into strict generation;
  delete from public.records where user_id = uid;
  return generation;
end $$;

revoke all on function public.push_records(jsonb, bigint) from public, anon, authenticated;
revoke all on function public.pull_records(bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.delete_my_cloud_data() from public, anon, authenticated;
grant execute on function public.push_records(jsonb, bigint) to authenticated;
grant execute on function public.pull_records(bigint, bigint, integer) to authenticated;
grant execute on function public.delete_my_cloud_data() to authenticated;
