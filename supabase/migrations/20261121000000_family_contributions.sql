-- Members add transactions to accounts shared with their family.
--
-- Additive only. A member's transaction is stored here as a pending contribution; the account owner's
-- device imports it into the owner's own ledger (through the normal push path) and acknowledges it.
-- Nothing on the server writes into anyone's ledger, and contributions are never hard-deleted.

alter table public.family_shared_accounts add column if not exists allow_add boolean not null default true;

create table public.family_contributions (
  id         text primary key check (id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  -- Kept (set null) if the family is deleted, so the owner can still import what was already sent.
  family_id  uuid references public.families (id) on delete set null,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  account_id text not null check (account_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  author_id  uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  bytes      integer not null default 0,
  status     text not null default 'pending' check (status in ('pending', 'imported', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index family_contributions_owner on public.family_contributions (owner_id, status, created_at);
create index family_contributions_author on public.family_contributions (author_id, status);

alter table public.family_contributions enable row level security;
revoke all on public.family_contributions from anon, authenticated;

-- ---------- Sharing with the "members can add" switch ----------

create function public.publish_shared_account(p_family uuid, p_account text, p_visibility text, p_snapshot jsonb, p_allow_add boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_status text;
begin
  v_status := public.publish_shared_account(p_family, p_account, p_visibility, p_snapshot);
  if v_status = 'ok' then
    update public.family_shared_accounts set allow_add = coalesce(p_allow_add, true)
      where family_id = p_family and owner_id = uid and account_id = p_account;
  end if;
  return v_status;
end $$;

-- ---------- Member side ----------

create function public.add_family_transaction(p_family uuid, p_owner uuid, p_account text, p_txn jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_id text := p_txn ->> 'id';
  v_bytes integer := octet_length(p_txn::text);
  prev public.family_contributions;
begin
  if kaban_private.member_role(p_family, uid) is null or p_owner = uid
     or not exists (
       select 1 from public.family_shared_accounts s
       where s.family_id = p_family and s.owner_id = p_owner and s.account_id = p_account and s.allow_add
     ) then
    return 'not_shared';
  end if;

  select * into prev from public.family_contributions where id = v_id;
  if found then
    -- A retry of something already sent is fine; anything else reusing the id is not.
    return case when prev.author_id = uid and prev.data = p_txn then 'ok' else 'invalid' end;
  end if;

  if v_bytes > 16384
     or jsonb_typeof(p_txn) is distinct from 'object'
     or (p_txn ->> 'type') not in ('expense', 'income', 'refund')
     or (p_txn ->> 'accountId') is distinct from p_account
     or p_txn ? 'toAccountId' or p_txn ? 'debtId' or p_txn ? 'personId'
     or (p_txn ->> 'state') is distinct from 'active'
     or (p_txn ->> 'version') is distinct from '1'
     or not kaban_private.valid_record('transaction', v_id, 1, (p_txn ->> 'updatedAt')::bigint, p_txn) then
    return 'invalid';
  end if;

  if (select count(*) from public.family_contributions where author_id = uid and status = 'pending') >= 500 then
    return 'limit';
  end if;

  insert into public.family_contributions (id, family_id, owner_id, account_id, author_id, data, bytes)
  values (v_id, p_family, p_owner, p_account, uid, p_txn, v_bytes);
  return 'ok';
end $$;

create function public.cancel_family_transaction(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.family_contributions set status = 'cancelled', decided_at = now()
    where id = p_id and author_id = uid and status = 'pending';
end $$;

-- ---------- Owner side ----------

create function public.pull_family_contributions() returns jsonb
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

-- Called after the owner's device has saved them into its ledger.
create function public.ack_family_contributions(p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.family_contributions set status = 'imported', decided_at = now()
    where owner_id = uid and status = 'pending' and id = any (p_ids);
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
    'public.publish_shared_account(uuid, text, text, jsonb, boolean)',
    'public.add_family_transaction(uuid, uuid, text, jsonb)',
    'public.cancel_family_transaction(text)',
    'public.pull_family_contributions()',
    'public.ack_family_contributions(text[])',
    'public.get_my_families()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;
