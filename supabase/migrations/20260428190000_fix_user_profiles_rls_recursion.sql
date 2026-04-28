-- Fix: "infinite recursion detected in policy for relation user_profiles"
-- Inline EXISTS (SELECT ... FROM user_profiles) inside user_profiles policies
-- re-triggers RLS on the same table. Use SECURITY DEFINER helper to read role
-- without RLS recursion (same pattern as current_user_has_client_access()).

set search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_profile_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_profile_role() IS
  'RLS-safe: current session user role from user_profiles (bypasses RLS to avoid recursion in policies).';

GRANT EXECUTE ON FUNCTION public.current_user_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_profile_role() TO service_role;

-- user_profiles: own row OR superadmin (all rows)
DROP POLICY IF EXISTS user_profiles_select ON user_profiles;
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.current_user_profile_role() = 'superadmin'
  );

DROP POLICY IF EXISTS user_profiles_update ON user_profiles;
CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR public.current_user_profile_role() = 'superadmin'
  );

-- Tables that inlined EXISTS on user_profiles for ops visibility
DROP POLICY IF EXISTS agent_runs_select ON agent_runs;
CREATE POLICY agent_runs_select ON agent_runs FOR SELECT
  USING (
    public.current_user_profile_role() IN ('superadmin', 'operator')
  );

DROP POLICY IF EXISTS escalations_select ON escalations;
CREATE POLICY escalations_select ON escalations FOR SELECT
  USING (
    public.current_user_profile_role() IN ('superadmin', 'operator')
  );

DROP POLICY IF EXISTS affiliate_commissions_select ON affiliate_commissions;
CREATE POLICY affiliate_commissions_select ON affiliate_commissions FOR SELECT
  USING (
    affiliate_user_id = auth.uid()
    OR current_user_has_client_access(referred_client_id)
    OR public.current_user_profile_role() = 'superadmin'
  );
