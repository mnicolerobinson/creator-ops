-- Ops role: full CRUD on operational tables (authenticated as ops in profiles)

drop policy if exists "agent_logs_ops_only" on public.agent_action_logs;
drop policy if exists "job_queue_ops_only" on public.job_queue;

-- creators
drop policy if exists "creators_ops_all" on public.creators;
create policy "creators_ops_all"
  on public.creators for all
  using (public.is_ops())
  with check (public.is_ops());

-- personas
drop policy if exists "personas_ops_all" on public.personas;
create policy "personas_ops_all"
  on public.personas for all
  using (public.is_ops())
  with check (public.is_ops());

-- contacts
drop policy if exists "contacts_ops_all" on public.contacts;
create policy "contacts_ops_all"
  on public.contacts for all
  using (public.is_ops())
  with check (public.is_ops());

-- deals
drop policy if exists "deals_ops_all" on public.deals;
create policy "deals_ops_all"
  on public.deals for all
  using (public.is_ops())
  with check (public.is_ops());

-- communications
drop policy if exists "communications_ops_all" on public.communications;
create policy "communications_ops_all"
  on public.communications for all
  using (public.is_ops())
  with check (public.is_ops());

-- tasks
drop policy if exists "tasks_ops_all" on public.tasks;
create policy "tasks_ops_all"
  on public.tasks for all
  using (public.is_ops())
  with check (public.is_ops());

-- escalation_cases
drop policy if exists "escalation_ops_all" on public.escalation_cases;
create policy "escalation_ops_all"
  on public.escalation_cases for all
  using (public.is_ops())
  with check (public.is_ops());

-- agent_action_logs
drop policy if exists "agent_logs_ops_all" on public.agent_action_logs;
create policy "agent_logs_ops_all"
  on public.agent_action_logs for all
  using (public.is_ops())
  with check (public.is_ops());

-- documents
drop policy if exists "documents_ops_all" on public.documents;
create policy "documents_ops_all"
  on public.documents for all
  using (public.is_ops())
  with check (public.is_ops());

-- invoices
drop policy if exists "invoices_ops_all" on public.invoices;
create policy "invoices_ops_all"
  on public.invoices for all
  using (public.is_ops())
  with check (public.is_ops());

-- job_queue
drop policy if exists "job_queue_ops_all" on public.job_queue;
create policy "job_queue_ops_all"
  on public.job_queue for all
  using (public.is_ops())
  with check (public.is_ops());
