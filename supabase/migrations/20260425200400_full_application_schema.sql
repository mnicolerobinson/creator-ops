-- Creator Ops application schema
--
-- The initial scaffold used earlier table/type names that conflict with the
-- application schema below. Rebuild those public application objects before
-- creating the current schema.

set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists audit_log cascade;
drop table if exists intake_submissions cascade;
drop table if exists email_templates cascade;
drop table if exists escalations cascade;
drop table if exists agent_runs cascade;
drop table if exists client_policies cascade;
drop table if exists tasks cascade;
drop table if exists invoices cascade;
drop table if exists contract_templates cascade;
drop table if exists documents cascade;
drop table if exists messages cascade;
drop table if exists deal_stage_history cascade;
drop table if exists deals cascade;
drop table if exists contacts cascade;
drop table if exists companies cascade;
drop table if exists client_personas cascade;
drop table if exists personas cascade;
drop table if exists user_clients cascade;
drop table if exists user_profiles cascade;

drop table if exists escalation_cases cascade;
drop table if exists agent_action_logs cascade;
drop table if exists communications cascade;
drop table if exists job_queue cascade;
drop table if exists profiles cascade;
drop table if exists creators cascade;

drop type if exists deal_stage cascade;
drop type if exists message_direction cascade;
drop type if exists message_channel cascade;
drop type if exists message_status cascade;
drop type if exists document_kind cascade;
drop type if exists document_status cascade;
drop type if exists invoice_status cascade;
drop type if exists task_kind cascade;
drop type if exists task_status cascade;
drop type if exists agent_run_status cascade;
drop type if exists escalation_reason cascade;
drop type if exists escalation_status cascade;

drop type if exists user_role cascade;
drop type if exists qualification_status cascade;
drop type if exists agent_kind cascade;
drop type if exists job_status cascade;
drop type if exists comm_direction cascade;
drop type if exists comm_status cascade;

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
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'churned')),
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Users and role assignments
-- ============================================================
-- Users come from Supabase Auth; we store app-level profile
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'operator', 'creator', 'creator_delegate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_clients (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL CHECK (access_level IN ('full', 'read_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, email, role)
  VALUES (NEW.id, COALESCE(NEW.email, ''), 'creator')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Personas (virtual account managers)
-- ============================================================
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  sending_email TEXT NOT NULL UNIQUE,
  sending_name TEXT NOT NULL,
  signature_html TEXT NOT NULL,
  voice_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  working_hours_json JSONB NOT NULL DEFAULT '{"mon_fri_start": "09:00", "mon_fri_end": "18:00", "weekend": false}'::jsonb,
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
  ON client_personas (client_id)
  WHERE is_primary = true;

-- ============================================================
-- Contacts (people at brands)
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
-- Deals (opportunities)
-- ============================================================
CREATE TYPE deal_stage AS ENUM (
  'new',
  'qualifying',
  'qualified',
  'negotiating',
  'contract_draft',
  'contract_sent',
  'contract_signed',
  'in_production',
  'deliverables_submitted',
  'invoiced',
  'paid',
  'completed',
  'declined',
  'lost'
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
-- Messages (all inbound + outbound communication)
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
-- Documents (contracts, briefs, attachments)
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

-- ============================================================
-- Contract templates
-- ============================================================
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
-- Tasks (reminders, follow-ups, internal notes)
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
-- Policies (per-client operating profile)
-- ============================================================
CREATE TABLE client_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  policy_json JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_by_user_id UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Agent runs (every time an agent is invoked)
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
CREATE INDEX idx_agent_runs_agent_status ON agent_runs (agent_name, status);

-- ============================================================
-- Escalations
-- ============================================================
CREATE TYPE escalation_reason AS ENUM (
  'low_confidence',
  'non_standard_contract_clause',
  'pricing_exception',
  'policy_violation',
  'brand_asked_if_bot',
  'threatening_language',
  'overdue_high_value',
  'tool_failure',
  'other'
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
-- Email templates (managed library)
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
-- Intake form submissions
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
-- Audit log (generic)
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
