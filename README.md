# Kaban

> *Kaban* — Tagalog for a chest or coffer, as in *kaban ng bayan* (the national treasury).

An offline-first PWA for tracking cash, debit and a **shared family credit card**: who bought what, how much is still owed to the bank, instalments, and who owes you. Built from the PRD in [`docs/`](docs/).

**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Motion · Dexie (IndexedDB) · Recharts · TypeScript

## Run

```bash
pnpm install
pnpm dev            # http://localhost:3000 (service worker disabled in dev)
pnpm build && pnpm start   # production, with offline service worker
```

To try it on an iPhone, serve it over HTTPS, open it in Safari, then **Share → Add to Home Screen**.

## What's implemented (PRD P0 + parts of P1)

| Area | Notes |
| --- | --- |
| Offline-first | Every page is statically prerendered and precached by `public/sw.js`. All data lives in IndexedDB. The shell re-precaches after each deploy. |
| Accounts | Cash, debit and credit, with opening amounts (never counted as income), limit, closing day, due rule, issuer and last 4. Accounts can be edited or archived. |
| Ledger | Expense, income, transfer, card payment, refund, adjustment and reimbursement. Records are voided, never deleted. Balances are always derived, never stored. |
| Credit | Billing-cycle assignment, regular / next-cycle / N-month instalments with a generated schedule, a credit dashboard (outstanding, available, utilisation, due date, current cycle). |
| Splits & debts | Equal or custom splits that must sum exactly, debts per participant, standalone debts, partial repayments into a chosen account. |
| Dashboard | Swipeable Money ↔ Credit panes, a stacked swipeable card deck with button and dot navigation, a 30-day trend and recent activity. |
| Activity | Search plus filters by date, account, type and category. Payment history. |
| Analytics | Income vs expense (with a table view), category ranking, utilisation rings. |
| iPhone | Standalone manifest, apple icon, safe areas, and a quick-add deep link for Shortcuts (Settings explains setup). |
| Backup | JSON export and import. Import merges by id, newest version wins. |
| Sync queue | Every write also enqueues an outbox mutation (stable id + version) in the same IndexedDB transaction. |

### Not yet built

- **Cloud sign-in & sync server** (P1). The client-side outbox is in place, but there is no server, auth or Postgres yet. The Sync page shows "Local only".
- Native Shortcuts actions, budgets, multi-currency and receipt scanning are post-MVP per the PRD.

## Quick-add deep link

```
/add?type=expense&amount=150&account=Family%20Card&category=Groceries&description=Lunch&date=2026-11-19
```

`account` accepts an account id or a case-insensitive name. `type` can be any of `expense | income | transfer | card_payment | refund | adjustment`.

## Money rules

- All amounts are integer centavos (`src/lib/money.ts`). Floats are used only for display.
- **Available funds** = Σ cash/debit balances. **Credit outstanding** = opening debt + purchases − payments − refunds ± adjustments. **Net** = funds − outstanding.
- Card payments, transfers, reimbursements and instalment schedules are never counted as spending.
- A multi-record change (transaction + instalment schedule + splits + debts + outbox) commits in a single IndexedDB transaction (`src/lib/repo.ts`).

## Layout

```
src/lib/        money, dates, billing cycles, finance projections, Dexie schema, repo (all writes), hooks
src/components/ app shell (bottom nav + More drawer), card stack, credit overview, charts, UI primitives
src/app/        routes — query params (?id=) instead of dynamic segments so every page is precacheable
public/sw.js    service worker
```
