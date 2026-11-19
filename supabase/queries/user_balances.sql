-- Admin queries: a user's balances computed from their synced records.
-- Run in the Supabase SQL editor (it runs as `postgres`, so RLS doesn't hide other users' rows).
--
-- Balances are never stored; like the app (src/lib/finance.ts) they are derived:
--   cash / debit account  balance     = opening + income + reimbursements + refunds + transfers in
--                                       − expenses − transfers out − card payments ± adjustments
--   credit account        outstanding = opening + purchases − card payments − refunds ± adjustments
-- Only active (non-void) transactions count. Amounts are stored in centavos; results are in pesos.
-- Totals skip archived accounts, matching the Home screen.


-- 1) Per account, for one user -------------------------------------------------------------------

with params as (
  select '5ab91bb4-e941-4731-b215-81c49113b32b'::uuid as uid   -- ← the auth.users id
),
acc as (
  select r.id,
         r.data ->> 'name'                                   as name,
         r.data ->> 'type'                                   as type,
         coalesce((r.data ->> 'openingMinor')::bigint, 0)     as opening,
         (r.data ->> 'creditLimitMinor')::bigint             as credit_limit,
         coalesce((r.data ->> 'archived')::boolean, false)    as archived
  from public.records r join params p on r.user_id = p.uid
  where r.entity = 'account' and not r.deleted
),
txn as (
  select r.data ->> 'type'                as type,
         r.data ->> 'accountId'           as src,
         r.data ->> 'toAccountId'         as dst,
         (r.data ->> 'amountMinor')::bigint as amt
  from public.records r join params p on r.user_id = p.uid
  where r.entity = 'transaction' and not r.deleted and r.data ->> 'state' = 'active'
),
effect as (
  select a.id,
         case t.type
           when 'expense'       then case when t.src = a.id then case when a.type = 'credit' then t.amt else -t.amt end else 0 end
           when 'income'        then case when t.src = a.id and a.type <> 'credit' then t.amt else 0 end
           when 'reimbursement' then case when t.src = a.id and a.type <> 'credit' then t.amt else 0 end
           when 'refund'        then case when t.src = a.id then case when a.type = 'credit' then -t.amt else t.amt end else 0 end
           when 'transfer'      then case when t.src = a.id then -t.amt when t.dst = a.id then t.amt else 0 end
           when 'card_payment'  then case when t.src = a.id or t.dst = a.id then -t.amt else 0 end
           when 'adjustment'    then case when t.src = a.id then t.amt else 0 end
           else 0
         end as amt
  from acc a join txn t on a.id in (t.src, t.dst)
)
select a.name,
       a.type,
       a.archived,
       round((a.opening + coalesce(sum(e.amt), 0)) / 100.0, 2)                    as balance_php,  -- credit: amount owed
       round(a.credit_limit / 100.0, 2)                                           as credit_limit_php,
       round((a.credit_limit - (a.opening + coalesce(sum(e.amt), 0))) / 100.0, 2) as credit_available_php
from acc a left join effect e on e.id = a.id
group by a.id, a.name, a.type, a.archived, a.opening, a.credit_limit
order by a.archived, a.type, a.name;


-- 2) Totals per user (all users; uncomment the filter for one) -----------------------------------

with acc as (
  select r.user_id, r.id,
         r.data ->> 'type'                                as type,
         coalesce((r.data ->> 'openingMinor')::bigint, 0)  as opening,
         coalesce((r.data ->> 'creditLimitMinor')::bigint, 0) as credit_limit
  from public.records r
  where r.entity = 'account' and not r.deleted
    and not coalesce((r.data ->> 'archived')::boolean, false)
    -- and r.user_id = '5ab91bb4-e941-4731-b215-81c49113b32b'
),
txn as (
  select r.user_id,
         r.data ->> 'type'                  as type,
         r.data ->> 'accountId'             as src,
         r.data ->> 'toAccountId'           as dst,
         (r.data ->> 'amountMinor')::bigint as amt
  from public.records r
  where r.entity = 'transaction' and not r.deleted and r.data ->> 'state' = 'active'
),
balance as (
  select a.user_id, a.type, a.credit_limit,
         a.opening + coalesce(sum(
           case t.type
             when 'expense'       then case when t.src = a.id then case when a.type = 'credit' then t.amt else -t.amt end else 0 end
             when 'income'        then case when t.src = a.id and a.type <> 'credit' then t.amt else 0 end
             when 'reimbursement' then case when t.src = a.id and a.type <> 'credit' then t.amt else 0 end
             when 'refund'        then case when t.src = a.id then case when a.type = 'credit' then -t.amt else t.amt end else 0 end
             when 'transfer'      then case when t.src = a.id then -t.amt when t.dst = a.id then t.amt else 0 end
             when 'card_payment'  then case when t.src = a.id or t.dst = a.id then -t.amt else 0 end
             when 'adjustment'    then case when t.src = a.id then t.amt else 0 end
             else 0
           end), 0) as bal
  from acc a left join txn t on t.user_id = a.user_id and a.id in (t.src, t.dst)
  group by a.user_id, a.id, a.type, a.opening, a.credit_limit
)
select u.email,
       b.user_id,
       round(sum(bal) filter (where type = 'cash')   / 100.0, 2)                    as cash_php,
       round(sum(bal) filter (where type = 'debit')  / 100.0, 2)                    as debit_php,
       round(sum(bal) filter (where type <> 'credit') / 100.0, 2)                   as available_funds_php,
       round(coalesce(sum(bal) filter (where type = 'credit'), 0) / 100.0, 2)       as credit_outstanding_php,
       round(coalesce(sum(credit_limit) filter (where type = 'credit'), 0) / 100.0, 2) as credit_limit_php,
       round((coalesce(sum(bal) filter (where type <> 'credit'), 0)
            - coalesce(sum(bal) filter (where type = 'credit'), 0)) / 100.0, 2)     as net_position_php
from balance b join auth.users u on u.id = b.user_id
group by b.user_id, u.email
order by u.email;
