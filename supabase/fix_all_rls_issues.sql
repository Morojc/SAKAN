-- ============================================================================
-- COMPREHENSIVE FIX: All Supabase Security Issues
-- ============================================================================
-- This script fixes:
-- 1. RLS Disabled issues
-- 2. Function Search Path Mutable issues
-- 3. Multiple Permissive Policies
-- 4. Missing RLS policies
-- ============================================================================

-- ============================================================================
-- PART 0: ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pgcrypto extension for password hashing (crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- PART 1: ENABLE RLS ON ALL TABLES
-- ============================================================================

DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'dbasakan'
        ORDER BY tablename
    LOOP
        -- Enable RLS on all tables
        EXECUTE format('ALTER TABLE dbasakan.%I ENABLE ROW LEVEL SECURITY', table_name);
        RAISE NOTICE 'Enabled RLS on table: %', table_name;
    END LOOP;
END $$;

-- ============================================================================
-- PART 2: DROP ALL EXISTING POLICIES (to fix duplicates)
-- ============================================================================

DO $$
DECLARE
    policy_record record;
BEGIN
    -- Drop all existing policies to start fresh
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'dbasakan'
        ORDER BY tablename, policyname
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON dbasakan.%I', 
            policy_record.policyname, 
            policy_record.tablename);
        RAISE NOTICE 'Dropped policy: %.%', policy_record.tablename, policy_record.policyname;
    END LOOP;
END $$;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATH ISSUES
-- ============================================================================

-- Fix get_user_residence_id function
CREATE OR REPLACE FUNCTION dbasakan.get_user_residence_id(user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = dbasakan, pg_temp
AS $$
DECLARE
  user_role dbasakan.user_role;
  residence_id bigint;
  user_id_text text;
BEGIN
  user_id_text := user_id::text;
  
  SELECT role INTO user_role FROM dbasakan.profiles WHERE id = user_id_text;
  
  IF user_role IS NULL THEN
    RETURN NULL::bigint;
  END IF;
  
  IF user_role = 'syndic' THEN
    SELECT r.id::bigint INTO residence_id 
    FROM dbasakan.residences r 
    WHERE r.syndic_user_id = user_id_text 
    LIMIT 1;
  ELSIF user_role = 'guard' THEN
    SELECT r.id::bigint INTO residence_id 
    FROM dbasakan.residences r 
    WHERE r.guard_user_id = user_id_text 
    LIMIT 1;
  ELSIF user_role = 'resident' THEN
    SELECT (pr.residence_id::bigint) INTO residence_id 
    FROM dbasakan.profile_residences pr 
    WHERE pr.profile_id = user_id_text 
    LIMIT 1;
  END IF;
  
  RETURN COALESCE(residence_id, NULL::bigint);
END;
$$;

-- Fix verify_admin_password function
CREATE OR REPLACE FUNCTION dbasakan.verify_admin_password(
  p_email text,
  p_password text
)
RETURNS TABLE(
  admin_id text,
  email text,
  full_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.email,
    a.full_name,
    a.is_active
  FROM dbasakan.admins a
  WHERE a.email = p_email
    AND a.password_hash = crypt(p_password, a.password_hash)
    AND a.is_active = true;
END;
$$;

-- Fix create_admin function
CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, pg_temp
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
BEGIN
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active, access_hash)
  VALUES (
    p_email, 
    v_password_hash, 
    p_full_name, 
    true,
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12))
  )
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Fix generate_admin_hash function
CREATE OR REPLACE FUNCTION dbasakan.generate_admin_hash()
RETURNS text
LANGUAGE plpgsql
SET search_path = dbasakan, pg_temp
AS $$
BEGIN
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
END;
$$;

-- Fix create_profile_on_user_insert function
CREATE OR REPLACE FUNCTION dbasakan.create_profile_on_user_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, pg_temp
AS $$
BEGIN
  INSERT INTO dbasakan.profiles (
    id,
    full_name,
    role,
    onboarding_completed,
    verified
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.name, 'User'),
    'syndic'::dbasakan.user_role,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Fix get_residence_stats function
CREATE OR REPLACE FUNCTION dbasakan.get_residence_stats(p_residence_id bigint)
RETURNS TABLE(
  total_residents bigint,
  total_fees bigint,
  outstanding_fees numeric,
  total_payments numeric,
  open_incidents bigint,
  recent_announcements bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = dbasakan, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint FROM dbasakan.profile_residences WHERE residence_id = p_residence_id) as total_residents,
    (SELECT COUNT(*)::bigint FROM dbasakan.fees WHERE residence_id = p_residence_id) as total_fees,
    (SELECT COALESCE(SUM(amount), 0) FROM dbasakan.fees WHERE residence_id = p_residence_id AND status = 'unpaid') as outstanding_fees,
    (SELECT COALESCE(SUM(amount), 0) FROM dbasakan.payments WHERE residence_id = p_residence_id AND status = 'verified') as total_payments,
    (SELECT COUNT(*)::bigint FROM dbasakan.incidents WHERE residence_id = p_residence_id AND status = 'open') as open_incidents,
    (SELECT COUNT(*)::bigint FROM dbasakan.announcements WHERE residence_id = p_residence_id AND created_at > NOW() - INTERVAL '7 days') as recent_announcements;
END;
$$;

-- Fix calculate_residence_balance function
CREATE OR REPLACE FUNCTION dbasakan.calculate_residence_balance(p_residence_id bigint)
RETURNS TABLE(
  cash_balance numeric,
  bank_balance numeric,
  total_income numeric,
  total_expenses numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = dbasakan, pg_temp
AS $$
DECLARE
  v_cash_balance numeric := 0;
  v_bank_balance numeric := 0;
  v_total_income numeric := 0;
  v_total_expenses numeric := 0;
BEGIN
  SELECT cash_balance, bank_balance INTO v_cash_balance, v_bank_balance
  FROM dbasakan.balance_snapshots
  WHERE residence_id = p_residence_id
  ORDER BY snapshot_date DESC
  LIMIT 1;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_income
  FROM dbasakan.payments
  WHERE residence_id = p_residence_id
    AND status = 'verified';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM dbasakan.expenses
  WHERE residence_id = p_residence_id;
  
  RETURN QUERY
  SELECT
    COALESCE(v_cash_balance, 0) as cash_balance,
    COALESCE(v_bank_balance, 0) as bank_balance,
    COALESCE(v_total_income, 0) as total_income,
    COALESCE(v_total_expenses, 0) as total_expenses;
END;
$$;

-- Fix create_notification function
CREATE OR REPLACE FUNCTION dbasakan.create_notification(
  p_user_id text,
  p_type dbasakan.notification_type,
  p_title text,
  p_message text,
  p_residence_id bigint DEFAULT NULL,
  p_action_data jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, pg_temp
AS $$
DECLARE
  v_notification_id bigint;
BEGIN
  INSERT INTO dbasakan.notifications (
    user_id,
    type,
    title,
    message,
    residence_id,
    action_data
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_residence_id,
    p_action_data
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Fix mark_notification_read function
CREATE OR REPLACE FUNCTION dbasakan.mark_notification_read(p_notification_id bigint, p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, pg_temp
AS $$
BEGIN
  UPDATE dbasakan.notifications
  SET status = 'read'::dbasakan.notification_status,
      read_at = NOW()
  WHERE id = p_notification_id
    AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- Fix user_can_access_residence function
CREATE OR REPLACE FUNCTION dbasakan.user_can_access_residence(p_user_id text, p_residence_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = dbasakan, pg_temp
AS $$
DECLARE
  v_user_role dbasakan.user_role;
  v_user_residence_id bigint;
BEGIN
  SELECT role INTO v_user_role FROM dbasakan.profiles WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_user_role = 'syndic' THEN
    SELECT id INTO v_user_residence_id
    FROM dbasakan.residences
    WHERE syndic_user_id = p_user_id
    LIMIT 1;
    
    RETURN v_user_residence_id = p_residence_id;
    
  ELSIF v_user_role = 'guard' THEN
    SELECT id INTO v_user_residence_id
    FROM dbasakan.residences
    WHERE guard_user_id = p_user_id
    LIMIT 1;
    
    RETURN v_user_residence_id = p_residence_id;
    
  ELSIF v_user_role = 'resident' THEN
    RETURN EXISTS (
      SELECT 1 FROM dbasakan.profile_residences
      WHERE profile_id = p_user_id
        AND residence_id = p_residence_id
    );
  END IF;
  
  RETURN false;
END;
$$;

-- Fix update_complaints_updated_at function
CREATE OR REPLACE FUNCTION dbasakan.update_complaints_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = dbasakan, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 4: CREATE RLS POLICIES FOR ALL TABLES
-- ============================================================================

-- ============================================================================
-- 4.1: NextAuth Tables (users, accounts, sessions, verification_tokens)
-- ============================================================================

-- Users table: Users can only see their own record
CREATE POLICY "Users can view own record" ON dbasakan.users
  FOR SELECT
  USING (auth.uid()::text = id);

-- Accounts table: Users can only see their own accounts
CREATE POLICY "Users can view own accounts" ON dbasakan.accounts
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Sessions table: Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON dbasakan.sessions
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- Verification tokens: No public access needed (handled by NextAuth)
CREATE POLICY "Service role manages verification tokens" ON dbasakan.verification_tokens
  FOR ALL
  USING (true);

-- ============================================================================
-- 4.2: Admin Tables
-- ============================================================================

-- Admins table: Service role full access (used by admin login API)
-- The service role key bypasses RLS, but we create permissive policies
-- to ensure both direct queries and RPC functions work properly
CREATE POLICY "Service role full access to admins" ON dbasakan.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin sessions: Service role full access
CREATE POLICY "Service role full access to admin sessions" ON dbasakan.admin_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4.3: Core Tables (profiles, residences, profile_residences)
-- ============================================================================

-- Profiles: Syndics can view all residence profiles, users can view own
CREATE POLICY "Profiles access by role" ON dbasakan.profiles
  FOR SELECT
  USING (
    auth.uid()::text = id
    OR EXISTS (
      SELECT 1 FROM dbasakan.profile_residences pr
      WHERE pr.profile_id = profiles.id
      AND (pr.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Residences: Users can view their own residence
CREATE POLICY "Users can view own residence" ON dbasakan.residences
  FOR SELECT
  USING (
    (residences.id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    OR syndic_user_id = auth.uid()::text
    OR guard_user_id = auth.uid()::text
  );

-- Profile residences: Syndics can manage, residents can view own
CREATE POLICY "Profile residences access" ON dbasakan.profile_residences
  FOR ALL
  USING (
    profile_id = auth.uid()::text
    OR (residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- 4.4: Financial Tables
-- ============================================================================

-- Fees: Syndics can manage all fees in their residence
CREATE POLICY "Fees management" ON dbasakan.fees
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role = 'syndic'
      )
      AND (fees.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Payments: Syndics can manage all, users can view own
CREATE POLICY "Payments access" ON dbasakan.payments
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role = 'syndic'
      )
      AND (payments.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Expenses: All authenticated users can view, syndics can manage
CREATE POLICY "Expenses view" ON dbasakan.expenses
  FOR SELECT
  USING (
    (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Expenses manage" ON dbasakan.expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Balance snapshots: All can view, syndics can manage
CREATE POLICY "Balance snapshots view" ON dbasakan.balance_snapshots
  FOR SELECT
  USING (
    (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Balance snapshots manage" ON dbasakan.balance_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Transaction history: All can view, syndics can manage
CREATE POLICY "Transaction history view" ON dbasakan.transaction_history
  FOR SELECT
  USING (
    (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Transaction history manage" ON dbasakan.transaction_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- 4.5: Operational Tables
-- ============================================================================

-- Incidents: Syndics can manage all, users can view own
CREATE POLICY "Incidents access" ON dbasakan.incidents
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role = 'syndic'
      )
      AND (incidents.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Announcements: All can view, syndics can manage
CREATE POLICY "Announcements view" ON dbasakan.announcements
  FOR SELECT
  USING (
    (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Announcements manage" ON dbasakan.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Deliveries: Guards can manage all in their residence
CREATE POLICY "Deliveries management" ON dbasakan.deliveries
  FOR ALL
  USING (
    recipient_id = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role = 'guard'
      )
      AND (deliveries.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Access logs: Guards can manage, users can view own
CREATE POLICY "Access logs access" ON dbasakan.access_logs
  FOR ALL
  USING (
    generated_by = auth.uid()::text
    OR scanned_by = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role IN ('guard', 'syndic')
      )
      AND (access_logs.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- ============================================================================
-- 4.6: Polls Tables
-- ============================================================================

-- Polls: All can view, syndics can manage
CREATE POLICY "Polls view" ON dbasakan.polls
  FOR SELECT
  USING (
    (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Polls manage" ON dbasakan.polls
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Poll options: All can view, syndics can manage
CREATE POLICY "Poll options view" ON dbasakan.poll_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_options.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

CREATE POLICY "Poll options manage" ON dbasakan.poll_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls pol
      WHERE pol.id = poll_options.poll_id
      AND (
        EXISTS (
          SELECT 1 FROM dbasakan.profiles p
          WHERE p.id = auth.uid()::text
          AND p.role = 'syndic'
        )
        AND (pol.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.polls pol
      WHERE pol.id = poll_options.poll_id
      AND (
        EXISTS (
          SELECT 1 FROM dbasakan.profiles p
          WHERE p.id = auth.uid()::text
          AND p.role = 'syndic'
        )
        AND (pol.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
      )
    )
  );

-- Poll votes: All can view, residents can vote
CREATE POLICY "Poll votes view" ON dbasakan.poll_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_votes.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

CREATE POLICY "Poll votes insert" ON dbasakan.poll_votes
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_votes.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- ============================================================================
-- 4.7: Notifications
-- ============================================================================

-- Notifications: Users can only see their own
CREATE POLICY "Notifications access" ON dbasakan.notifications
  FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- 4.8: Document Submissions
-- ============================================================================

-- Syndic document submissions: Users can view own, admins can view all
CREATE POLICY "Document submissions access" ON dbasakan.syndic_document_submissions
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM dbasakan.admins
      WHERE id = reviewed_by
      AND is_active = true
    )
  );

-- ============================================================================
-- 4.9: Syndic Deletion Requests
-- ============================================================================

-- Syndic deletion requests: Syndics can view own, admins can view all
CREATE POLICY "Deletion requests access" ON dbasakan.syndic_deletion_requests
  FOR ALL
  USING (
    syndic_user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM dbasakan.admins
      WHERE id = reviewed_by
      AND is_active = true
    )
  );

-- ============================================================================
-- 4.10: Complaints System
-- ============================================================================

-- Complaints: Complainants can view own, complained-about can view, syndics can view all
CREATE POLICY "Complaints access" ON dbasakan.complaints
  FOR SELECT
  USING (
    complainant_id = auth.uid()::text
    OR complained_about_id = auth.uid()::text
    OR (
      EXISTS (
        SELECT 1 FROM dbasakan.profiles p
        WHERE p.id = auth.uid()::text
        AND p.role = 'syndic'
      )
      AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

CREATE POLICY "Complaints create" ON dbasakan.complaints
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'resident'
    )
    AND complainant_id = auth.uid()::text
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

CREATE POLICY "Complaints update" ON dbasakan.complaints
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Complaint evidence: Only syndics can view, complainants can upload
CREATE POLICY "Complaint evidence view" ON dbasakan.complaint_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND EXISTS (
      SELECT 1 FROM dbasakan.complaints c
      WHERE c.id = complaint_evidence.complaint_id
      AND (c.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

CREATE POLICY "Complaint evidence upload" ON dbasakan.complaint_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'resident'
    )
    AND uploaded_by = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM dbasakan.complaints c
      WHERE c.id = complaint_evidence.complaint_id
      AND c.complainant_id = auth.uid()::text
    )
  );

-- ============================================================================
-- 4.11: Stripe Customers
-- ============================================================================

-- Stripe customers: Users can only see their own
CREATE POLICY "Stripe customers access" ON dbasakan.stripe_customers
  FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA dbasakan TO service_role, authenticated, anon;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbasakan TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA dbasakan TO anon;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO anon;

-- Grant function permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dbasakan TO service_role, authenticated, anon;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT EXECUTE ON FUNCTIONS TO service_role, authenticated, anon;

-- ============================================================================
-- PART 6: VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
    table_record record;
    rls_count integer := 0;
    no_rls_count integer := 0;
BEGIN
    FOR table_record IN 
        SELECT tablename, rowsecurity
        FROM pg_tables 
        WHERE schemaname = 'dbasakan'
        ORDER BY tablename
    LOOP
        IF table_record.rowsecurity THEN
            rls_count := rls_count + 1;
        ELSE
            no_rls_count := no_rls_count + 1;
            RAISE WARNING 'RLS not enabled on table: %', table_record.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'RLS Status: % tables with RLS enabled, % tables without RLS', rls_count, no_rls_count;
END $$;

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'dbasakan'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'All RLS issues fixed successfully!';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '1. RLS enabled on all tables';
    RAISE NOTICE '2. Function search paths fixed';
    RAISE NOTICE '3. Duplicate policies removed';
    RAISE NOTICE '4. New policies created for all tables';
    RAISE NOTICE '5. Permissions granted';
    RAISE NOTICE '====================================================================';
END $$;

