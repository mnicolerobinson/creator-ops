-- Sprint 0 schema reconciliation from SPEC.md §6 and RLS from §7.
-- Drizzle schema lives in src/db/schema; this migration applies the same
-- public database contract to the linked Supabase project.

set search_path = public;

-- ============================================================
-- Schema reconciliation
-- ============================================================

CREATE TABLE IF NOT EXISTS pregate_submissions (
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

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS handle_twitter TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS follower_count_range TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscription_tier TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wizard_step INT NOT NULL DEFAULT 1;
ALTER TABLE clients ALTER COLUMN status SET DEFAULT 'onboarding';
ALTER TABLE clients ADD CONSTRAINT clients_stripe_customer_id_unique UNIQUE (stripe_customer_id);
ALTER TABLE clients ADD CONSTRAINT clients_subscription_tier_check
  CHECK (subscription_tier IS NULL OR subscription_tier IN ('starter_ops', 'growth_ops', 'creator_ceo'));
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('onboarding', 'active', 'paused', 'churned'));

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS affiliate_tier TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES user_profiles(id);
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_affiliate_tier_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_affiliate_tier_check
  CHECK (affiliate_tier IN ('standard', 'founding'));

CREATE TABLE IF NOT EXISTS affiliate_commissions (
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

ALTER TABLE personas ALTER COLUMN working_hours_json
  SET DEFAULT '{"timezone":"America/New_York","mon_fri_start":"09:00","mon_fri_end":"18:00","weekend":false}'::jsonb;

CREATE TABLE IF NOT EXISTS activity_feed (
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

CREATE INDEX IF NOT EXISTS idx_activity_feed_client ON activity_feed (client_id, created_at DESC);

-- Keep auth profile creation aligned with the new user_profiles table.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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
-- RLS helper and policies
-- ============================================================

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

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients FOR SELECT USING (current_user_has_client_access(id));
DROP POLICY IF EXISTS clients_insert ON clients;
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (current_user_has_client_access(id));
DROP POLICY IF EXISTS clients_update ON clients;
CREATE POLICY clients_update ON clients FOR UPDATE USING (current_user_has_client_access(id));

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'));
DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'));

ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_clients_select ON user_clients;
CREATE POLICY user_clients_select ON user_clients FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS user_clients_insert ON user_clients;
CREATE POLICY user_clients_insert ON user_clients FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS user_clients_update ON user_clients;
CREATE POLICY user_clients_update ON user_clients FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE client_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_personas_select ON client_personas;
CREATE POLICY client_personas_select ON client_personas FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS client_personas_insert ON client_personas;
CREATE POLICY client_personas_insert ON client_personas FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS client_personas_update ON client_personas;
CREATE POLICY client_personas_update ON client_personas FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert ON companies FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_select ON contacts;
CREATE POLICY contacts_select ON contacts FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS contacts_insert ON contacts;
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS contacts_update ON contacts;
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deals_select ON deals;
CREATE POLICY deals_select ON deals FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS deals_insert ON deals;
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS deals_update ON deals;
CREATE POLICY deals_update ON deals FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS messages_update ON messages;
CREATE POLICY messages_update ON messages FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS documents_insert ON documents;
CREATE POLICY documents_insert ON documents FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS documents_update ON documents;
CREATE POLICY documents_update ON documents FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_templates_select ON contract_templates;
CREATE POLICY contract_templates_select ON contract_templates FOR SELECT
  USING (client_id IS NULL OR current_user_has_client_access(client_id));
DROP POLICY IF EXISTS contract_templates_insert ON contract_templates;
CREATE POLICY contract_templates_insert ON contract_templates FOR INSERT
  WITH CHECK (client_id IS NULL OR current_user_has_client_access(client_id));
DROP POLICY IF EXISTS contract_templates_update ON contract_templates;
CREATE POLICY contract_templates_update ON contract_templates FOR UPDATE
  USING (client_id IS NULL OR current_user_has_client_access(client_id));

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS invoices_insert ON invoices;
CREATE POLICY invoices_insert ON invoices FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS invoices_update ON invoices;
CREATE POLICY invoices_update ON invoices FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_select ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS tasks_insert ON tasks;
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS tasks_update ON tasks;
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE client_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_policies_select ON client_policies;
CREATE POLICY client_policies_select ON client_policies FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS client_policies_insert ON client_policies;
CREATE POLICY client_policies_insert ON client_policies FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS client_policies_update ON client_policies;
CREATE POLICY client_policies_update ON client_policies FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_runs_select ON agent_runs;
CREATE POLICY agent_runs_select ON agent_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('superadmin', 'operator')));
DROP POLICY IF EXISTS agent_runs_insert ON agent_runs;
CREATE POLICY agent_runs_insert ON agent_runs FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS agent_runs_update ON agent_runs;
CREATE POLICY agent_runs_update ON agent_runs FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS escalations_select ON escalations;
CREATE POLICY escalations_select ON escalations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('superadmin', 'operator')));
DROP POLICY IF EXISTS escalations_insert ON escalations;
CREATE POLICY escalations_insert ON escalations FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS escalations_update ON escalations;
CREATE POLICY escalations_update ON escalations FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_templates_select ON email_templates;
CREATE POLICY email_templates_select ON email_templates FOR SELECT
  USING (client_id IS NULL OR current_user_has_client_access(client_id));
DROP POLICY IF EXISTS email_templates_insert ON email_templates;
CREATE POLICY email_templates_insert ON email_templates FOR INSERT
  WITH CHECK (client_id IS NULL OR current_user_has_client_access(client_id));
DROP POLICY IF EXISTS email_templates_update ON email_templates;
CREATE POLICY email_templates_update ON email_templates FOR UPDATE
  USING (client_id IS NULL OR current_user_has_client_access(client_id));

ALTER TABLE intake_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS intake_submissions_select ON intake_submissions;
CREATE POLICY intake_submissions_select ON intake_submissions FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS intake_submissions_insert ON intake_submissions;
CREATE POLICY intake_submissions_insert ON intake_submissions FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS intake_submissions_update ON intake_submissions;
CREATE POLICY intake_submissions_update ON intake_submissions FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_feed_select ON activity_feed;
CREATE POLICY activity_feed_select ON activity_feed FOR SELECT USING (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS activity_feed_insert ON activity_feed;
CREATE POLICY activity_feed_insert ON activity_feed FOR INSERT WITH CHECK (current_user_has_client_access(client_id));
DROP POLICY IF EXISTS activity_feed_update ON activity_feed;
CREATE POLICY activity_feed_update ON activity_feed FOR UPDATE USING (current_user_has_client_access(client_id));

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_select ON audit_log;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (client_id IS NULL OR current_user_has_client_access(client_id));
DROP POLICY IF EXISTS audit_log_insert ON audit_log;
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (client_id IS NULL OR current_user_has_client_access(client_id));

ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS affiliate_commissions_select ON affiliate_commissions;
CREATE POLICY affiliate_commissions_select ON affiliate_commissions FOR SELECT
  USING (
    affiliate_user_id = auth.uid()
    OR current_user_has_client_access(referred_client_id)
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ============================================================
-- Sprint 0 seed data
-- ============================================================

INSERT INTO personas (
  display_name,
  title,
  sending_email,
  sending_name,
  signature_html,
  voice_profile_json,
  working_hours_json
)
VALUES (
  'Sarah Chen',
  'Partnerships Lead',
  'sarah@ops.creatrops.com',
  'Sarah Chen',
  'Sarah Chen<br/>Partnerships Lead<br/>sarah@ops.creatrops.com',
  '{"tone":"professional, warm, concise","signoff":"Sarah"}'::jsonb,
  '{"timezone":"America/New_York","mon_fri_start":"09:00","mon_fri_end":"18:00","weekend":false}'::jsonb
)
ON CONFLICT (sending_email) DO UPDATE SET
  display_name = excluded.display_name,
  title = excluded.title,
  sending_name = excluded.sending_name,
  signature_html = excluded.signature_html,
  voice_profile_json = excluded.voice_profile_json,
  working_hours_json = excluded.working_hours_json;
