# Creator Ops

**Clairen Haus** — autonomous multi-agent operations for creator back-office (intake, qualification, deal ops, contracts, billing, renewals, oversight).

## Stack

- **Next.js** (App Router) + TypeScript
- **Supabase** (Postgres, Auth, RLS) — migrations in `supabase/migrations/`
- **Stripe** Invoicing
- **Documenso** (hosted API) for contract drafts
- **Resend** for persona outbound email (optional until configured)

## Setup

1. **Environment**

   ```bash
   cp .env.example .env.local
   ```

   Fill Supabase URL/keys from the Supabase dashboard. Add `SUPABASE_SERVICE_ROLE_KEY` for workers and webhooks.

2. **Database**

   Link the project and run migrations (local or remote):

   ```bash
   npx supabase db push
   ```

   Or paste SQL from `supabase/migrations/` into the Supabase SQL editor.

3. **Roles**

   - New users get `profiles.role = creator` (trigger on signup).
   - Promote **ops** users in SQL: `update profiles set role = 'ops' where id = '<auth-user-uuid>';`
   - Link a creator to a user: `update profiles set creator_id = '<creator-uuid>' where id = '<auth-user-uuid>';`

4. **Run**

   ```bash
   npm install
   npm run dev
   ```

5. **Worker (job queue)**

   Process pending rows in `job_queue` (emails, contract drafts, Stripe invoices):

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/worker.ts
   ```

   On Vercel, add `CRON_SECRET` to project env and enable the cron in `vercel.json` — Vercel sends `Authorization: Bearer <CRON_SECRET>` to `/api/cron/process-jobs`.

## API

- **Webhook intake** — `POST /api/webhooks/intake` with header `x-webhook-secret: <INTAKE_WEBHOOK_SECRET>` and JSON body including `creator_id`, `contact`, `deal`, optional `qualification_score`.
- **Stripe** — `POST /api/webhooks/stripe` with `stripe-signature` (configure `STRIPE_WEBHOOK_SECRET`).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Marketing splash |
| `/login` | Magic link |
| `/ops/*` | Internal Ops console (requires `role = ops`) |
| `/portal/*` | Creator-facing outcomes (requires `role = creator`) |

## License

Proprietary — Clairen Haus. All rights reserved unless otherwise agreed in writing.
