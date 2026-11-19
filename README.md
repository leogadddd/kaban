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
| Backup | JSON export and validated import up to 32 MiB. Preview additions and replacements before merging by ID. Kaban rebuilds instalment schedules from the imported purchases. |
| Privacy | Eye toggle (Home, Accounts, desktop sidebar) swaps every amount for a fixed-length `₱••••••` mask, so neither values nor digit counts show. Remembered per device. |
| Banks | Bank / e-wallet / BNPL picker (BDO, BPI, Metrobank, GCash, Maya, Atome…) with bundled logos and brand colours. |
| Sync queue | Every write also enqueues an outbox mutation (stable id + version) in the same IndexedDB transaction. |
| Cloud sync | Optional Supabase account (email + password, optional authenticator-app 2FA). A background worker pushes the outbox and pulls other devices' changes; the UI never waits on the network. Per-user record and size limits are enforced in Postgres. |

### Not yet built

- Native Shortcuts actions, budgets, multi-currency and receipt scanning are post-MVP per the PRD.

## Cloud sync (Supabase)

Without keys the app is local-only, exactly as before. To turn sync on:

1. Create a Supabase project and run every file in `supabase/migrations/` in name order (SQL editor, or `supabase db push`).
2. Auth → URL Configuration: set the **Site URL** to your domain (not localhost) and add `https://<your-domain>/login` and `https://<your-domain>/reset-password` (plus the `http://localhost:3000/…` equivalents for dev) to the redirect URLs. Links not on this list fall back to the Site URL.
3. Auth → Sign In / Providers → Email: keep **Confirm email** on, so accounts can't sync until the address is verified.
4. Auth → Multi-factor: make sure TOTP is enabled (it is by default).
5. Add to `.env.local` (and your host's env), then rebuild — `NEXT_PUBLIC_` values are inlined at build time:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key (or set NEXT_PUBLIC_SUPABASE_ANON_KEY to the legacy anon key)>
```

How it works:

- Screens read and write IndexedDB only. `src/lib/repo.ts` adds each change to the outbox in the same transaction; `src/lib/sync.ts` drains it in batches a moment after writes, on focus, when back online, and every minute, with backoff on errors.
- Postgres has one `records` table (`user_id, entity, id, version, data jsonb …`). Row-level security restricts direct reads to the caller. The sync functions also check ownership and require `aal2` for accounts enrolled in 2FA. `push_records()` validates records, keeps the higher `(version, updatedAt)`, and enforces the quota.
- Each account has its own IndexedDB ledger, outbox, and cursor. Signing out closes the account ledger and keeps its offline records and pending changes in that browser for the same account. The local-only ledger is separate. To move local-only records into a cloud account, export from the local ledger, sign in, and confirm the import.
- Pulls use a per-user `server_seq` cursor. Cloud deletion resets the account’s sync generation, so devices must refresh their ledger before syncing again. A device with older records retains its previous ledger as a recovery export under that account. Instalment schedules are rebuilt on each device.
- **Limits** default to 10,000 stored rows (including deletion markers) and 10 MiB of record data per account (`user_quota`). Deletion markers stay until a full cloud reset. Past the limit the app keeps working locally and changes wait in the outbox, marked "Cloud full". A project administrator can raise the account limit.

```sql
update user_quota set max_records = 50000, max_bytes = 52428800 where user_id = '<uuid>';
```

For an existing deployment, apply the sync migrations before publishing the updated app. The account-isolation migration replaces the old upload RPC, so older clients must reload to resume uploads. On first use of the updated app, Kaban copies the old browser ledger and pending changes to the account recorded as its owner. An old ledger without an owner becomes the local-only ledger.

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
