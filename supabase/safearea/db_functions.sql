-- ============================================================================
-- SAKAN Database Functions - Complete List
-- ============================================================================
-- This file contains all Supabase functions required for the SAKAN SaaS app
-- ============================================================================

-- ============================================================================
-- 0. ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pgcrypto extension for password hashing (crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- 1. RESIDENCE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function: Get user's residence ID based on role
-- Used in: RLS policies, application code
-- Status: ✅ REQUIRED - Already in db_corrected.sql
CREATE OR REPLACE FUNCTION dbasakan.get_user_residence_id(user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role dbasakan.user_role;
  residence_id bigint;
  user_id_text text;
BEGIN
  -- Convert uuid to text for comparison
  user_id_text := user_id::text;
  
  -- Get user role
  SELECT role INTO user_role FROM dbasakan.profiles WHERE id = user_id_text;
  
  IF user_role IS NULL THEN
    RETURN NULL::bigint;
  END IF;
  
  -- Get residence based on role
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

GRANT EXECUTE ON FUNCTION dbasakan.get_user_residence_id(uuid) TO authenticated;

-- ============================================================================
-- 2. ADMIN AUTHENTICATION FUNCTIONS
-- ============================================================================

-- Function: Verify admin password
-- Used in: app/api/admin/auth/login/route.ts
-- Status: ✅ REQUIRED - Used in admin login
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

GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO authenticated;

-- Function: Create admin user
-- Used in: Admin management (if needed)
-- Status: ⚠️ RECOMMENDED - For admin creation
CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
BEGIN
  -- Hash password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Insert admin
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active)
  VALUES (p_email, v_password_hash, p_full_name, true)
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dbasakan.create_admin(text, text, text) TO authenticated;

-- ============================================================================
-- 3. PROFILE MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function: Create profile on user insert (Trigger function)
-- Used in: Automatic profile creation when user signs up
-- Status: ✅ REQUIRED - For automatic profile creation
CREATE OR REPLACE FUNCTION dbasakan.create_profile_on_user_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS trigger_create_profile_on_user_insert ON dbasakan.users;
CREATE TRIGGER trigger_create_profile_on_user_insert
  AFTER INSERT ON dbasakan.users
  FOR EACH ROW
  EXECUTE FUNCTION dbasakan.create_profile_on_user_insert();

-- ============================================================================
-- 4. RESIDENCE STATISTICS FUNCTIONS
-- ============================================================================

-- Function: Get residence statistics
-- Used in: Dashboard, reports
-- Status: ⚠️ RECOMMENDED - For dashboard performance
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

GRANT EXECUTE ON FUNCTION dbasakan.get_residence_stats(bigint) TO authenticated;

-- ============================================================================
-- 5. FINANCIAL FUNCTIONS
-- ============================================================================

-- Function: Calculate residence balance
-- Used in: Financial dashboard, balance snapshots
-- Status: ⚠️ RECOMMENDED - For accurate balance calculations
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
AS $$
DECLARE
  v_cash_balance numeric := 0;
  v_bank_balance numeric := 0;
  v_total_income numeric := 0;
  v_total_expenses numeric := 0;
BEGIN
  -- Get latest balance snapshot
  SELECT cash_balance, bank_balance INTO v_cash_balance, v_bank_balance
  FROM dbasakan.balance_snapshots
  WHERE residence_id = p_residence_id
  ORDER BY snapshot_date DESC
  LIMIT 1;
  
  -- Calculate total income (verified payments)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_income
  FROM dbasakan.payments
  WHERE residence_id = p_residence_id
    AND status = 'verified';
  
  -- Calculate total expenses
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

GRANT EXECUTE ON FUNCTION dbasakan.calculate_residence_balance(bigint) TO authenticated;

-- ============================================================================
-- 6. NOTIFICATION FUNCTIONS
-- ============================================================================

-- Function: Create notification
-- Used in: Notification system
-- Status: ⚠️ RECOMMENDED - For centralized notification creation
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

GRANT EXECUTE ON FUNCTION dbasakan.create_notification(text, dbasakan.notification_type, text, text, bigint, jsonb) TO authenticated;

-- Function: Mark notification as read
-- Used in: Notification management
-- Status: ⚠️ RECOMMENDED - For notification updates
CREATE OR REPLACE FUNCTION dbasakan.mark_notification_read(p_notification_id bigint, p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION dbasakan.mark_notification_read(bigint, text) TO authenticated;

-- ============================================================================
-- 7. ACCESS CODE FUNCTIONS (If using access codes)
-- ============================================================================

-- Note: These functions are only needed if you're using the access_codes table
-- Status: ⚠️ OPTIONAL - Only if access codes are used

-- Function: Create access code
-- CREATE OR REPLACE FUNCTION dbasakan.create_access_code(
--   p_code text,
--   p_original_user_id text,
--   p_replacement_email text,
--   p_residence_id bigint,
--   p_action_type text,
--   p_expires_at timestamp with time zone
-- )
-- RETURNS bigint
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- DECLARE
--   v_access_code_id bigint;
-- BEGIN
--   INSERT INTO dbasakan.access_codes (
--     code,
--     original_user_id,
--     replacement_email,
--     residence_id,
--     action_type,
--     expires_at
--   )
--   VALUES (
--     p_code,
--     p_original_user_id,
--     p_replacement_email,
--     p_residence_id,
--     p_action_type,
--     p_expires_at
--   )
--   RETURNING id INTO v_access_code_id;
--   
--   RETURN v_access_code_id;
-- END;
-- $$;

-- ============================================================================
-- 8. UTILITY FUNCTIONS
-- ============================================================================

-- Function: Check if user can access residence
-- Used in: Authorization checks
-- Status: ⚠️ RECOMMENDED - For authorization validation
CREATE OR REPLACE FUNCTION dbasakan.user_can_access_residence(p_user_id text, p_residence_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_role dbasakan.user_role;
  v_user_residence_id bigint;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role FROM dbasakan.profiles WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check based on role
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

GRANT EXECUTE ON FUNCTION dbasakan.user_can_access_residence(text, bigint) TO authenticated;

-- ============================================================================
-- 9. STRIPE/BILLING FUNCTIONS (If using Stripe)
-- ============================================================================

-- Function: Calculate days remaining from plan
-- Used in: Stripe subscription management
-- Status: ⚠️ OPTIONAL - Only if using Stripe subscriptions
-- CREATE OR REPLACE FUNCTION dbasakan.calculate_days_remaining(expires_timestamp bigint)
-- RETURNS integer
-- LANGUAGE plpgsql
-- STABLE
-- AS $$
-- DECLARE
--   v_expires_date timestamp with time zone;
--   v_days_remaining integer;
-- BEGIN
--   IF expires_timestamp IS NULL THEN
--     RETURN NULL;
--   END IF;
--   
--   -- Convert milliseconds to timestamp
--   v_expires_date := to_timestamp(expires_timestamp / 1000);
--   
--   -- Calculate days remaining
--   v_days_remaining := EXTRACT(EPOCH FROM (v_expires_date - NOW())) / 86400;
--   
--   RETURN GREATEST(0, v_days_remaining::integer);
-- END;
-- $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- REQUIRED FUNCTIONS (Must create):
-- 1. ✅ get_user_residence_id - Used in RLS policies
-- 2. ✅ verify_admin_password - Used in admin login
-- 3. ✅ create_profile_on_user_insert - Auto-creates profiles
--
-- RECOMMENDED FUNCTIONS (Should create):
-- 4. ⚠️ get_residence_stats - Dashboard performance
-- 5. ⚠️ calculate_residence_balance - Financial calculations
-- 6. ⚠️ create_notification - Notification system
-- 7. ⚠️ mark_notification_read - Notification management
-- 8. ⚠️ user_can_access_residence - Authorization checks
-- 9. ⚠️ create_admin - Admin management
--
-- OPTIONAL FUNCTIONS (Only if needed):
-- - Access code functions (if using access_codes table)
-- - Stripe functions (if using Stripe subscriptions)
-- ============================================================================

