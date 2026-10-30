# อิ่มทัน (Imtan)

A **prototype** canteen queue app for the Engineering canteen at Chulalongkorn University.
Students see every shop's live queue, customise and order, pay (demo), get a queue number with a
live wait estimate, and get an alert when the food is ready. Vendors run a live order board on a
tablet. There is no real food, money or customers: payment is a built-in demo.

Spec and phases: [`PLAN.md`](PLAN.md). Screen designs: `design/`. Demo menu data: `data/demo-shops.yaml`.

## Stack

Next.js (App Router, TypeScript, Server Components and Actions) · Tailwind · Supabase (Postgres,
Auth, Realtime, `pg_cron`) · Web Push (`web-push` + `public/sw.js`) · Vercel (`sin1`) · Vitest + one
Playwright smoke test.

## Setup

1. **Supabase** (Singapore): turn on anonymous sign-ins, turn off "Confirm email", enable `pg_cron`,
   raise the anonymous sign-in limit per IP.
2. `npm install`
3. Create `.env.local` (never commit it):

   | Variable                                                             | What                                                                      |
   | -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`          | project URL and anon key                                                  |
   | `SUPABASE_SERVICE_ROLE_KEY`                                          | server only: bypasses RLS                                                 |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`, subject like `mailto:you@example.com` |
   | `DEMO_PAYMENTS`                                                      | `true` enables demo payment and demo tools (they 404 otherwise)           |
   | `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`                         | admin login created by `npm run seed:accounts`                            |
   | `VENDOR_LOGIN_PASSWORD`                                              | shared server-side password behind the vendor "tap your shop" login       |

4. `npx supabase link --project-ref <id>`, then `npx supabase db push --include-seed`
5. `npm run seed:accounts` creates the admin and one vendor account per shop.
6. `npm run dev`

## Commands

|                                                   |                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`                 | app                                                                                                |
| `npm run lint` · `npm run typecheck` · `npm test` | static checks and unit tests                                                                       |
| `npm run seed`                                    | regenerate `supabase/seed.sql` from `data/demo-shops.yaml`                                         |
| `npm run db:types`                                | regenerate `lib/database.types.ts`                                                                 |
| `npm run check:phase2` … `check:phase9`           | acceptance checks against the linked Supabase project (they create and remove their own test data) |
| `npm run test:e2e`                                | Playwright smoke test (order → pay → vendor ready → alert); uses installed Chrome                  |

## Demo day

- Log in as admin → `/demo`: phone frame + vendor board side by side, simulate rush, auto-advance, reset.
- Interview mode: sign in as a shop on a tablet and open `/vendor?interview=1`.
- Before presenting: reset the demo that morning, open the Supabase dashboard the day before so it is
  awake, print the QR posters from the deployed domain (`/admin/posters`).
- Push: demo it on an Android phone. iPhone only gets push from a Home-Screen install, so show the
  in-page alert there.
- `/admin` has CSV export (events, orders), shops and vendor accounts, and `/admin/stats`.

## Security notes (prototype)

- Clients never write tables. Writes go through server actions that check the role first, then use
  the service-role client. Every table has RLS; vendors never see unpaid app orders.
- **The vendor login has no password prompt**: anyone who opens `/login` can tap a shop and act as
  that vendor. That is a deliberate prototype choice for easy interviews. Do not use this setup with
  real shops or real payments (PLAN.md §10 lists what a real version needs).
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` out of git and out of `NEXT_PUBLIC_*`.

## Layout

`app/` screens and API routes · `components/` UI · `lib/menu/` pricing and validation (pure, shared by
browser and server) · `lib/orders/` ordering, pre-orders, history · `lib/vendor/`, `lib/admin/` server
operations · `supabase/migrations/` schema (add new migrations, never edit applied ones) · `scripts/`
seed and acceptance checks · `data/demo-shops.yaml` the only source of menu data.
