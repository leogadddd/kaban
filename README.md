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
| iPhone | Standalone manifest, apple icon, safe areas, and an "Open on the Add screen" launch setting for one-tap entry. |
| Backup | JSON export and import. Import merges by id, newest version wins. |
| Privacy | Eye toggle (Home, Accounts, desktop sidebar) swaps every amount for a fixed-length `₱••••••` mask, so neither values nor digit counts show. Remembered per device. |
| Banks | Bank / e-wallet / BNPL picker (BDO, BPI, Metrobank, GCash, Maya, Atome…) with bundled logos and brand colours. |
| Sync queue | Every write also enqueues an outbox mutation (stable id + version) in the same IndexedDB transaction. |
| Cloud sync | Optional Supabase account (email + password, optional authenticator-app 2FA). A background worker pushes the outbox and pulls other devices' changes; the UI never waits on the network. Per-user record and size limits are enforced in Postgres. |

### Not yet built

- Native Shortcuts actions, budgets, multi-currency and receipt scanning are post-MVP per the PRD.

## Cloud sync (Supabase)

Without keys the app is local-only, exactly as before. To turn sync on:

1. Create a Supabase project and run `supabase/migrations/20261119000000_cloud_sync.sql` (SQL editor, or `supabase db push`).
2. Auth → URL configuration: set the Site URL to your domain and add `https://<your-domain>/sync` (and `http://localhost:3000/sync`) to the redirect URLs, for confirmation and password-reset emails.
3. Auth → Multi-factor: make sure TOTP is enabled (it is by default).
4. Add to `.env.local` (and your host's env), then rebuild — `NEXT_PUBLIC_` values are inlined at build time:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

How it works:

- Screens read and write IndexedDB only. `src/lib/repo.ts` adds each change to the outbox in the same transaction; `src/lib/sync.ts` drains it in batches a moment after writes, on focus, when back online, and every minute, with backoff on errors.
- Postgres has one `records` table (`user_id, entity, id, version, data jsonb …`). Clients can only `select` their own rows (RLS, plus aal2 when 2FA is on). All writes go through `push_records()`, which keeps the higher `(version, updatedAt)` and enforces the quota.
- Pulls use a per-user `server_seq` cursor. Instalment schedules are not synced; each device rebuilds them.
- First sign-in uploads whatever is already on the device. Signing out erases the device (warning first about unsynced changes). Data left by a *different* account is wiped, never merged.
- **Limits:** each user gets 10,000 records and 10 MB by default (`user_quota`). Past the limit the app keeps working locally and changes wait in the outbox, marked "Cloud full". Raise one user's limit with:

```sql
update user_quota set max_records = 50000, max_bytes = 52428800 where user_id = '<uuid>';
```

## Quick add

Settings → Quick add → **Open on the Add screen** makes a fresh launch of the installed app land on a new transaction, optionally with a preset account.

iPhone Shortcuts can't target an installed web app. "Open URLs" opens the default browser, and on iOS the Home Screen app's storage is separate from Safari's, so a Shortcut-created entry would land in the wrong place. Cloud sync is the real fix. `/add?type=…&amount=…&account=…` still prefills the form inside the app and in the browser.

## SEO

Only the landing page (`/`) is indexable; app screens are `noindex` (personal, device-local data). `robots.txt`, `sitemap.xml`, Open Graph/Twitter images and JSON-LD are generated by Next.js. Set `NEXT_PUBLIC_SITE_URL` for a custom domain; on Vercel the production domain is used automatically.

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
