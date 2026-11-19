-- Kaban cloud sync.
--
-- The app is local-first: devices write to IndexedDB and push their outbox here in the background.
-- Every synced record lives in one generic table keyed by (user, entity, id). Clients can only READ
-- their rows directly; all writes go through push_records(), which enforces versioning and the
-- per-user quota inside the database so a modified client can't bypass either.

-- ---------- Quota ----------

create table public.user_quota (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  max_records  integer not null default 10000,
  max_bytes    bigint  not null default 10485760, -- 10 MB of record JSON
  record_count integer not null default 0,
  byte_count   bigint  not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.user_quota enable row level security;

-- Read-only for the owner. Limits are changed by an admin (SQL editor / service role) only.
create policy "read own quota" on public.user_quota
  for select to authenticated using (user_id = (select auth.uid()));

-- Every new account gets a quota row with the defaults.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_quota (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Records ----------

create sequence public.records_seq;

create table public.records (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  entity     text    not null check (entity in ('account', 'transaction', 'person', 'debt', 'split')),
  id         text    not null check (length(id) between 1 and 80),
  version    integer not null check (version > 0),
  -- Client updatedAt (ms). Breaks ties between two devices that both produced the same version.
  updated_ms bigint  not null default 0,
  data       jsonb,
  deleted    boolean not null default false,
  bytes      integer not null default 0,
  -- Monotonic per user (pushes for one user are serialised by the quota row lock), so a device can
  -- pull "everything after the last seq I saw" without missing rows.
  server_seq bigint  not null default nextval('public.records_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity, id)
);

create index records_user_seq on public.records (user_id, server_seq);

alter table public.records enable row level security;

create policy "read own records" on public.records
  for select to authenticated using (user_id = (select auth.uid()));

-- If the user has a verified authenticator app, their session must have passed it (aal2).
create policy "require mfa when enrolled" on public.records
  as restrictive for select to authenticated using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors
      where user_id = (select auth.uid()) and status = 'verified'
    )
  );

-- ---------- Push ----------

-- p_changes: [{ entity, id, version, updated_ms, deleted, data }]
-- Returns  : [{ entity, id, status }] where status is
--   ok      written
--   stale   the server already has this version or newer (the client will pull it)
--   quota   would exceed the user's record or byte limit; nothing written
--   invalid malformed or oversized record
create function public.push_records(p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid        uuid := auth.uid();
  q          public.user_quota;
  c          jsonb;
  prev       public.records;
  v_entity   text;
  v_id       text;
  v_version  integer;
  v_ms       bigint;
  v_deleted  boolean;
  v_data     jsonb;
  v_bytes    integer;
  d_count    integer;
  d_bytes    bigint;
  results    jsonb := '[]'::jsonb;
  has_mfa    boolean;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then
    raise exception 'send at most 500 changes per batch' using errcode = '22023';
  end if;

  select exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified') into has_mfa;
  if has_mfa and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'two-factor verification required' using errcode = '28000';
  end if;

  insert into public.user_quota (user_id) values (uid) on conflict do nothing;
  -- Lock: serialises this user's pushes so quota counters and server_seq order stay exact.
  select * into q from public.user_quota where user_id = uid for update;

  for c in select * from jsonb_array_elements(p_changes) loop
    v_entity  := c ->> 'entity';
    v_id      := c ->> 'id';
    v_version := nullif(c ->> 'version', '')::integer;
    v_ms      := coalesce(nullif(c ->> 'updated_ms', '')::bigint, 0);
    v_deleted := coalesce((c ->> 'deleted')::boolean, false);
    v_data    := case when v_deleted then null else c -> 'data' end;
    v_bytes   := coalesce(octet_length(v_data::text), 0);

    if v_entity not in ('account', 'transaction', 'person', 'debt', 'split')
       or v_id is null or length(v_id) not between 1 and 80
       or v_version is null or v_version < 1
       or (not v_deleted and jsonb_typeof(v_data) <> 'object')
       or v_bytes > 65536 then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'invalid');
      continue;
    end if;

    select * into prev from public.records r
      where r.user_id = uid and r.entity = v_entity and r.id = v_id;

    if found and (prev.version, prev.updated_ms) >= (v_version, v_ms) then
      results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'stale');
      continue;
    end if;

    d_count := (case when v_deleted then 0 else 1 end) - (case when found and not prev.deleted then 1 else 0 end);
    d_bytes := v_bytes - coalesce(prev.bytes, 0);

    if (d_count > 0 and q.record_count + d_count > q.max_records)
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

    q.record_count := q.record_count + d_count;
    q.byte_count := q.byte_count + d_bytes;
    results := results || jsonb_build_object('entity', v_entity, 'id', v_id, 'status', 'ok');
  end loop;

  update public.user_quota
    set record_count = q.record_count, byte_count = q.byte_count, updated_at = now()
    where user_id = uid;

  return results;
end $$;

-- ---------- Delete my cloud data ----------

create function public.delete_my_cloud_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified')
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'two-factor verification required' using errcode = '28000';
  end if;
  perform 1 from public.user_quota where user_id = uid for update;
  delete from public.records where user_id = uid;
  update public.user_quota set record_count = 0, byte_count = 0, updated_at = now() where user_id = uid;
end $$;

revoke all on function public.push_records(jsonb) from public, anon;
revoke all on function public.delete_my_cloud_data() from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
grant execute on function public.delete_my_cloud_data() to authenticated;

-- Direct writes are never allowed; reads are filtered by the policies above.
revoke insert, update, delete on public.records from anon, authenticated;
revoke insert, update, delete on public.user_quota from anon, authenticated;
revoke all on sequence public.records_seq from anon, authenticated;
