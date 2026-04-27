# CreatrOps — Implementation Spec

**Version:** v4.0
**Last Updated:** 2026-04-27
**Status:** Build spec — ready for Cursor
**Product:** CreatrOps (creatrops.com)
**Parent company:** Clairen Haus
**App URL:** app.creatrops.com
**Marketing URL:** creatrops.com

---

## 0. How to Use This Document

This spec is the single source of truth for building CreatrOps. Hand it directly to Cursor. Every decision is locked. Where previous versions had open questions, this version has answers.

**Build order:** follow §17 (Build Plan). Sprint 0 is the onboarding wizard — it ships before anything else.

**If in doubt:** DB schema (§6) and agent specs (§8) are authoritative. Everything else serves those.

**Brand reference:** see `BRAND.md` in the repo root for all visual, typography, color, and voice guidelines.

---

## 1. Product Overview

### 1.1 What it is

CreatrOps is a division of Clairen Haus. It is a creator operations service — externally, a dedicated ops team that handles the business side of brand partnerships. Internally, a multi-agent system that executes those operations autonomously, with a small Clairen Haus operator team handling exceptions, escalations, and policy configuration.

The product being sold is ops coverage, not AI. Creators know they are working with a tech-enabled ops team. They do not see agent activity, confidence scores, or internal system details.

### 1.2 Positioning (semi-stealth)

- **To creators:** "We run your brand partnership ops — inbox triage, deal management, contracts, invoicing. Your dedicated account manager is your point of contact."
- **To brands:** Brands interact with a named persona (e.g. Sarah Chen, Partnerships Lead). They never see CreatrOps or Clairen Haus branding in outbound emails.
- **What we never do:** deny being AI if sincerely asked. Any message asking if the persona is a bot is immediately escalated to a human operator.

### 1.3 Scope of v1

- Self-serve onboarding wizard (Sprint 0 — ships first)
- Stripe subscription billing (Clairen Haus collecting creator retainers)
- Email intake + form intake
- CRM (contacts, companies, deals)
- Persona-based communication layer
- Qualification + first-touch replies
- Deal stage progression with reminders
- Contract drafting from templates → human review → dispatch via Documenso
- Billing agent — creator invoicing to brands after contract signed
- Invoice reminders and payment tracking
- Affiliate program — 20% recurring single-tier for standard affiliates
- Founding affiliate (Sheila) — two-tier commission, internal flag only
- Creator portal dashboard with live activity feed
- Internal ops console with escalation queue
- Escalation queue + monthly report

**Out of v1:** DM ingestion, autonomous contract signing, public crisis response, deep analytics beyond ops KPIs.

### 1.4 Primary user (cruise acquisition)

v1 is aimed at creators acquired via Sheila at the TikTok Shop cruise. Implications:

- **Onboarding is fully self-serve.** Creator selects tier → Stripe collects payment → account created instantly → wizard walks them through setup → ops team activates. Zero human involvement required.
- **No setup fees.** Backend is shared infrastructure. Setup cost is operator time only (~1 hour per client), absorbed into retainer margin.
- **Mobile-first wizard.** Creators will complete onboarding on their phones. Every wizard step must be thumb-friendly.
- **Referral link activates on wizard completion.** Affiliates start earning from day one.

---

## 2. Personas & Invisibility Architecture

### 2.1 The persona concept

A **persona** is a named virtual account manager. Every creator client has one primary persona assigned. All outbound brand communication goes out under the persona's identity.

Each persona has:
- Display name (e.g. "Sarah Chen") and title (e.g. "Partnerships Lead")
- Dedicated sending email: `firstname@ops.creatrops.com`
- Voice profile (tone, signature phrases, sign-off style)
- HTML signature block
- Working hours configuration
- Optional headshot

One persona can be assigned to multiple creator clients simultaneously.

### 2.2 Sending identities

Each persona maps to a verified sending identity in Resend:
- Verified DKIM + SPF + DMARC on `ops.creatrops.com`
- Warm-up schedule: <20 sends/day week 1, <50 week 2, <100 week 3
- Consistent From name, address, and reply-to
- Thread continuity via `In-Reply-To` and `References` headers

Once a brand conversation starts with Sarah, every reply comes from Sarah.

### 2.3 Consistency rules

| Element | Rule |
|---|---|
| Reply-to | Always the persona's address |
| Voice | Locked per persona via voice profile |
| Signature | Never changes within a thread |
| Response time | Governed by cadence engine — never instant |
| Out-of-office | Personas have working hours + occasional PTO windows |
| Bot detection | If brand asks "are you a bot" — immediately escalate, never deny |

### 2.4 Two dashboards

**Internal Ops Console** (`/ops`): full agent visibility — confidence scores, logs, escalations, policy config, agent runs. Clairen Haus operators only.

**Creator Portal** (`/portal` or `/dashboard`): outcome view — pipeline, deals, documents, invoices, monthly reports, referral earnings. No agent language. No confidence scores.

---

## 3. Users & Roles

| Role | Description | Access |
|---|---|---|
| `superadmin` | Clairen Haus founder | All clients, all data, all config |
| `operator` | Clairen Haus ops team | Assigned clients, escalation queue |
| `creator` | Creator client | Their own workspace only |
| `creator_delegate` | Creator's VA | Same as creator, optionally read-only |

### Tenancy model

```
Clairen Haus (implicit org)
 └── Client (one per creator)
     ├── Persona (assigned)
     ├── Contacts
     ├── Deals
     ├── Documents / Contracts / Invoices
     └── Policies
```

---

## 4. Tech Stack (Locked)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) | TypeScript strict, React Server Components |
| UI | Tailwind CSS + shadcn/ui | Brand colors via CSS vars |
| DB | Supabase Postgres | Drizzle ORM, RLS enforced |
| ORM | Drizzle | `drizzle-kit` for migrations |
| Auth | Supabase Auth | Magic link with PKCE flow. `flowType: 'pkce'` in client config. Callback at `/auth/callback` handles both `token_hash` and `code` parameters. |
| Storage | Supabase Storage | Contract drafts, persona assets, briefs |
| RLS | Postgres RLS | Enforced at DB level |
| Agent runtime | Vercel AI SDK + `@anthropic-ai/sdk` | Tool-use loop per agent |
| LLM — primary | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Drafting + reasoning |
| LLM — classification | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Lightweight tasks |
| LLM — high-stakes | Claude Opus 4.6 (`claude-opus-4-6`) | Contract clause review |
| Job queue | pg-boss | Inside Supabase Postgres |
| Scheduled jobs | pg-boss cron | Daily sweeps, weekly reports |
| Email send | Resend | Per-persona sending identity on `ops.creatrops.com` |
| Email inbound | Resend inbound webhooks | Parsed JSON to Next.js route |
| Subscription billing | Stripe Billing | Creator retainer collection by Clairen Haus |
| Creator invoicing | Stripe Invoicing | Brand invoices generated by Billing Agent |
| E-sign | Documenso (hosted v1) | API + webhooks |
| LLM observability | Langfuse (cloud v1) | Trace every agent run |
| Hosting — app | Railway | Next.js app at `app.creatrops.com` |
| Hosting — worker | Railway (separate service) | pg-boss consumer + background agents |
| Hosting — static | Railway (separate service) | Marketing site at `creatrops.com` |
| Error tracking | Sentry | App + worker |

**Not used:**
- LangGraph, LangChain, CrewAI — Vercel AI SDK is sufficient
- Inngest, Trigger.dev, BullMQ — pg-boss covers it
- HubSpot, Pipedrive — custom Postgres CRM
- Postmark — replaced by Resend
- Vercel — replaced by Railway

---

## 5. System Architecture

### 5.1 Components

```
┌─────────────────────────────────────────────────────┐
│              Next.js App (Railway)                  │
│  ┌────────────────┐  ┌──────────────────────────┐   │
│  │ Creator Portal │  │ Internal Ops Console     │   │
│  │ /dashboard     │  │ /ops                     │   │
│  │ /onboarding    │  │ /ops/escalations         │   │
│  │ /portal/*      │  │ /ops/clients             │   │
│  └────────────────┘  └──────────────────────────┘   │
│                                                     │
│  API Routes: /api/intake, /api/webhooks/*, /api/*   │
│  Auth: /login, /auth/callback                       │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
       ┌──────────────────────────┐     ┌─────────────────────┐
       │    Supabase Postgres     │◄────┤  Worker (Railway)   │
       │  - App data + RLS        │     │  - pg-boss consumer │
       │  - pg-boss jobs          │     │  - Agent runs       │
       │  - Auth                  │     │  - Schedulers       │
       └──────────────────────────┘     └──────────┬──────────┘
                                                   │
              ┌────────┬──────────┬────────────────┼──────┬──────────┐
              ▼        ▼          ▼                ▼      ▼          ▼
           Claude   Resend   Documenso          Stripe  Langfuse  Sentry
```

### 5.2 Auth flow (magic link PKCE)

```
User enters email → signInWithOtp({ emailRedirectTo: SITE_URL + '/auth/callback' })
  ↓
Supabase sends magic link email
  ↓
User clicks link → /auth/callback?token_hash=xxx&type=magiclink
  ↓
Callback page: verifyOtp({ token_hash, type }) OR exchangeCodeForSession(code)
  ↓
On success → redirect to /dashboard
On failure → redirect to /login?error=auth
```

### 5.3 Canonical event flow

```
Brand emails sarah@ops.creatrops.com
  ↓
Resend inbound webhook → POST /api/webhooks/resend/inbound
  ↓
Handler: create message row → enqueue intake.process_email
  ↓
Intake Agent: create contact + deal → enqueue qualification.score
  ↓
Qualification Agent: score → enqueue inbox.draft_reply
  ↓
Inbox Agent: draft reply → schedule send via cadence engine
  ↓
pg-boss delayed job fires → send email via Resend as Sarah
  ↓
Update message row → update deal timeline → creator sees in portal
```

---

## 6. Database Schema

All schema files in `src/db/schema/`. Migrations via `drizzle-kit generate`.

```sql
-- ============================================================
-- Email connections (OAuth + forwarding)
-- ============================================================
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'forwarding');
CREATE TYPE email_connection_status AS ENUM ('active', 'expired', 'revoked', 'error');

CREATE TABLE email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider email_provider NOT NULL,
  email_address TEXT NOT NULL,
  display_name TEXT,
  -- OAuth tokens (encrypted at rest)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  -- OAuth metadata
  oauth_scope TEXT,
  provider_user_id TEXT,
  -- Status
  status email_connection_status NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  -- Forwarding address (for Option C)
  forwarding_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_connections_client ON email_connections (client_id);

-- ============================================================
-- Creator brand identities (multi-brand support)
-- ============================================================
-- A single user_profiles record can own multiple brand identities.
-- Each brand identity maps to its own client record with its own
-- persona, pipeline, rate card, and policy profile.
-- The primary client is set during onboarding. Additional brands
-- can be added from the dashboard post-onboarding.

CREATE TABLE brand_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_handle TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_primary_brand_per_user
  ON brand_identities (user_id) WHERE is_primary = true;

CREATE INDEX idx_brand_identities_user ON brand_identities (user_id);

-- ============================================================
-- Pre-gate submissions (cruise lead capture)
-- ============================================================
CREATE TABLE pregate_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  handle_tiktok TEXT,
  handle_instagram TEXT,
  handle_youtube TEXT,
  handle_twitter TEXT,
  handle_pinterest TEXT,
  handle_snapchat TEXT,
  referral_code TEXT,
  selected_tier TEXT,
  converted_to_client BOOLEAN NOT NULL DEFAULT false,
  resulting_client_id UUID,
  source TEXT DEFAULT 'cruise_qr',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Clients (creator workspaces)
-- ============================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_display_name TEXT NOT NULL,
  handle_instagram TEXT,
  handle_tiktok TEXT,
  handle_youtube TEXT,
  handle_twitter TEXT,
  niche TEXT,
  follower_count_range TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_tier TEXT CHECK (subscription_tier IN ('starter_ops', 'growth_ops', 'creator_ceo')),
  subscription_status TEXT DEFAULT 'inactive',
  status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'paused', 'churned')),
  onboarding_completed_at TIMESTAMPTZ,
  wizard_step INT NOT NULL DEFAULT 1,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'operator', 'creator', 'creator_delegate')),
  affiliate_tier TEXT NOT NULL DEFAULT 'standard' CHECK (affiliate_tier IN ('standard', 'founding')),
  referral_code TEXT UNIQUE,
  referred_by_user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_clients (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('full', 'read_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

-- ============================================================
-- Affiliate commissions
-- ============================================================
CREATE TABLE affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id UUID NOT NULL REFERENCES user_profiles(id),
  referred_client_id UUID NOT NULL REFERENCES clients(id),
  commission_tier INT NOT NULL CHECK (commission_tier IN (1, 2)),
  commission_pct NUMERIC(5,2) NOT NULL,
  month_year TEXT NOT NULL,
  base_amount_cents BIGINT NOT NULL,
  commission_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'void')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Personas
-- ============================================================
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  sending_email TEXT NOT NULL UNIQUE,
  sending_name TEXT NOT NULL,
  signature_html TEXT NOT NULL,
  voice_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  working_hours_json JSONB NOT NULL DEFAULT '{"timezone":"America/New_York","mon_fri_start":"09:00","mon_fri_end":"18:00","weekend":false}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE client_personas (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, persona_id)
);

CREATE UNIQUE INDEX one_primary_persona_per_client
  ON client_personas (client_id) WHERE is_primary = true;

-- ============================================================
-- Contacts & Companies
-- ============================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  title TEXT,
  phone TEXT,
  source TEXT CHECK (source IN ('inbound_email', 'intake_form', 'manual', 'referral', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_client_email ON contacts (client_id, email);

-- ============================================================
-- Deals
-- ============================================================
CREATE TYPE deal_stage AS ENUM (
  'new', 'qualifying', 'qualified', 'negotiating',
  'contract_draft', 'contract_sent', 'contract_signed',
  'in_production', 'deliverables_submitted',
  'invoiced', 'paid', 'completed', 'declined', 'lost'
);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'new',
  campaign_type TEXT,
  platforms TEXT[],
  quoted_amount_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'USD',
  usage_rights_requested JSONB,
  deliverables JSONB,
  due_date DATE,
  next_action_due_at TIMESTAMPTZ,
  qualification_score NUMERIC(3,2),
  qualification_reason TEXT,
  decline_reason TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_client_stage ON deals (client_id, stage);
CREATE INDEX idx_deals_next_action ON deals (next_action_due_at) WHERE next_action_due_at IS NOT NULL;

CREATE TABLE deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage deal_stage,
  to_stage deal_stage NOT NULL,
  changed_by_agent TEXT,
  changed_by_user_id UUID REFERENCES user_profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Messages
-- ============================================================
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_channel AS ENUM ('email', 'form', 'manual_note');
CREATE TYPE message_status AS ENUM ('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'received');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  direction message_direction NOT NULL,
  channel message_channel NOT NULL,
  status message_status NOT NULL DEFAULT 'pending',
  thread_id TEXT,
  in_reply_to TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  from_address TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  raw_payload JSONB,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  scheduled_send_at TIMESTAMPTZ,
  drafted_by_agent TEXT,
  draft_confidence NUMERIC(3,2),
  requires_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_by_user_id UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_deal ON messages (deal_id, created_at DESC);
CREATE INDEX idx_messages_thread ON messages (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_scheduled ON messages (scheduled_send_at) WHERE status = 'queued';

-- ============================================================
-- Documents & Contracts
-- ============================================================
CREATE TYPE document_kind AS ENUM ('contract_draft', 'contract_final', 'brief', 'attachment', 'invoice', 'other');
CREATE TYPE document_status AS ENUM ('draft', 'pending_review', 'approved', 'sent', 'signed', 'declined');

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  kind document_kind NOT NULL,
  status document_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  storage_path TEXT,
  content_text TEXT,
  content_html TEXT,
  documenso_document_id TEXT,
  signing_url TEXT,
  created_by_agent TEXT,
  non_standard_clauses JSONB,
  requires_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_by_user_id UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT,
  template_text TEXT NOT NULL,
  required_variables TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Invoices
-- ============================================================
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'overdue', 'void', 'uncollectible');

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  stripe_invoice_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  invoice_number TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE NOT NULL,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  line_items JSONB NOT NULL,
  hosted_invoice_url TEXT,
  pdf_url TEXT,
  reminder_count INT NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Tasks
-- ============================================================
CREATE TYPE task_kind AS ENUM ('follow_up', 'chase_brief', 'reminder', 'internal_note', 'custom');
CREATE TYPE task_status AS ENUM ('open', 'completed', 'cancelled');

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  kind task_kind NOT NULL,
  status task_status NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  body TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by_agent TEXT,
  assigned_to_user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_due ON tasks (due_at) WHERE status = 'open';

-- ============================================================
-- Client Policies
-- ============================================================
CREATE TABLE client_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  policy_json JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_by_user_id UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- policy_json shape:
-- {
--   "minimums_by_campaign_type": { "instagram_reel": 1500000, "youtube_dedicated": 5000000 },
--   "blocked_categories": ["gambling", "crypto", "tobacco", "firearms", "mlm"],
--   "approved_categories": [],
--   "usage_rights_defaults": {
--     "max_duration_days": 90,
--     "exclusivity_allowed": false,
--     "whitelisting_allowed": true,
--     "whitelisting_surcharge_pct": 25
--   },
--   "approval_required_above_cents": 2500000,
--   "payment_terms_default": "net_30",
--   "response_sla_business_hours_min": 120
-- }

-- ============================================================
-- Agent Runs
-- ============================================================
CREATE TYPE agent_run_status AS ENUM ('running', 'success', 'failed', 'escalated');

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  input_ref JSONB,
  status agent_run_status NOT NULL DEFAULT 'running',
  confidence NUMERIC(3,2),
  output_json JSONB,
  error_text TEXT,
  langfuse_trace_id TEXT,
  llm_tokens_input INT,
  llm_tokens_output INT,
  llm_cost_cents NUMERIC(10,4),
  duration_ms INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_client ON agent_runs (client_id, started_at DESC);

-- ============================================================
-- Escalations
-- ============================================================
CREATE TYPE escalation_reason AS ENUM (
  'low_confidence', 'non_standard_contract_clause', 'pricing_exception',
  'policy_violation', 'brand_asked_if_bot', 'threatening_language',
  'overdue_high_value', 'tool_failure', 'other'
);

CREATE TYPE escalation_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');

CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  reason escalation_reason NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  summary TEXT NOT NULL,
  context_json JSONB,
  suggested_action TEXT,
  status escalation_status NOT NULL DEFAULT 'open',
  assigned_to_user_id UUID REFERENCES user_profiles(id),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalations_open ON escalations (client_id, severity) WHERE status = 'open';

-- ============================================================
-- Email Templates
-- ============================================================
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  variables TEXT[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (client_id, key)
);

-- ============================================================
-- Intake Form Submissions
-- ============================================================
CREATE TABLE intake_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_url TEXT,
  submitted_payload JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  resulting_deal_id UUID REFERENCES deals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Activity Feed (for live dashboard)
-- ============================================================
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  actor TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_feed_client ON activity_feed (client_id, created_at DESC);

-- ============================================================
-- Audit Log
-- ============================================================
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'user', 'system')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  diff_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
```

---

## 7. Multi-Tenancy & RLS

### 7.1 Rule

Every table with `client_id` has RLS enabled. The service role key (worker only) bypasses RLS. Never expose the service role key to the browser.

### 7.2 RLS helper function

```sql
CREATE OR REPLACE FUNCTION current_user_has_client_access(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM user_profiles WHERE id = auth.uid();
  IF user_role = 'superadmin' THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_id = auth.uid() AND client_id = target_client_id
  );
END;
$$;
```

Apply RLS policies to every `client_id`-scoped table using this pattern:

```sql
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_select ON deals FOR SELECT USING (current_user_has_client_access(client_id));
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
CREATE POLICY deals_update ON deals FOR UPDATE USING (current_user_has_client_access(client_id));
```

### 7.3 Creator portal visibility

Even with RLS, the creator portal never shows:
- `agent_runs` table (hidden entirely)
- `escalations` (show derived "needs your input" items only)
- `drafted_by_agent`, `draft_confidence` on messages
- Internal resolution notes

---

## 8. Self-Serve Onboarding Wizard

The wizard is the front door. It ships in Sprint 0. No human involvement required for a creator to go from zero to live.

### 8.1 Flow

```
creatrops.com (pre-gate form)
  ↓
creatrops.com/welcome (tier selection → Stripe Checkout)
  ↓
Stripe payment success → account created → magic link sent
  ↓
app.creatrops.com/onboarding (7-step wizard)
  ↓
Completion → ops team activated → referral link generated → dashboard
```

### 8.2 Wizard steps

All steps at `/onboarding/step-[n]`. State persisted in `clients.wizard_step` — wizard resumes from last completed step if closed.

**Step 1 — Welcome**
- Show selected tier and price
- Confirm email address
- "Setting up your account..." — persona assignment fires in background
- Progress to step 2 automatically after 2s

**Step 2 — Creator Profile**
- Display name (how brands will see them)
- Primary niche (dropdown: Beauty, Fashion, Fitness, Lifestyle, Food, Travel, Tech, Finance, Parenting, Entertainment, Other)
- Primary platforms (multi-select: TikTok, Instagram, YouTube, Twitter/X, Pinterest, Snapchat)
- Follower count range per platform

**Step 3 — Rate Card**
- Minimum budget to respond to (single most important field)
- Rate per campaign type — show benchmark suggestions based on niche + follower count
- Campaign types: Instagram Reel, Story, TikTok Video, YouTube Dedicated, YouTube Integration, Blog Post, Podcast
- "Set this up later" option — defaults to escalating all rate decisions

**Step 4 — Brand Preferences**
- Blocked categories (multi-select with defaults: Gambling, Crypto, Tobacco, Firearms, MLM, Alcohol)
- Any specific brands to always decline (text field)
- Any specific brands to always accept (text field)

**Step 5 — Contract Setup**
Two paths:
- **Upload existing contract** — PDF upload to Supabase Storage
- **Build from template** — 5 questions:
  1. Payment terms (Net 15 / Net 30 / 50% upfront + 50% on delivery)
  2. Revision rounds (1 / 2 / 3)
  3. Exclusivity (Never / Sometimes / Case by case)
  4. Usage rights duration (30 / 60 / 90 days)
  5. Governing state (dropdown)

**Step 6 — Inbox Setup**

Three connection methods offered in priority order:

**Option A — Connect Gmail (recommended)**
- "Connect your Gmail" button triggers Google OAuth flow
- Scopes requested: `gmail.readonly` + `gmail.modify` (to mark processed emails)
- On grant: store OAuth tokens in `email_connections` table
- System scans inbox for brand inquiries in background automatically
- No forwarding rules needed

**Option B — Connect Outlook**
- "Connect your Outlook" button triggers Microsoft OAuth flow
- Scopes: `Mail.Read` + `Mail.ReadWrite`
- Same background scanning behavior as Gmail

**Option C — Email forwarding (fallback)**
- Show their dedicated brand inquiry email: `[handle]@ops.creatrops.com`
- Step-by-step forwarding instructions for Gmail, iCloud, Outlook
- "Send a test" button — fires a test email through the system

**DM auto-reply copy (all creators)**
- Show copy-paste auto-reply text for each platform they selected in step 2:
  - Instagram: Settings → Messages → Auto-reply
  - TikTok: Creator tools → Auto-reply
  - Twitter/X: Not natively supported — suggest pinned tweet
- Suggested text: "Thanks for reaching out! For brand partnership inquiries please email [handle]@ops.creatrops.com for the fastest response."
- One-tap copy button per platform

**Multi-brand note:**
If the creator operates under multiple brand identities (e.g. `itsjustmiche` for lifestyle and a separate business brand), they can add additional brand profiles from their dashboard after onboarding. Each brand identity gets its own client workspace, persona, pipeline, and rate card under the same account.

**Step 7 — You're Live**
- Persona introduced: photo, name, title, email
- "Sarah Chen is now managing your brand partnerships"
- Referral link generated and displayed with copy button
- Affiliate earnings calculator (show potential earnings)
- "Go to dashboard" button
- Resend confirmation email with portal link + referral code

### 8.3 Technical requirements

- Each step writes to DB on completion (not just at end)
- Onboarding agent fires in background from Step 1 to configure policy from wizard answers
- Mobile-first — all steps must be thumb-friendly on 375px viewport
- Progress bar at top showing step X of 7
- Back button on every step
- "Save and continue later" on every step

---

## 9. Stripe Integration

### 9.1 Subscription tiers

| Tier Key | Display Name | Monthly Price |
|---|---|---|
| `starter_ops` | Starter Ops | $500/month |
| `growth_ops` | Growth Ops | $1,250/month |
| `creator_ceo` | Creator CEO | $2,500/month |

### 9.2 Subscription flow

1. Creator selects tier on `creatrops.com/welcome`
2. Click triggers Stripe Checkout session creation via `/api/stripe/create-checkout`
3. Creator completes payment on Stripe Checkout
4. Stripe fires `checkout.session.completed` webhook → `/api/webhooks/stripe`
5. Webhook handler: create `clients` row, create `user_profiles` row, send magic link to email, set `subscription_status: 'active'`
6. Creator clicks magic link → lands at `/onboarding/step-1`

### 9.3 Stripe webhook events to handle

- `checkout.session.completed` → activate account
- `invoice.payment_succeeded` → update subscription status
- `invoice.payment_failed` → flag account, notify operator
- `customer.subscription.deleted` → set status to `churned`

### 9.4 Creator invoicing (Billing Agent)

Separate from subscription. After a brand deal contract is signed:
1. Billing Agent creates Stripe invoice for the brand's contact email
2. Invoice line items from deal deliverables and quoted amount
3. Payment link sent to brand via Resend (as the persona)
4. Stripe webhook `invoice.paid` → update deal stage to `paid`

---

## 10. Affiliate Program

### 10.1 Standard affiliate (all creators)

- **Rate:** 20% of referred creator's monthly base retainer
- **Duration:** for as long as referred creator remains an active subscriber
- **Cap:** none
- **Tiers:** single tier only — direct referrals only
- **Activation:** referral link generated on wizard step 7 completion

### 10.2 Founding affiliate (Sheila only)

- **Flag:** `user_profiles.affiliate_tier = 'founding'`
- **Tier 1:** 20% on direct referrals (same as standard)
- **Tier 2:** 10% on referrals made by her direct referrals
- **Duration:** lifetime, per Founding Affiliate Agreement
- **Visibility:** internal ops console only — never shown in creator portal UI
- **Logic:** commission calculation checks `affiliate_tier` flag before applying tier 2

### 10.3 Commission calculation (monthly cron)

```
For each active subscriber:
  Find referring affiliate (referred_by_user_id on client's user)
  Calculate tier 1: subscription_amount * 0.20
  If referring affiliate has affiliate_tier = 'founding':
    Find tier 2 affiliate (who referred the tier 1 affiliate)
    Calculate tier 2: subscription_amount * 0.10
  Write to affiliate_commissions table
  Aggregate by affiliate for payout report
```

### 10.4 Referral code format

`[FIRSTNAME][4-digit-random]` — e.g. `MICHE4827`. Generated on wizard completion. Stored on `user_profiles.referral_code`.

---

## 11. Agent Specifications

### 11.1 Shared runtime contract

Every agent is a TypeScript module in `packages/agents/`:

```typescript
export async function run(input: AgentInput): Promise<AgentResult>;

type AgentInput = {
  clientId: string;
  triggerEvent: string;
  payload: Record<string, unknown>;
};

type AgentResult = {
  status: 'success' | 'failed' | 'escalated';
  confidence: number;
  output: Record<string, unknown>;
  nextJobs: NextJob[];
  escalation?: EscalationRequest;
};
```

All agents: log full trace to Langfuse, write `agent_runs` row at start and end, write to `activity_feed` on significant actions.

### 11.2 Intake Agent

**Trigger:** `intake.process_email` or `intake.process_form`
**Model:** Claude Haiku 4.5
**Actions:** parse inbound, detect spam/OOO, extract brand + campaign info, create contact + deal, enqueue qualification

**Spam/OOO detection:** if email is auto-reply, newsletter, or spam → mark and stop. No reply sent.

### 11.3 Qualification Agent

**Trigger:** `qualification.score`
**Model:** Claude Sonnet 4.6
**Confidence thresholds:**
- ≥0.80 → qualify, enqueue first-touch reply
- 0.50–0.79 → request more info
- <0.50 → escalate

**Hard blocks (always decline, confidence 1.0):**
- Brand category in `blocked_categories`
- Budget below `minimums_by_campaign_type`

**Always escalate:**
- Brand category not in policy
- Deal amount >10x policy minimum (verify legitimacy)

### 11.4 Inbox Agent

**Trigger:** `inbox.draft_reply`
**Model:** Claude Sonnet 4.6
**Draft confidence thresholds:**
- ≥0.85 → schedule send via cadence engine
- 0.60–0.84 → hold for operator review
- <0.60 → escalate

**Always escalate trigger phrases** (case-insensitive substring match):
```
are you a bot, is this ai, is this automated, legal action, attorney,
lawsuit, sue, cease and desist, defamation, refund, chargeback,
cancel the contract, breach
```

**Voice rules (in system prompt):**
- Never mention AI, bots, or automation
- Never reference CreatrOps or Clairen Haus
- Never use em-dashes
- Never start with "I hope this email finds you well"
- Always sign as the persona
- Keep replies under 150 words unless situation requires more

### 11.5 Deal Ops Agent

**Trigger:** `dealops.evaluate_deal` (on deal update) or `dealops.daily_sweep` (cron 09:00 local)
**Model:** Rule-based, LLM only for reminder message content
**Actions:** transition deal stages per state machine, create tasks, chase missing items

### 11.6 Contract Agent

**Trigger:** `contract.draft` (on transition to `contract_draft` stage)
**Model:** Claude Opus 4.6 for clause analysis
**Always requires human review before dispatch — no exceptions in v1**
**Actions:** select template, render with deal variables, analyze for non-standard clauses, create document record, escalate for review

### 11.7 Billing Agent

**Trigger:** `billing.generate_invoice` (on deal transition to `invoiced`), `billing.check_overdue` (daily cron 08:00 UTC), `billing.payment_webhook` (Stripe)

**Invoice generation:**
1. Verify contract is signed (block if not)
2. Create/find Stripe customer from primary contact
3. Build line items from deal deliverables + quoted amount
4. Create + finalize + send Stripe invoice
5. Schedule reminder jobs: +7d before due, +1d after due, +7d after due, +14d after due

**Overdue logic:**
- Day 1: polite reminder
- Day 7: firm reminder
- Day 14: escalate (severity: high)
- Day 30: escalate (severity: critical)

### 11.8 Renewal Agent

**Trigger:** `renewal.check` (daily cron 10:00 local)
**Actions:** for deals completed 21–28 days ago with no re-engagement message, generate and schedule renewal outreach via Inbox Agent

### 11.9 Oversight Agent

**Trigger:** after every `agent_runs` completion + `oversight.daily_health` (cron 07:00 UTC)
**Actions:** flag agent runs with confidence <0.5 and no escalation, flag stuck deals (>30 days same stage), flag messages queued >2h past scheduled send, generate daily digest

---

## 12. Deal State Machine

### 12.1 Stages and transitions

```
new → qualifying → qualified → negotiating → contract_draft
                      ↓                            ↓
                   declined              contract_sent → contract_signed
                                                              ↓
                                                       in_production
                                                              ↓
                                                 deliverables_submitted
                                                              ↓
                                                    invoiced → paid → completed

Any stage → declined | lost
```

### 12.2 Transition authority

| Transition | Actor |
|---|---|
| new → qualifying | Intake Agent |
| qualifying → qualified / declined | Qualification Agent |
| qualified → negotiating | Inbox Agent or Deal Ops Agent |
| negotiating → contract_draft | Human operator |
| contract_draft → contract_sent | Human operator (after review) |
| contract_sent → contract_signed | Documenso webhook |
| contract_signed → in_production | Deal Ops Agent |
| in_production → deliverables_submitted | Manual or webhook |
| deliverables_submitted → invoiced | Billing Agent |
| invoiced → paid | Stripe webhook |
| paid → completed | Deal Ops Agent (after 7d buffer) |
| any → lost | Human operator |

All transitions go through `transitionDeal()` with row lock + idempotency key.

---

## 13. Creator Portal Dashboard

### 13.1 Design reference

The VSL mock screenshot is the visual target. Dark background (`#050505`), gold chart lines (`#C9A84C`), crimson CTAs (`#C8102E`), CreatrOps wordmark in header. See `BRAND.md` for full design system.

### 13.2 Dashboard sections

**Header:**
- CreatrOps CO monogram logo
- Creator display name
- Notification bell (unread escalations/actions needing input)
- Sign out

**Metrics row (4 cards):**
- Total pipeline value (sum of active deal quoted amounts)
- Active deals (count of deals not in terminal stages)
- Closed this month (deals reaching `completed` this calendar month)
- Revenue collected (sum of paid invoices this month)

**Account manager card:**
- Persona photo, name, title
- "Currently active" green indicator
- Persona email address
- Last activity timestamp

**Deal pipeline:**
- One row per deal
- Columns: Brand, Campaign type, Value, Stage (pill), Last activity, Due date
- Clickable to deal detail page
- Filterable by stage

**Live activity feed:**
- Real-time via Supabase Realtime subscription on `activity_feed` table
- Each item: icon, description, timestamp
- Examples: "Sarah responded to FashionNova", "Contract sent to Bloom Beauty", "Invoice paid — $2,500"
- Show last 20 items, load more on scroll

**Upcoming deadlines:**
- Deliverables due in next 7 days
- Sorted by due date

**Referral snapshot:**
- Total creators referred
- Monthly commission earned
- Referral link with copy button
- "Share" button (native share API on mobile)

---

## 14. Cadence & Realism Engine

Delay computation for outbound emails:

| Context | Min delay | Max delay |
|---|---|---|
| First touch reply | 8 min | 45 min |
| Follow-up | 15 min | 90 min |
| Decline | 45 min | 180 min |
| Internal | 2 min | 10 min |

If current time is outside persona working hours → schedule for next business morning with 5–90 min jitter.

Friday after 4pm → defer to Monday.

Personas have one "PTO" day per 6 weeks (auto-reply fires, messages queued to next day).

---

## 15. Autonomy Policy & Confidence Thresholds

| Action | Autonomy | Gate |
|---|---|---|
| Create contact/deal | Full auto | None |
| Qualify / decline | Full auto | ≥0.80 |
| Request more info | Full auto | 0.50–0.79 |
| Draft first-touch reply | Full auto | — |
| Send reply | Full auto | Draft ≥0.85 |
| Hold reply for review | Triggered | 0.60–0.84 |
| Escalate reply | Triggered | <0.60 |
| Transition deal stage | Full auto | Deterministic rules |
| Create invoice | Full auto | After contract signed |
| Send invoice | Full auto | After generation |
| Send payment reminders 1–2 | Full auto | Deterministic |
| 3rd+ payment reminder | Escalate | Deterministic |
| Draft contract | Full auto | Any |
| Send contract | Human only | Always |
| Respond to "are you a bot" | Never | Always escalate |
| Accept exclusivity beyond policy | Never | Always escalate |
| Price below policy minimum | Never | Always escalate |

---

## 16. API Surface

### Public (unauthenticated)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intake/form/:client_slug` | Intake form submission |
| POST | `/api/webhooks/resend/inbound` | Resend inbound email |
| POST | `/api/webhooks/resend/events` | Resend delivery events |
| POST | `/api/webhooks/stripe` | Stripe events (signature-verified) |
| POST | `/api/webhooks/documenso` | Documenso signing events |
| POST | `/api/stripe/create-checkout` | Create Stripe Checkout session |
| POST | `/api/pregate` | Save pre-gate form submission |
| GET | `/api/auth/gmail` | Initiate Google OAuth flow |
| GET | `/api/auth/gmail/callback` | Handle Google OAuth callback |
| GET | `/api/auth/outlook` | Initiate Microsoft OAuth flow |
| GET | `/api/auth/outlook/callback` | Handle Microsoft OAuth callback |

### Authenticated

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard/:client_id` | Dashboard data |
| GET | `/api/deals` | List deals |
| GET | `/api/deals/:id` | Deal detail + timeline |
| POST | `/api/deals/:id/transition` | Manual stage transition (operator) |
| GET | `/api/messages/:id` | Message detail |
| POST | `/api/messages/:id/approve` | Approve queued outbound |
| POST | `/api/messages/:id/reject` | Reject queued outbound |
| GET | `/api/documents/:id` | Document + signed URL |
| POST | `/api/documents/:id/approve` | Approve contract (operator) |
| POST | `/api/documents/:id/dispatch` | Send contract via Documenso (operator) |
| GET | `/api/escalations` | Escalation queue (operator) |
| POST | `/api/escalations/:id/resolve` | Resolve escalation |
| GET | `/api/policies/:client_id` | Policy JSON |
| PUT | `/api/policies/:client_id` | Update policy (operator) |
| GET | `/api/affiliate/:user_id` | Affiliate earnings + referral link |
| GET | `/api/reports/monthly/:client_id/:yyyy_mm` | Monthly report |
| GET | `/api/activity/:client_id` | Activity feed (paginated) |

---

## 17. Email Infrastructure

### Domains
- Persona sending: `firstname@ops.creatrops.com`
- DNS on Cloudflare: MX → Resend inbound, SPF + DKIM + DMARC for Resend

### Resend setup
- One sending domain: `ops.creatrops.com`
- One per-persona From address registered in Resend
- Inbound webhook URL: `/api/webhooks/resend/inbound`
- All outbound sends include `In-Reply-To` + `References` for thread continuity

### Warm-up protocol per new persona
- Week 1: <20 sends/day
- Week 2: <50 sends/day
- Week 3: <100 sends/day
- Monitor bounce <2%, complaint <0.1%

---

## 18. Build Plan

### Sprint 0 — Foundation + Wizard (6–7 days)

**Goal:** auth working, DB schema applied, self-serve wizard ships.

- Supabase project configured, all tables created via migrations
- RLS enabled on all `client_id`-scoped tables
- Supabase Auth — magic link with PKCE, `/auth/callback` handles `token_hash` and `code`
- `src/app/page.tsx` — redirect to `/dashboard` if logged in, else `/login`
- Login page — CreatrOps branded, magic link flow
- Stripe products + prices created for all three tiers
- Stripe Checkout → account creation webhook
- 7-step onboarding wizard at `/onboarding/step-[n]`
- Wizard state persisted in `clients.wizard_step`
- Referral code generated on wizard completion
- Railway worker skeleton with pg-boss
- Resend domain verified, test persona sending identity
- Langfuse + Sentry configured
- Seed: one persona (Sarah Chen), one superadmin user

**Acceptance:** New creator selects tier → pays via Stripe → receives magic link → completes all 7 wizard steps → lands on dashboard → referral link displayed. Zero human involvement. Under 10 minutes end to end.

### Sprint 1 — CRM + Intake (5–6 days)

**Goal:** inbound email becomes a deal in the CRM.

- Resend inbound webhook handler
- Intake Agent implemented
- `transitionDeal()` function
- Deal state machine
- Minimal ops console: list deals, view deal + timeline
- Activity feed writes on intake events

**Acceptance:** email to persona address → deal appears in ops console within 60 seconds.

### Sprint 2 — Persona Communication (5–6 days)

**Goal:** agent sends a reply as the persona on human-realistic cadence.

- Resend outbound send with persona identity
- Cadence engine
- Inbox Agent with draft + self-review + schedule
- pg-boss delayed jobs for scheduled sends
- Email template library seeded
- Thread continuity via headers
- Ops console: message queue, approve/reject drafts

**Acceptance:** inbound → qualification → draft → sent within cadence window, not instantly.

### Sprint 3 — Qualification + Policy Engine (4–5 days)

**Goal:** qualify vs decline vs needs-info with configurable policies.

- Qualification Agent
- Policy engine + policy editor in ops console
- Always-escalate phrase matcher
- Escalation table + queue in ops console

**Acceptance:** ≥85% fixture accuracy, correct escalation pathway.

### Sprint 4 — Deal Ops + Reminders (4 days)

**Goal:** deals progress automatically.

- Deal Ops Agent rule engine
- pg-boss cron: daily sweeps per client timezone
- Task creation + completion
- Ops console: tasks tab, manual transition controls

### Sprint 5 — Contracts (5–6 days)

**Goal:** contract drafted, reviewed, dispatched, signed.

- Contract Agent with Opus clause analysis
- Contract template library (3 standard templates)
- Documenso integration
- Ops console: contract review UI, clause flags, approve/dispatch
- Documenso webhook for signing events

### Sprint 6 — Billing (4–5 days)

**Goal:** brand invoices generated, sent, tracked, reminded.

- Billing Agent — creator invoicing to brands
- Stripe invoice creation + webhooks
- Overdue check cron
- Ops console: invoices tab

### Sprint 7 — Creator Portal Dashboard (5–6 days)

**Goal:** creator sees their business at a glance.

- Dashboard at `/dashboard` with all sections from §13
- Live activity feed via Supabase Realtime
- Deal pipeline view
- Referral snapshot with live calculator
- Account manager card
- Upcoming deadlines
- Monthly report generation

**Design reference:** VSL mock screenshot. Dark, gold charts, crimson CTAs.

### Sprint 8 — Affiliate + Renewals + Oversight (4 days)

**Goal:** full closed loop.

- Renewal Agent
- Oversight Agent
- Commission calculation monthly cron
- Affiliate earnings in creator portal
- Founding affiliate two-tier logic (gated behind `affiliate_tier = 'founding'` flag)

### Sprint 9 — Evals, Cost Controls, Polish (4 days)

**Goal:** production-ready.

- LLM cost tracking per client
- Circuit breaker at 90% budget → switch to Haiku
- Full eval suite in CI
- Langfuse prompt caching on system prompts + policy profiles
- Onboarding monitoring dashboard
- Operator runbook

---

## 20. Email Scanning (OAuth Integration)

### 20.1 Google Gmail OAuth

**Scopes required:**
- `https://www.googleapis.com/auth/gmail.readonly` — read emails
- `https://www.googleapis.com/auth/gmail.modify` — mark emails as read/label them

**Flow:**
1. Creator clicks "Connect Gmail" in wizard step 6
2. Redirect to Google OAuth consent screen
3. On grant: store `access_token` + `refresh_token` in `email_connections` table (encrypted)
4. Background worker polls Gmail API every 15 minutes for new emails in inbox
5. For each new email: check if sender looks like a brand inquiry (not personal, not newsletter)
6. If brand inquiry detected: create inbound message row + enqueue `intake.process_email`
7. Label the email in Gmail as "CreatrOps — Processing"

**Token refresh:** access tokens expire every 1 hour. Use refresh token to obtain new access token before each scan. If refresh fails, set connection status to `expired` and notify operator.

**Brand inquiry detection heuristics:**
- Sender domain is a company domain (not gmail.com, yahoo.com, etc.)
- Subject contains keywords: partnership, collab, collaboration, sponsor, campaign, gifting, ambassador, paid
- Not a reply to an existing thread
- Not from a known spam/newsletter domain

### 20.2 Microsoft Outlook OAuth

Same pattern as Gmail using Microsoft Graph API:
- Scope: `Mail.Read Mail.ReadWrite offline_access`
- Endpoint: `https://graph.microsoft.com/v1.0/me/messages`
- Filter: `isRead eq false` + subject keyword matching

### 20.3 DM Auto-Reply Copy

Generated on wizard step 6 completion, stored in `clients` table, displayed in dashboard settings. Copy is platform-specific:

**Instagram:** "Thanks for reaching out! For brand partnership inquiries, please email [handle]@ops.creatrops.com — our partnerships team responds within 24 hours."

**TikTok:** Same as Instagram.

**Twitter/X:** Shorter for character limit: "For brand partnerships email [handle]@ops.creatrops.com"

---

## 21. Multi-Brand Support

### 21.1 Concept

A single CreatrOps user account can manage multiple creator brand identities. Each brand identity is a separate `clients` record with its own:
- Persona assignment
- Rate card and policy profile
- Deal pipeline
- Contract templates
- Email connection
- Dashboard view

### 21.2 How it works

**During onboarding:** wizard creates the primary brand identity automatically using the handle provided in step 2.

**Adding additional brands:** from the dashboard → Settings → "Add Another Brand" → mini wizard (brand name, handle, niche, platforms) → creates new `clients` record + `brand_identities` record linked to same user.

**Switching between brands:** dashboard header shows current active brand with a dropdown to switch. All data (deals, messages, pipeline) scoped to the selected brand.

**Billing:** each brand identity is billed separately at its own tier. A creator with two brands pays two retainers. The Stripe subscription is per `clients` record, not per `user_profiles` record.

### 21.3 Database

The `brand_identities` table links `user_profiles` to multiple `clients` records. The `is_primary` flag identifies the first/default brand. RLS policies allow users to access all `clients` records they have a `brand_identities` entry for.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # worker + server-side only
DATABASE_URL=                    # Postgres connection string for Drizzle

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER_OPS=       # Stripe price ID for $500/mo
STRIPE_PRICE_GROWTH_OPS=        # Stripe price ID for $1,250/mo
STRIPE_PRICE_CREATOR_CEO=       # Stripe price ID for $2,500/mo

# Documenso
DOCUMENSO_API_KEY=
DOCUMENSO_API_URL=
DOCUMENSO_WEBHOOK_SECRET=

# Langfuse
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Sentry
SENTRY_DSN=

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.creatrops.com/api/auth/gmail/callback

# Microsoft OAuth (Outlook)
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://app.creatrops.com/api/auth/outlook/callback
MICROSOFT_TENANT_ID=common

# App
NEXT_PUBLIC_SITE_URL=https://app.creatrops.com
OPS_EMAIL_DOMAIN=ops.creatrops.com
```

---

## 20. Repository Structure

```
creatrops-app/
├── src/
│   ├── app/
│   │   ├── (creator)/          # Creator portal routes
│   │   │   ├── dashboard/
│   │   │   ├── deals/
│   │   │   ├── documents/
│   │   │   └── affiliate/
│   │   ├── (ops)/              # Internal ops console
│   │   │   ├── ops/
│   │   │   ├── ops/clients/
│   │   │   ├── ops/escalations/
│   │   │   └── ops/metrics/
│   │   ├── onboarding/         # Self-serve wizard
│   │   │   ├── step-1/
│   │   │   ├── step-2/
│   │   │   └── ...step-7/
│   │   ├── auth/
│   │   │   └── callback/       # Magic link handler
│   │   ├── login/
│   │   ├── api/
│   │   │   ├── intake/
│   │   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   └── affiliate/
│   │   └── page.tsx            # Redirect only
│   ├── agents/                 # Agent modules
│   │   ├── intake.ts
│   │   ├── qualification.ts
│   │   ├── inbox.ts
│   │   ├── deal-ops.ts
│   │   ├── contract.ts
│   │   ├── billing.ts
│   │   ├── renewal.ts
│   │   └── oversight.ts
│   ├── db/
│   │   ├── schema/
│   │   └── migrations/
│   ├── domain/
│   │   ├── deals.ts            # transitionDeal()
│   │   └── policies.ts
│   ├── email/
│   │   └── send.ts             # Resend outbound
│   ├── cadence/
│   │   └── compute.ts
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts       # Browser client (flowType: 'pkce')
│   │       └── server.ts       # Server client
│   └── worker/
│       ├── index.ts            # pg-boss consumer
│       └── cron.ts
├── supabase/
│   └── migrations/
├── BRAND.md                    # Brand guide
├── .env.example
└── package.json
```

---

## 21. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM hallucinates a commitment in a reply | Self-review pass checks for commitment language; escalates if found |
| Resend deliverability drops | Warm-up protocol; reputation monitoring; fallback sending identity |
| Agent sends wrong message | Every outbound logged with draft + confidence + decision — full audit trail |
| Runaway LLM cost | Per-client budget + circuit breaker + Haiku fallback |
| State machine corruption | `transitionDeal()` with row lock + idempotency key |
| Resend webhook replay | Webhook handlers keyed on message ID; duplicate detection before insert |
| Brand asks "are you a bot" | Always-escalate phrase list halts drafting on that thread |
| Founding affiliate terms leak | Tier 2 logic gated behind DB flag; never shown in creator portal UI |
| Cruise traffic spike | Pre-gate is static HTML — unlimited traffic. App onboarding is the only dynamic load point; Supabase + Railway scale automatically |

---

## 22. Definition of "Done" for v1

- One real creator client operational for ≥14 consecutive days
- ≥20 real inbound inquiries processed end-to-end
- ≥2 real contracts drafted, reviewed, dispatched
- ≥1 real invoice paid through the system
- ≥5 creators onboarded via self-serve wizard with no human involvement
- Escalation rate <15% of agent runs
- No critical incidents (wrong-client data, duplicate contract, wrong invoice amount)
- Monthly report generated and delivered to creator
- Affiliate commissions calculated correctly for at least one payout cycle
