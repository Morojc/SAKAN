-- ============================================================================
-- SAKAN Database Schema - Corrected Version
-- ============================================================================
-- This schema implements the new user-residence relationship model:
-- - Syndics: 1:1 with Residence via residences.syndic_user_id
-- - Guards: 1:1 with Residence via residences.guard_user_id  
-- - Residents: M:N with Residence via profile_residences junction table
-- - Profiles table: NO residence_id column
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create enums if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.user_role AS ENUM ('syndic', 'guard', 'resident', 'admin');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.incident_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.notification_type AS ENUM ('info', 'warning', 'error', 'success');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.notification_status AS ENUM ('unread', 'read');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.payment_method AS ENUM ('cash', 'bank_transfer', 'check', 'card');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.payment_status AS ENUM ('pending', 'verified', 'rejected');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_submission_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
        CREATE TYPE dbasakan.document_submission_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (NextAuth)
CREATE TABLE IF NOT EXISTS dbasakan.users (
  id text NOT NULL,
  name text,
  email text UNIQUE,
  "emailVerified" timestamp with time zone,
  image text,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Profiles table (NO residence_id - uses new schema)
CREATE TABLE IF NOT EXISTS dbasakan.profiles (
  id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  full_name text NOT NULL,
  phone_number text,
  role dbasakan.user_role NOT NULL DEFAULT 'resident'::dbasakan.user_role,
  onboarding_completed boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  verification_token text UNIQUE,
  verification_token_expires_at timestamp with time zone,
  email_verification_code text UNIQUE,
  email_verification_code_expires_at timestamp with time zone,
  email_verified boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES dbasakan.users(id)
);

-- Residences table (with syndic_user_id and guard_user_id)
CREATE TABLE IF NOT EXISTS dbasakan.residences (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  bank_account_rib text,
  syndic_user_id text,
  guard_user_id text,
  CONSTRAINT residences_pkey PRIMARY KEY (id),
  CONSTRAINT residences_syndic_user_id_fkey FOREIGN KEY (syndic_user_id) REFERENCES dbasakan.users(id),
  CONSTRAINT residences_guard_user_id_fkey FOREIGN KEY (guard_user_id) REFERENCES dbasakan.users(id)
);

-- Profile-Residences junction table (M:N for residents)
CREATE TABLE IF NOT EXISTS dbasakan.profile_residences (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  profile_id text NOT NULL,
  residence_id bigint NOT NULL,
  apartment_number text,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_residences_pkey PRIMARY KEY (id),
  CONSTRAINT profile_residences_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT profile_residences_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT profile_residences_unique UNIQUE (profile_id, residence_id)
);

-- ============================================================================
-- ADMIN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.admins (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  access_hash text NOT NULL UNIQUE,
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dbasakan.admin_sessions (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  admin_id text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_sessions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES dbasakan.admins(id)
);

-- ============================================================================
-- DOCUMENT SUBMISSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.syndic_document_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  document_url text NOT NULL,
  id_card_url text,
  status dbasakan.document_submission_status NOT NULL DEFAULT 'pending'::dbasakan.document_submission_status,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by text,
  rejection_reason text,
  assigned_residence_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT syndic_document_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT syndic_document_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT syndic_document_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.admins(id),
  CONSTRAINT syndic_document_submissions_assigned_residence_id_fkey FOREIGN KEY (assigned_residence_id) REFERENCES dbasakan.residences(id)
);

-- ============================================================================
-- FINANCIAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.fees (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'unpaid'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fees_pkey PRIMARY KEY (id),
  CONSTRAINT fees_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT fees_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.payments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  fee_id bigint,
  amount numeric NOT NULL,
  method dbasakan.payment_method NOT NULL,
  status dbasakan.payment_status NOT NULL DEFAULT 'pending'::dbasakan.payment_status,
  proof_url text,
  paid_at timestamp with time zone DEFAULT now(),
  verified_by text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT payments_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES dbasakan.fees(id),
  CONSTRAINT payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  attachment_url text,
  expense_date date NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.balance_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  snapshot_date date NOT NULL,
  cash_balance numeric NOT NULL DEFAULT 0,
  bank_balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT balance_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT balance_snapshots_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT balance_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.transaction_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  transaction_type text NOT NULL,
  reference_id bigint,
  reference_table text,
  amount numeric NOT NULL,
  balance_after numeric,
  method text,
  description text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transaction_history_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_history_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT transaction_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);

-- ============================================================================
-- OPERATIONAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.incidents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  photo_url text,
  status dbasakan.incident_status NOT NULL DEFAULT 'open'::dbasakan.incident_status,
  assigned_to text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.announcements (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  attachment_url text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  recipient_id text NOT NULL,
  logged_by text NOT NULL,
  description text NOT NULL,
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT deliveries_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.access_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  generated_by text NOT NULL,
  visitor_name text NOT NULL,
  qr_code_data text NOT NULL,
  valid_from timestamp with time zone NOT NULL,
  valid_to timestamp with time zone NOT NULL,
  scanned_at timestamp with time zone,
  scanned_by text,
  CONSTRAINT access_logs_pkey PRIMARY KEY (id),
  CONSTRAINT access_logs_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT access_logs_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT access_logs_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);

-- ============================================================================
-- POLLS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.polls (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  question text NOT NULL,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT polls_pkey PRIMARY KEY (id),
  CONSTRAINT polls_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.poll_options (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  poll_id bigint NOT NULL,
  option_text text NOT NULL,
  CONSTRAINT poll_options_pkey PRIMARY KEY (id),
  CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES dbasakan.polls(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.poll_votes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  poll_id bigint NOT NULL,
  option_id bigint NOT NULL,
  user_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES dbasakan.polls(id),
  CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES dbasakan.poll_options(id),
  CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  type dbasakan.notification_type NOT NULL,
  status dbasakan.notification_status NOT NULL DEFAULT 'unread'::dbasakan.notification_status,
  title text NOT NULL,
  message text NOT NULL,
  action_data jsonb DEFAULT '{}'::jsonb,
  residence_id bigint,
  access_code_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT notifications_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);

-- ============================================================================
-- NEXT AUTH TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "userId" text NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_userid_fkey FOREIGN KEY ("userId") REFERENCES dbasakan.users(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  "sessionToken" text NOT NULL UNIQUE,
  "userId" text NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_userid_fkey FOREIGN KEY ("userId") REFERENCES dbasakan.users(id)
);

CREATE TABLE IF NOT EXISTS dbasakan.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL UNIQUE,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token)
);

-- ============================================================================
-- STRIPE INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.stripe_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  stripe_customer_id text NOT NULL UNIQUE,
  subscription_id text,
  plan_active boolean NOT NULL DEFAULT false,
  plan_expires bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  plan_name text,
  price_id text,
  amount numeric,
  currency text DEFAULT 'usd'::text,
  interval text,
  subscription_status text,
  days_remaining integer,
  CONSTRAINT stripe_customers_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.users(id)
);

-- ============================================================================
-- SCHEMA MIGRATIONS (Idempotent)
-- ============================================================================

-- Ensure new columns exist in residences table
ALTER TABLE dbasakan.residences ADD COLUMN IF NOT EXISTS syndic_user_id text;
ALTER TABLE dbasakan.residences ADD COLUMN IF NOT EXISTS guard_user_id text;

-- Clean up duplicate assignments (keep most recent)
DO $$
BEGIN
    -- For syndics: Keep only the most recently created residence per syndic
    UPDATE dbasakan.residences r1
    SET syndic_user_id = NULL
    WHERE syndic_user_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM dbasakan.residences r2
        WHERE r2.syndic_user_id = r1.syndic_user_id
        AND r2.created_at > r1.created_at
        AND r2.id != r1.id
    );
    
    -- For guards: Keep only the most recently created residence per guard
    UPDATE dbasakan.residences r1
    SET guard_user_id = NULL
    WHERE guard_user_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM dbasakan.residences r2
        WHERE r2.guard_user_id = r1.guard_user_id
        AND r2.created_at > r1.created_at
        AND r2.id != r1.id
    );
END $$;

-- Add unique constraints safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residences_syndic_user_id_key') THEN
        ALTER TABLE dbasakan.residences ADD CONSTRAINT residences_syndic_user_id_key UNIQUE (syndic_user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residences_guard_user_id_key') THEN
        ALTER TABLE dbasakan.residences ADD CONSTRAINT residences_guard_user_id_key UNIQUE (guard_user_id);
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residences_syndic_user_id_fkey') THEN
        ALTER TABLE dbasakan.residences ADD CONSTRAINT residences_syndic_user_id_fkey FOREIGN KEY (syndic_user_id) REFERENCES dbasakan.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residences_guard_user_id_fkey') THEN
        ALTER TABLE dbasakan.residences ADD CONSTRAINT residences_guard_user_id_fkey FOREIGN KEY (guard_user_id) REFERENCES dbasakan.users(id);
    END IF;
END $$;

-- Remove residence_id from profiles if exists (will be handled by RLS policy migration)
-- Note: This should be done AFTER dropping RLS policies that depend on it

-- ============================================================================
-- HELPER FUNCTION FOR RLS POLICIES
-- ============================================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION dbasakan.get_user_residence_id(uuid) TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (Corrected with proper type casting)
-- ============================================================================

-- Note: These policies assume RLS is enabled on tables
-- Enable RLS: ALTER TABLE dbasakan.table_name ENABLE ROW LEVEL SECURITY;

-- Fees policies
DROP POLICY IF EXISTS "Syndics can manage residence fees" ON dbasakan.fees;
CREATE POLICY "Syndics can manage residence fees" ON dbasakan.fees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (fees.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Payments policies
DROP POLICY IF EXISTS "Syndics can manage all payments in residence" ON dbasakan.payments;
CREATE POLICY "Syndics can manage all payments in residence" ON dbasakan.payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (payments.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Expenses policies
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON dbasakan.expenses;
CREATE POLICY "Authenticated users can view expenses" ON dbasakan.expenses
  FOR SELECT
  USING (
    (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can manage expenses" ON dbasakan.expenses;
CREATE POLICY "Syndics can manage expenses" ON dbasakan.expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Incidents policies
DROP POLICY IF EXISTS "Syndics can manage all incidents" ON dbasakan.incidents;
CREATE POLICY "Syndics can manage all incidents" ON dbasakan.incidents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (incidents.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Announcements policies
DROP POLICY IF EXISTS "Residents can view announcements" ON dbasakan.announcements;
CREATE POLICY "Residents can view announcements" ON dbasakan.announcements
  FOR SELECT
  USING (
    (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can manage announcements" ON dbasakan.announcements;
CREATE POLICY "Syndics can manage announcements" ON dbasakan.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Polls policies
DROP POLICY IF EXISTS "Residents can view polls" ON dbasakan.polls;
CREATE POLICY "Residents can view polls" ON dbasakan.polls
  FOR SELECT
  USING (
    (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can manage polls" ON dbasakan.polls;
CREATE POLICY "Syndics can manage polls" ON dbasakan.polls
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Poll options policies
DROP POLICY IF EXISTS "Users can view poll options" ON dbasakan.poll_options;
CREATE POLICY "Users can view poll options" ON dbasakan.poll_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_options.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

DROP POLICY IF EXISTS "Syndics can manage poll options" ON dbasakan.poll_options;
CREATE POLICY "Syndics can manage poll options" ON dbasakan.poll_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls pol
      WHERE pol.id = poll_options.poll_id
      AND (pol.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Poll votes policies
DROP POLICY IF EXISTS "Users can view votes" ON dbasakan.poll_votes;
CREATE POLICY "Users can view votes" ON dbasakan.poll_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_votes.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

-- Deliveries policies
DROP POLICY IF EXISTS "Guards can manage deliveries" ON dbasakan.deliveries;
CREATE POLICY "Guards can manage deliveries" ON dbasakan.deliveries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'guard'
    )
    AND (deliveries.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Transaction history policies
DROP POLICY IF EXISTS "Residents can view residence transactions" ON dbasakan.transaction_history;
CREATE POLICY "Residents can view residence transactions" ON dbasakan.transaction_history
  FOR SELECT
  USING (
    (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can manage residence transactions" ON dbasakan.transaction_history;
CREATE POLICY "Syndics can manage residence transactions" ON dbasakan.transaction_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Balance snapshots policies
DROP POLICY IF EXISTS "Residents can view residence balances" ON dbasakan.balance_snapshots;
CREATE POLICY "Residents can view residence balances" ON dbasakan.balance_snapshots
  FOR SELECT
  USING (
    (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can manage residence balances" ON dbasakan.balance_snapshots;
CREATE POLICY "Syndics can manage residence balances" ON dbasakan.balance_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Profiles policies
DROP POLICY IF EXISTS "Syndics can view all residence profiles" ON dbasakan.profiles;
CREATE POLICY "Syndics can view all residence profiles" ON dbasakan.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profile_residences pr
      WHERE pr.profile_id = profiles.id
      AND (pr.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
    OR auth.uid()::text = profiles.id
  );

-- Profile residences policies
DROP POLICY IF EXISTS "Syndics can view profile_residences for their residence" ON dbasakan.profile_residences;
CREATE POLICY "Syndics can view profile_residences for their residence" ON dbasakan.profile_residences
  FOR SELECT
  USING (
    (profile_residences.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    OR profile_residences.profile_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Syndics can insert profile_residences for their residence" ON dbasakan.profile_residences;
CREATE POLICY "Syndics can insert profile_residences for their residence" ON dbasakan.profile_residences
  FOR INSERT
  WITH CHECK (
    (profile_residences.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can update profile_residences for their residence" ON dbasakan.profile_residences;
CREATE POLICY "Syndics can update profile_residences for their residence" ON dbasakan.profile_residences
  FOR UPDATE
  USING (
    (profile_residences.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Syndics can delete profile_residences for their residence" ON dbasakan.profile_residences;
CREATE POLICY "Syndics can delete profile_residences for their residence" ON dbasakan.profile_residences
  FOR DELETE
  USING (
    (profile_residences.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- FINAL CLEANUP: Remove residence_id from profiles (after policies are updated)
-- ============================================================================

-- This must be done LAST, after all RLS policies are recreated
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'profiles' 
        AND column_name = 'residence_id'
    ) THEN
        -- Drop dependent policies first (already done above, but just in case)
        -- Then drop the column
        ALTER TABLE dbasakan.profiles DROP COLUMN IF EXISTS residence_id;
    END IF;
END $$;

-- ============================================================================
-- FIX COLUMN TYPES: Convert any text residence_id columns to bigint
-- ============================================================================

-- This handles cases where residence_id might have been created as text
DO $$
DECLARE
    col_info record;
    sql_cmd text;
BEGIN
    FOR col_info IN 
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'dbasakan'
        AND column_name = 'residence_id'
        AND data_type = 'text'
    LOOP
        -- Convert text to bigint (only if all values are numeric)
        sql_cmd := format('
            ALTER TABLE dbasakan.%I 
            ALTER COLUMN %I TYPE bigint USING %I::bigint',
            col_info.table_name, 
            col_info.column_name,
            col_info.column_name
        );
        
        BEGIN
            EXECUTE sql_cmd;
            RAISE NOTICE 'Converted residence_id from text to bigint in table %', col_info.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not convert residence_id in table %: %', col_info.table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_residences_syndic_user_id ON dbasakan.residences(syndic_user_id);
CREATE INDEX IF NOT EXISTS idx_residences_guard_user_id ON dbasakan.residences(guard_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_residences_profile_id ON dbasakan.profile_residences(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_residences_residence_id ON dbasakan.profile_residences(residence_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON dbasakan.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON dbasakan.profiles(verified);

-- ============================================================================
-- SCHEMA PERMISSIONS (Required for NextAuth Adapter)
-- ============================================================================

-- Grant usage on schema to service_role (required for Supabase service role)
GRANT USAGE ON SCHEMA dbasakan TO service_role;
GRANT USAGE ON SCHEMA dbasakan TO authenticated;
GRANT USAGE ON SCHEMA dbasakan TO anon;

-- Grant all privileges on all tables in dbasakan schema to service_role
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA dbasakan TO service_role;

-- Grant privileges to authenticated and anon roles (for RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbasakan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbasakan TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO anon;

-- Set default privileges for future tables (so new tables automatically get permissions)
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA dbasakan GRANT USAGE, SELECT ON SEQUENCES TO anon;

-- Ensure the schema is in the search path (helps with table resolution)
ALTER DATABASE postgres SET search_path TO public, dbasakan;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Database schema migration completed successfully!';
    RAISE NOTICE 'New schema: Syndics/Guards linked via residences table, Residents via profile_residences';
    RAISE NOTICE 'All RLS policies updated to use new schema with proper type casting';
    RAISE NOTICE 'Schema permissions granted to service_role, authenticated, and anon';
END $$;

