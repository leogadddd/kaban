-- Profiles and families.
--
-- Purely additive: no existing table, policy or function is changed or dropped, so personal ledgers
-- (public.records) are untouched. Family data lives in its own tables. Clients only read through the
-- RPCs below (all SECURITY DEFINER, all checking the caller and their 2FA level).
--
-- Shared accounts are read-only snapshots the owner's device publishes. A member never reads another
-- member's ledger rows, and removing a share or a member only deletes snapshots, never ledger data.

-- ---------- Helpers ----------

create function kaban_private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.mfa_satisfied() then
    raise exception 'an authenticated session with required MFA is needed' using errcode = '28000';
  end if;
  return uid;
end $$;

create function kaban_private.clean_text(value text, maximum integer) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(coalesce(value, '')), maximum), '');
$$;

-- ---------- Profiles ----------

create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  birthday     date check (birthday is null or birthday >= date '1900-01-01'),
  -- Small square image as a data URL (resized on the device). Kept inline so it caches offline.
  avatar       text check (avatar is null or (octet_length(avatar) <= 65536 and avatar ~ '^data:image/(webp|jpeg|png);base64,')),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- Reads go through get_my_profile / get_my_families; writes through save_my_profile.
revoke all on public.profiles from anon, authenticated;

create function public.get_my_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  p public.profiles;
begin
  select * into p from public.profiles where user_id = uid;
  return jsonb_build_object(
    'display_name', p.display_name,
    'birthday', p.birthday,
    'avatar', p.avatar,
    'updated_at', p.updated_at
  );
end $$;

create function public.save_my_profile(p_display_name text, p_birthday date, p_avatar text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  if p_birthday is not null and p_birthday > current_date then
    raise exception 'birthday can''t be in the future' using errcode = '22023';
  end if;
  insert into public.profiles as p (user_id, display_name, birthday, avatar, updated_at)
  values (uid, kaban_private.clean_text(p_display_name, 60), p_birthday, nullif(p_avatar, ''), now())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        birthday = excluded.birthday,
        avatar = excluded.avatar,
        updated_at = now();
  return public.get_my_profile();
end $$;

-- ---------- Entitlements ----------

-- How many families a user may belong to. Raised by the payment flow later; 1 for everyone now.
create table public.user_entitlements (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  max_families integer not null default 1 check (max_families between 0 and 50),
  updated_at   timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;
revoke all on public.user_entitlements from anon, authenticated;

create function kaban_private.max_families(uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select max_families from public.user_entitlements where user_id = uid), 1);
$$;

-- ---------- Families ----------

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  icon        text not null default '🏠' check (char_length(icon) between 1 and 16),
  color       text not null default '#2D936C' check (color ~ '^#[a-fA-F0-9]{6}$'),
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user on public.family_members (user_id);
-- Exactly one owner per family.
create unique index family_members_one_owner on public.family_members (family_id) where role = 'owner';

-- One live invite code per family. The QR code is a link carrying this code.
create table public.family_invites (
  family_id  uuid primary key references public.families (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.family_join_requests (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);

create unique index family_join_requests_one_pending on public.family_join_requests (family_id, user_id) where status = 'pending';
create index family_join_requests_user on public.family_join_requests (user_id, created_at desc);

-- Read-only account snapshots an owner shares with a family.
create table public.family_shared_accounts (
  family_id  uuid not null references public.families (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  account_id text not null check (account_id ~ '^[a-zA-Z0-9_-]{1,80}$'),
  visibility text not null check (visibility in ('balance', 'activity')),
  snapshot   jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  bytes      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (family_id, owner_id, account_id)
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.family_join_requests enable row level security;
alter table public.family_shared_accounts enable row level security;
revoke all on public.families, public.family_members, public.family_invites, public.family_join_requests, public.family_shared_accounts from anon, authenticated;

-- A member who leaves or is removed stops sharing with that family.
create function kaban_private.drop_member_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.family_shared_accounts where family_id = old.family_id and owner_id = old.user_id;
  return old;
end $$;

create trigger family_member_removed
  after delete on public.family_members
  for each row execute function kaban_private.drop_member_shares();

create function kaban_private.member_role(p_family uuid, uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.family_members where family_id = p_family and user_id = uid;
$$;

create function kaban_private.require_admin(p_family uuid, uid uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  r text := kaban_private.member_role(p_family, uid);
begin
  if r is null or r not in ('owner', 'admin') then
    raise exception 'only family admins can do that' using errcode = '42501';
  end if;
  return r;
end $$;

create function kaban_private.new_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
  -- 10 random bytes from a v4 UUID, skipping the version (6) and variant (8) bytes. 256 % 32 = 0, so unbiased.
  bytes bytea := uuid_send(gen_random_uuid());
  picks constant integer[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12];
  out text := '';
begin
  foreach i in array picks loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

create function kaban_private.rotate_invite(p_family uuid, uid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  loop
    v_code := kaban_private.new_invite_code();
    begin
      insert into public.family_invites (family_id, code, created_by, expires_at)
      values (p_family, v_code, uid, now() + interval '7 days')
      on conflict (family_id) do update
        set code = excluded.code, created_by = excluded.created_by, created_at = now(), expires_at = excluded.expires_at;
      return v_code;
    exception when unique_violation then
      -- Code collided with another family's; try again.
    end;
  end loop;
end $$;

-- ---------- Reads ----------

-- Everything the Family tab needs in one round trip; the device caches it for offline use.
create function public.get_my_families() returns jsonb
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
            'snapshot', s.snapshot,
            'updated_at', s.updated_at
          ) order by s.updated_at desc)
          from public.family_shared_accounts s where s.family_id = f.id
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

-- What a scanned code points at, before asking to join.
create function public.preview_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  inv public.family_invites;
  f public.families;
begin
  select * into inv from public.family_invites where code = upper(btrim(p_code));
  if not found or inv.expires_at < now() then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into f from public.families where id = inv.family_id;
  return jsonb_build_object(
    'status', case
      when exists (select 1 from public.family_members where family_id = f.id and user_id = uid) then 'member'
      when exists (select 1 from public.family_join_requests where family_id = f.id and user_id = uid and status = 'pending') then 'pending'
      else 'ok' end,
    'family_id', f.id,
    'name', f.name,
    'icon', f.icon,
    'color', f.color,
    'description', f.description,
    'member_count', (select count(*) from public.family_members where family_id = f.id)
  );
end $$;

-- ---------- Family lifecycle ----------

create function public.create_family(p_name text, p_description text, p_icon text, p_color text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_id uuid;
begin
  -- Serialise this user's membership changes so the family limit holds.
  perform pg_advisory_xact_lock(hashtext('kaban-family-user:' || uid::text));
  if (select count(*) from public.family_members where user_id = uid) >= kaban_private.max_families(uid) then
    raise exception 'family limit reached' using errcode = 'P0001', hint = 'limit';
  end if;
  insert into public.families (name, description, icon, color, created_by)
  values (
    coalesce(kaban_private.clean_text(p_name, 60), 'My family'),
    kaban_private.clean_text(p_description, 200),
    coalesce(kaban_private.clean_text(p_icon, 16), '🏠'),
    coalesce(nullif(p_color, ''), '#2D936C'),
    uid
  )
  returning id into v_id;
  insert into public.family_members (family_id, user_id, role) values (v_id, uid, 'owner');
  perform kaban_private.rotate_invite(v_id, uid);
  return v_id;
end $$;

create function public.update_family(p_family uuid, p_name text, p_description text, p_icon text, p_color text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  perform kaban_private.require_admin(p_family, uid);
  update public.families
    set name = coalesce(kaban_private.clean_text(p_name, 60), name),
        description = kaban_private.clean_text(p_description, 200),
        icon = coalesce(kaban_private.clean_text(p_icon, 16), icon),
        color = coalesce(nullif(p_color, ''), color),
        updated_at = now()
    where id = p_family;
end $$;

create function public.delete_family(p_family uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  if kaban_private.member_role(p_family, uid) is distinct from 'owner' then
    raise exception 'only the family owner can delete it' using errcode = '42501';
  end if;
  -- Only family rows go: members' own ledgers are never touched.
  delete from public.families where id = p_family;
end $$;

create function public.rotate_family_invite(p_family uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  perform kaban_private.require_admin(p_family, uid);
  return kaban_private.rotate_invite(p_family, uid);
end $$;

-- ---------- Joining ----------

create function public.request_join(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  inv public.family_invites;
  v_id uuid;
begin
  select * into inv from public.family_invites where code = upper(btrim(p_code));
  if not found or inv.expires_at < now() then
    raise exception 'this invite has expired or is not valid' using errcode = 'P0001', hint = 'invalid';
  end if;
  if exists (select 1 from public.family_members where family_id = inv.family_id and user_id = uid) then
    raise exception 'you are already in this family' using errcode = 'P0001', hint = 'member';
  end if;
  select id into v_id from public.family_join_requests
    where family_id = inv.family_id and user_id = uid and status = 'pending';
  if found then
    return v_id;
  end if;
  if (select count(*) from public.family_members where user_id = uid) >= kaban_private.max_families(uid) then
    raise exception 'family limit reached' using errcode = 'P0001', hint = 'limit';
  end if;
  if (select count(*) from public.family_join_requests where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many join requests today' using errcode = 'P0001', hint = 'rate';
  end if;
  insert into public.family_join_requests (family_id, user_id) values (inv.family_id, uid) returning id into v_id;
  return v_id;
end $$;

create function public.cancel_join_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  update public.family_join_requests
    set status = 'cancelled', decided_at = now(), decided_by = uid
    where id = p_request and user_id = uid and status = 'pending';
end $$;

create function public.respond_join_request(p_request uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  req public.family_join_requests;
begin
  select * into req from public.family_join_requests where id = p_request for update;
  if not found or req.status <> 'pending' then
    return; -- Another admin already answered it.
  end if;
  perform kaban_private.require_admin(req.family_id, uid);
  if p_approve then
    perform pg_advisory_xact_lock(hashtext('kaban-family-user:' || req.user_id::text));
    if (select count(*) from public.family_members where user_id = req.user_id) >= kaban_private.max_families(req.user_id) then
      raise exception 'they are already in the maximum number of families' using errcode = 'P0001', hint = 'limit';
    end if;
    insert into public.family_members (family_id, user_id, role) values (req.family_id, req.user_id, 'member')
    on conflict do nothing;
  end if;
  update public.family_join_requests
    set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = uid
    where id = p_request;
end $$;

-- ---------- Members ----------

create function public.set_member_role(p_family uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  target text;
begin
  perform kaban_private.require_admin(p_family, uid);
  if p_role not in ('admin', 'member') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  target := kaban_private.member_role(p_family, p_user);
  if target is null then
    raise exception 'they are not in this family' using errcode = 'P0001';
  end if;
  if target = 'owner' then
    raise exception 'the owner''s role can''t be changed' using errcode = '42501';
  end if;
  update public.family_members set role = p_role where family_id = p_family and user_id = p_user;
end $$;

create function public.transfer_family_ownership(p_family uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  if kaban_private.member_role(p_family, uid) is distinct from 'owner' then
    raise exception 'only the owner can hand over ownership' using errcode = '42501';
  end if;
  if p_user = uid or kaban_private.member_role(p_family, p_user) is null then
    raise exception 'pick another member of this family' using errcode = 'P0001';
  end if;
  update public.family_members set role = 'admin' where family_id = p_family and user_id = uid;
  update public.family_members set role = 'owner' where family_id = p_family and user_id = p_user;
end $$;

create function public.remove_family_member(p_family uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  mine text;
  target text;
begin
  mine := kaban_private.require_admin(p_family, uid);
  target := kaban_private.member_role(p_family, p_user);
  if target is null then
    return;
  end if;
  if p_user = uid then
    raise exception 'use Leave family instead' using errcode = 'P0001';
  end if;
  if target = 'owner' or (target = 'admin' and mine <> 'owner') then
    raise exception 'you can''t remove this member' using errcode = '42501';
  end if;
  delete from public.family_members where family_id = p_family and user_id = p_user;
end $$;

create function public.leave_family(p_family uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  if kaban_private.member_role(p_family, uid) = 'owner' then
    if exists (select 1 from public.family_members where family_id = p_family and user_id <> uid) then
      raise exception 'hand over ownership before leaving' using errcode = 'P0001', hint = 'owner';
    end if;
    delete from public.families where id = p_family;
    return;
  end if;
  delete from public.family_members where family_id = p_family and user_id = uid;
end $$;

-- ---------- Shared account snapshots ----------

create function public.publish_shared_account(p_family uuid, p_account text, p_visibility text, p_snapshot jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
  v_bytes integer := octet_length(p_snapshot::text);
begin
  if kaban_private.member_role(p_family, uid) is null then
    return 'gone'; -- Not in this family any more; the device drops the share.
  end if;
  if p_visibility not in ('balance', 'activity') or jsonb_typeof(p_snapshot) is distinct from 'object'
     or p_account !~ '^[a-zA-Z0-9_-]{1,80}$' or v_bytes > 262144 then
    return 'invalid';
  end if;
  if not exists (select 1 from public.family_shared_accounts where family_id = p_family and owner_id = uid and account_id = p_account)
     and (select count(*) from public.family_shared_accounts where family_id = p_family) >= 100 then
    return 'limit';
  end if;
  insert into public.family_shared_accounts (family_id, owner_id, account_id, visibility, snapshot, bytes)
  values (p_family, uid, p_account, p_visibility, p_snapshot, v_bytes)
  on conflict (family_id, owner_id, account_id) do update
    set visibility = excluded.visibility, snapshot = excluded.snapshot, bytes = excluded.bytes, updated_at = now();
  return 'ok';
end $$;

create function public.unpublish_shared_account(p_family uuid, p_account text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := kaban_private.require_user();
begin
  delete from public.family_shared_accounts where family_id = p_family and owner_id = uid and account_id = p_account;
end $$;

-- ---------- Grants ----------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_my_profile()',
    'public.save_my_profile(text, date, text)',
    'public.get_my_families()',
    'public.preview_invite(text)',
    'public.create_family(text, text, text, text)',
    'public.update_family(uuid, text, text, text, text)',
    'public.delete_family(uuid)',
    'public.rotate_family_invite(uuid)',
    'public.request_join(text)',
    'public.cancel_join_request(uuid)',
    'public.respond_join_request(uuid, boolean)',
    'public.set_member_role(uuid, uuid, text)',
    'public.transfer_family_ownership(uuid, uuid)',
    'public.remove_family_member(uuid, uuid)',
    'public.leave_family(uuid)',
    'public.publish_shared_account(uuid, text, text, jsonb)',
    'public.unpublish_shared_account(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

revoke all on all functions in schema kaban_private from public, anon, authenticated;
