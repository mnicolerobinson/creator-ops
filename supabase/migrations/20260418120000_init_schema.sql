-- Creator Ops — core schema + RLS (Supabase / Postgres)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.user_role as enum ('creator', 'ops');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.deal_stage as enum (
    'lead',
    'qualified',
    'proposal',
    'contract',
    'production',
    'delivered',
    'closed_won',
    'closed_lost'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.qualification_status as enum (
    'pending',
    'qualified',
    'needs_info',
    'declined',
    'escalated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.agent_kind as enum (
    'intake',
    'qualification',
    'inbox',
    'deal_ops',
    'contract',
    'billing',
    'renewal',
    'oversight'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.job_status as enum ('pending', 'processing', 'done', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.comm_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.comm_status as enum (
    'received',
    'draft',
    'queued_review',
    'scheduled',
    'sent',
    'failed',
    'escalated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.escalation_reason as enum (
    'bot_detection',
    'legal_threat',
    'low_confidence',
    'policy_exception',
    'revenue_risk',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_kind as enum ('contract', 'brief', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'signed',
    'void'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invoice_status as enum (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  email text,
  policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'creator',
  creator_id uuid references public.creators (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  display_name text not null,
  title text,
  send_email text not null,
  voice_profile_json jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create index if not exists personas_creator_id_idx on public.personas (creator_id);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  email text,
  name text,
  company text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_creator_id_idx on public.contacts (creator_id);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  persona_id uuid references public.personas (id) on delete set null,
  title text not null,
  stage public.deal_stage not null default 'lead',
  budget_cents bigint,
  campaign_type text,
  platform text,
  rights_summary text,
  fit_score numeric(4, 3),
  qualification_status public.qualification_status not null default 'pending',
  qualification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_creator_id_idx on public.deals (creator_id);
create index if not exists deals_stage_idx on public.deals (stage);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null,
  direction public.comm_direction not null,
  status public.comm_status not null default 'received',
  subject text,
  body text,
  thread_id text,
  external_message_id text,
  confidence_score numeric(4, 3),
  trigger_flags text[] not null default '{}',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists communications_deal_id_idx on public.communications (deal_id);
create index if not exists communications_scheduled_idx on public.communications (scheduled_at)
  where status = 'scheduled';

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tasks_deal_id_idx on public.tasks (deal_id);

create table if not exists public.escalation_cases (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals (id) on delete cascade,
  reason public.escalation_reason not null,
  severity int not null default 1 check (severity between 1 and 5),
  status text not null default 'open',
  summary text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists escalation_cases_status_idx on public.escalation_cases (status);

create table if not exists public.agent_action_logs (
  id uuid primary key default gen_random_uuid(),
  agent public.agent_kind not null,
  deal_id uuid references public.deals (id) on delete set null,
  trigger text,
  confidence numeric(4, 3),
  result_json jsonb not null default '{}'::jsonb,
  rollback_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_action_logs_deal_id_idx on public.agent_action_logs (deal_id);
create index if not exists agent_action_logs_created_idx on public.agent_action_logs (created_at desc);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind public.document_kind not null default 'contract',
  status public.document_status not null default 'draft',
  documenso_document_id text,
  template_id text,
  requires_approval boolean not null default true,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_deal_id_idx on public.documents (deal_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  status public.invoice_status not null default 'draft',
  stripe_invoice_id text unique,
  amount_cents bigint not null,
  currency text not null default 'usd',
  due_at timestamptz,
  paid_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists invoices_deal_id_idx on public.invoices (deal_id);
create index if not exists invoices_stripe_idx on public.invoices (stripe_invoice_id);

create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  run_after timestamptz not null default now(),
  status public.job_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists job_queue_pending_idx on public.job_queue (run_after)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creators_updated_at on public.creators;
create trigger creators_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

drop trigger if exists deals_updated_at on public.deals;
create trigger deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: new user → profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'creator');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.creators enable row level security;
alter table public.profiles enable row level security;
alter table public.personas enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.communications enable row level security;
alter table public.tasks enable row level security;
alter table public.escalation_cases enable row level security;
alter table public.agent_action_logs enable row level security;
alter table public.documents enable row level security;
alter table public.invoices enable row level security;
alter table public.job_queue enable row level security;

-- Helper: is ops
create or replace function public.is_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ops'
  );
$$;

-- Helper: current creator scope
create or replace function public.my_creator_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.creator_id from public.profiles p
  where p.id = auth.uid() and p.role = 'creator'
  limit 1;
$$;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid() or public.is_ops());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid() or public.is_ops());

-- creators
drop policy if exists "creators_select_scope" on public.creators;
create policy "creators_select_scope"
  on public.creators for select
  using (public.is_ops() or id = public.my_creator_id());

-- personas, contacts, deals (same pattern)
drop policy if exists "personas_select_scope" on public.personas;
create policy "personas_select_scope"
  on public.personas for select
  using (public.is_ops() or creator_id = public.my_creator_id());

drop policy if exists "contacts_select_scope" on public.contacts;
create policy "contacts_select_scope"
  on public.contacts for select
  using (public.is_ops() or creator_id = public.my_creator_id());

drop policy if exists "deals_select_scope" on public.deals;
create policy "deals_select_scope"
  on public.deals for select
  using (public.is_ops() or creator_id = public.my_creator_id());

drop policy if exists "communications_select_scope" on public.communications;
create policy "communications_select_scope"
  on public.communications for select
  using (
    public.is_ops()
    or exists (
      select 1 from public.deals d
      where d.id = communications.deal_id and d.creator_id = public.my_creator_id()
    )
  );

drop policy if exists "tasks_select_scope" on public.tasks;
create policy "tasks_select_scope"
  on public.tasks for select
  using (
    public.is_ops()
    or (
      deal_id is not null
      and exists (
        select 1 from public.deals d
        where d.id = tasks.deal_id and d.creator_id = public.my_creator_id()
      )
    )
  );

drop policy if exists "escalation_select_scope" on public.escalation_cases;
create policy "escalation_select_scope"
  on public.escalation_cases for select
  using (
    public.is_ops()
    or (
      deal_id is not null
      and exists (
        select 1 from public.deals d
        where d.id = escalation_cases.deal_id and d.creator_id = public.my_creator_id()
      )
    )
  );

-- Creator portal: no raw agent logs (outcome-only). Hide logs from creators.
drop policy if exists "agent_logs_ops_only" on public.agent_action_logs;
create policy "agent_logs_ops_only"
  on public.agent_action_logs for select
  using (public.is_ops());

drop policy if exists "documents_select_scope" on public.documents;
create policy "documents_select_scope"
  on public.documents for select
  using (
    public.is_ops()
    or exists (
      select 1 from public.deals d
      where d.id = documents.deal_id and d.creator_id = public.my_creator_id()
    )
  );

drop policy if exists "invoices_select_scope" on public.invoices;
create policy "invoices_select_scope"
  on public.invoices for select
  using (
    public.is_ops()
    or exists (
      select 1 from public.deals d
      where d.id = invoices.deal_id and d.creator_id = public.my_creator_id()
    )
  );

-- job_queue: ops only (internal)
drop policy if exists "job_queue_ops_only" on public.job_queue;
create policy "job_queue_ops_only"
  on public.job_queue for select
  using (public.is_ops());

-- Service role bypasses RLS — workers use service role for writes.

comment on table public.agent_action_logs is 'Operator-only via RLS; creators must not see agent internals.';
