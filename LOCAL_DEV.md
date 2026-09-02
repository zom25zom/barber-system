# Local Development Guide

Run the full stack (API + frontend) against a **local D1 database** with
realistic test data — so you can safely test changes before deploying.

> ⚠️ Everything in this guide is LOCAL ONLY. Commands marked `--local` /
> `wrangler dev` never touch production. Double-check any `--remote` flag
> before running anything against production D1.

---

## Architecture recap

| Piece | Location | Local dev server |
|---|---|---|
| API (Hono on Cloudflare Workers) | `apps/api` | `wrangler dev` → **http://localhost:8787** |
| Frontend (Next.js 15) | `apps/web` | `next dev` → **http://localhost:3000** |
| Database (D1 = SQLite) | `barber_db` | local file under `apps/api/.wrangler/state/v3/d1` |
| Seed data (SQL) | `scripts/seed-local.sql` | applied via `wrangler d1 execute` |

- The API's CORS whitelist already allows `http://localhost:3000`
  (`apps/api/src/index.ts` → `BASE_ALLOWED_ORIGINS`).
- The frontend reads `NEXT_PUBLIC_API_BASE_URL` **at dev-server start**.
  `apps/web/.env.development` sets it to `http://localhost:8787` (committed
  for convenience). `.env.production` keeps the production URL and is only
  used by `next build`/`next start`, never by `next dev`.

---

## 1) One-time setup

```bash
# from the repo root
npm install
```

<details>
<summary>One-time environment fixes (only if wrangler/workerd fails to start)</summary>

**wrangler crashes with `Cannot find module .../wrangler-dist/cli.js`:**
the hoisted package extracted incompletely. Fix:

```bash
rm -rf node_modules/wrangler
npm install
```

**workerd/esbuild/sharp postinstall scripts were skipped by npm's
install-scripts allowlist** (symptom: `wrangler dev` fails complaining about
a missing platform binary for workerd). Approve and rebuild:

```bash
npm install-scripts approve esbuild workerd sharp
npm rebuild esbuild workerd sharp
```
</details>

The API needs its VAPID private key locally for web-push. It already exists
in `apps/api/.dev.vars` (gitignored). If it's ever missing, any placeholder
value is fine unless you're testing Web Push itself.

---

## 2) Create + seed the local database (first time / after a reset)

Run from the **repo root** (the npm scripts delegate into `apps/api` where
`wrangler.toml` lives):

```bash
# apply ALL migrations (0001 → latest) to the fresh local D1
npm run migrate:local

# populate realistic test data (2 salons, barbers, services, schedules,
# customers, bookings across dates/statuses, notifications, waitlist)
npm run seed:local
```

`npm run seed:local` is **idempotent** — it first DELETEs all data, then
re-inserts, so you can re-run it any time.

### What the seed creates

| Data | Details |
|---|---|
| Salon 1 | «صالون النجم للحلاقة» — slug `alnajm`, owner `admin1` |
| Salon 2 | «صالون الماسة» — slug `almasa`, owner `admin2` |
| Barbers | 3 in salon 1 (أحمد، خالد، يوسف), 2 in salon 2 (سامر، فادي) — each with services + weekly work schedules (Friday off) |
| Customers | 3 per salon (عمر، ليث، زياد / كرم، مالك، رامي) |
| Bookings | 14 across the last 10 days → next 2 days, mixing `completed`, `cancelled`, `no_show`, and `confirmed` (incl. today/tomorrow) |
| Notifications | per-owner, 3 unread for salon 1 → badge shows |
| Also | 1 waitlist entry; both salons `subscription_status = 'active'` (no lockout/trial banner) |

**All test passwords are `test1234`.**
Owner logins: `admin1` / `admin2`. Customer logins: phone `0790000001` …
`0790000006` + `test1234` (each customer belongs to their salon).

All booking dates are **relative to today** (`date('now', '-N days')`), so
the dashboard/reports/heatmap always show meaningful recent data no matter
when you seed.

---

## 3) Start both servers (two terminals)

```bash
# terminal 1 — API on http://localhost:8787 (local D1, NOT remote)
npm run dev:api

# terminal 2 — web on http://localhost:3000
npm run dev:web
```

Both can also be started directly:

```bash
cd apps/api && npx wrangler dev --port 8787
cd apps/web && npx next dev -p 3000
```

> `wrangler dev` runs everything locally: D1, R2 (simulated), Queues
> (simulated, reminders won't actually fire on a timer locally), Durable
> Objects + WebSockets (so live notifications work), and Crons (only fire
> on the schedule while dev is running). It never connects to remote
> resources unless you pass `--remote`.

Then open:

- **Admin panel:** http://localhost:3000/admin/login → sign in
  `admin1` / `test1234` (salon 1) or `admin2` / `test1234` (salon 2)
- **Public salon pages:** http://localhost:3000/alnajm and
  http://localhost:3000/almasa
- **Customer login:** any salon page → تسجيل الدخول with e.g.
  `0790000001` / `test1234`

---

## 4) Verify you're on LOCAL (not production)

1. **API health check** — direct hit on the local API:
   ```bash
   curl http://localhost:8787/api/health
   ```
   → `{"ok":true,...,"services":{"database":{...,"status":"connected"}...}}`

2. **Browser DevTools → Network tab**: every `/api/...` request from the
   web app must go to `http://localhost:8787`, never to
   `barber-api.nawafzwd25.workers.dev`.

3. **The seeded logins only exist locally.** Signing in with
   `admin1` / `test1234` succeeding is itself proof you're on the local DB
   (these accounts don't exist in production).

4. **`wrangler dev` output** says `Ready on http://127.0.0.1:8787` and all
   bindings show `local` (DB / R2 / DO).

5. To sanity-check the data through the API:
   ```bash
   npx wrangler d1 execute barber_db --local \
     --command "SELECT salon_id, status, COUNT(*) FROM bookings GROUP BY 1,2"
   ```

---

## 5) Reset / re-seed

```bash
# wipe the local database completely (deletes apps/api/.wrangler/state/v3/d1)
npm run reset:local

# re-apply migrations + seed fresh test data
npm run migrate:local
npm run seed:local
```

Often you only need the seed (it wipes + re-inserts all data itself, but
keeps the schema):

```bash
npm run seed:local
```

Restart `wrangler dev` after a full reset (it holds an open handle on the
SQLite file; the seed alone doesn't require a restart).

> The reset script refuses to delete while `wrangler dev` is running and
> prints instructions — close the dev server first (Ctrl+C), or kill an
> orphaned workerd process (see §7).

---

## 6) Optional: local super admin

For testing the platform-owner (super admin) panel against local data:

```bash
node scripts/create-super-admin.mjs <username> '<password>' --local
```

## 7) Troubleshooting

- **`npm run reset:local` fails with `EPERM` / "Device or resource busy"** → a
  `wrangler dev` process still holds the SQLite file. Stop the dev:api
  terminal first. If it's an orphaned background process, kill it on Windows:
  ```bash
  taskkill /F /IM "downloaded-@cloudflare-workerd-windows-64-workerd.exe.exe"
  ```
  (note the double `.exe` — workerd's image name is unusual), then re-run.
- **Port 8787/3000 already in use** → `npx wrangler dev --port 8788` (then
  update `apps/web/.env.development` and restart `next dev`) or
  `npx next dev -p 3001` (then update the API's CORS list for that origin).
- **Frontend calls hit production / get CORS errors** → `.env.development`
  missing or edited after `next dev` started; restart `next dev`
  (`NEXT_PUBLIC_*` vars are inlined at startup).
- **`wrangler` module errors** → see the one-time fixes in §1.
- **Login says session expired immediately** → local DB was reset while a
  tab still holds an old token; log out / clear localStorage for
  `localhost:3000`.
