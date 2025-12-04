-- ============================================================================
-- SAKAN Database Schema - Complete Version
-- ============================================================================
-- This is a comprehensive SQL script containing:
-- - All ENUM types
-- - All TABLES (with idempotent creation)
-- - All FUNCTIONS (required and recommended)
-- - All TRIGGERS
-- - All RLS POLICIES
-- - All INDEXES
-- - All PERMISSIONS
-- - All MIGRATIONS and CLEANUP steps
-- ============================================================================
-- Schema Model:
-- - Syndics: 1:1 with Residence via residences.syndic_user_id
-- - Guards: 1:1 with Residence via residences.guard_user_id  
-- - Residents: M:N with Residence via profile_residences junction table
-- - Profiles table: NO residence_id column
-- ============================================================================
-- 
-- INTEGRATED MIGRATIONS:
-- ============================================================================
-- 1. 20251125000000_separate_admin_system.sql
--    - Independent admin system (not linked to users table)
--    - Admin authentication sessions
--    - Admin password verification functions
-- ============================================================================
-- 2. 20251204000000_add_otp_verification_indexes.sql
--    - Indexes for email verification status
--    - Indexes for profile_residences verification status
--    - Performance optimization for OTP queries
-- ============================================================================
-- 3. 20251205000000_allow_multiple_apartments_per_residence.sql
--    - Updated profile_residences unique constraint to include apartment_number
--    - Allows same user in same residence multiple times (different apartments)
--    - Partial unique index for NULL apartment numbers
-- ============================================================================
-- 4. 20251205000001_prevent_duplicate_apartment_assignments.sql
--    - Unique index on (residence_id, apartment_number)
--    - Prevents multiple users from sharing the same apartment
-- ============================================================================
-- 5. 20251206000000_separate_resident_onboarding_otp.sql
--    - Separate OTP fields for resident onboarding
--    - resident_onboarding_code and resident_onboarding_code_expires_at
--    - Prevents conflicts with email verification OTP
-- ============================================================================

-- ============================================================================
-- 0. ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pgcrypto extension for password hashing (crypt, gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ============================================================================
-- 1. CREATE SCHEMA (if not exists)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS dbasakan;

-- ============================================================================
-- 2. ENUMS
-- ============================================================================

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
-- 3. CORE TABLES
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
  resident_onboarding_code text,
  resident_onboarding_code_expires_at timestamp with time zone,
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
-- Migration: 20251205000000_allow_multiple_apartments_per_residence.sql
-- Description: Allows same user in same residence multiple times, but only once per apartment number
--              Each apartment number can only be assigned to one user per residence
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
  CONSTRAINT profile_residences_unique UNIQUE (profile_id, residence_id, apartment_number)
);

COMMENT ON CONSTRAINT profile_residences_unique ON dbasakan.profile_residences IS 
  'Allows same user to be in same residence multiple times, but only once per apartment number. Multiple entries with NULL apartment_number are prevented by idx_profile_residences_null_apartment.';

-- Partial unique index for NULL apartment numbers (only one NULL per user-residence)
-- Migration: 20251205000000_allow_multiple_apartments_per_residence.sql
-- This ensures guards or users without apartment numbers can only be added once per residence
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_residences_null_apartment 
ON dbasakan.profile_residences(profile_id, residence_id) 
WHERE apartment_number IS NULL;

-- Unique index to ensure each apartment number can only be assigned to one user per residence
-- Migration: 20251205000001_prevent_duplicate_apartment_assignments.sql
-- This prevents multiple users from being assigned to the same apartment
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_residences_residence_apartment_unique 
ON dbasakan.profile_residences(residence_id, apartment_number) 
WHERE apartment_number IS NOT NULL;

-- ============================================================================
-- 4. ADMIN TABLES
-- ============================================================================
-- Migration: 20251125000000_separate_admin_system.sql
-- Description: Independent admin system not linked to users table
--              Admins have their own authentication and access
-- ============================================================================

-- Independent admins table (not linked to regular users table)
CREATE TABLE IF NOT EXISTS dbasakan.admins (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);

-- Add comments for documentation
COMMENT ON TABLE dbasakan.admins IS 'Independent admin users - not linked to regular users table';
COMMENT ON COLUMN dbasakan.admins.id IS 'Unique admin ID (UUID)';
COMMENT ON COLUMN dbasakan.admins.email IS 'Admin email for login';
COMMENT ON COLUMN dbasakan.admins.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN dbasakan.admins.full_name IS 'Full name of the administrator';
COMMENT ON COLUMN dbasakan.admins.is_active IS 'Allows deactivating admin accounts';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON dbasakan.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON dbasakan.admins(is_active);

-- Admin sessions table (stores admin authentication sessions separately from NextAuth sessions)
CREATE TABLE IF NOT EXISTS dbasakan.admin_sessions (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  admin_id text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_sessions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES dbasakan.admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON dbasakan.admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON dbasakan.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON dbasakan.admin_sessions(expires_at);

COMMENT ON TABLE dbasakan.admin_sessions IS 'Admin authentication sessions - separate from user sessions';

-- ============================================================================
-- 5. DOCUMENT SUBMISSIONS
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
-- 6. FINANCIAL TABLES
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
-- 7. OPERATIONAL TABLES
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
-- 8. POLLS TABLES
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
-- 9. NOTIFICATIONS
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
-- 10. NEXT AUTH TABLES
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
-- 11. STRIPE INTEGRATION
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
-- 12. SCHEMA MIGRATIONS (Idempotent)
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

-- Remove residence_id from profiles if exists (after policies are updated)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'profiles' 
        AND column_name = 'residence_id'
    ) THEN
        ALTER TABLE dbasakan.profiles DROP COLUMN IF EXISTS residence_id;
    END IF;
END $$;

-- Fix column types: Convert any text residence_id columns to bigint
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
-- 13. FUNCTIONS
-- ============================================================================

-- Function: Get user's residence ID based on role (REQUIRED)
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

-- Function: Verify admin password (REQUIRED)
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

GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION dbasakan.verify_admin_password(text, text) TO service_role;

-- Function: Create admin user (RECOMMENDED)
-- Migration: 20251125000000_separate_admin_system.sql
-- Description: Creates admin with hashed password (no access_hash)
CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dbasakan, extensions, pg_temp
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
BEGIN
  -- Hash password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Insert admin
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active, created_at)
  VALUES (p_email, v_password_hash, p_full_name, true, NOW())
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dbasakan.create_admin(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION dbasakan.create_admin(text, text, text) TO service_role;

-- Function: Generate admin access hash
CREATE OR REPLACE FUNCTION dbasakan.generate_admin_hash()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
END;
$$;

-- Function: Create profile on user insert (REQUIRED - Trigger function)
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

-- Function: Get residence statistics (RECOMMENDED)
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

-- Function: Calculate residence balance (RECOMMENDED)
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

-- Function: Create notification (RECOMMENDED)
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

-- Function: Mark notification as read (RECOMMENDED)
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

-- Function: Check if user can access residence (RECOMMENDED)
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
-- 14. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables (idempotent)
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'dbasakan'
    LOOP
        EXECUTE format('ALTER TABLE dbasakan.%I ENABLE ROW LEVEL SECURITY', table_name);
    END LOOP;
END $$;

-- ============================================================================
-- Admin Tables RLS Policies
-- ============================================================================

-- Admins table: Service role full access (used by admin login API)
-- The service role key bypasses RLS, but we create permissive policies
-- to ensure both direct queries and RPC functions work properly
DROP POLICY IF EXISTS "Service role full access to admins" ON dbasakan.admins;
CREATE POLICY "Service role full access to admins" ON dbasakan.admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin sessions: Service role full access
DROP POLICY IF EXISTS "Service role full access to admin sessions" ON dbasakan.admin_sessions;
CREATE POLICY "Service role full access to admin sessions" ON dbasakan.admin_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Core Tables (profiles, residences, profile_residences)
-- ============================================================================

-- Profiles: Syndics can view all residence profiles, users can view own
DROP POLICY IF EXISTS "Profiles access by role" ON dbasakan.profiles;
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
DROP POLICY IF EXISTS "Users can view own residence" ON dbasakan.residences;
CREATE POLICY "Users can view own residence" ON dbasakan.residences
  FOR SELECT
  USING (
    (residences.id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    OR syndic_user_id = auth.uid()::text
    OR guard_user_id = auth.uid()::text
  );

-- Profile residences: Syndics can manage, residents can view own
DROP POLICY IF EXISTS "Profile residences access" ON dbasakan.profile_residences;
CREATE POLICY "Profile residences access" ON dbasakan.profile_residences
  FOR ALL
  USING (
    profile_id = auth.uid()::text
    OR (residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- Financial Tables
-- ============================================================================

-- Fees: Syndics can manage all fees in their residence, users can view own
DROP POLICY IF EXISTS "Fees management" ON dbasakan.fees;
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
DROP POLICY IF EXISTS "Payments access" ON dbasakan.payments;
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
DROP POLICY IF EXISTS "Expenses view" ON dbasakan.expenses;
CREATE POLICY "Expenses view" ON dbasakan.expenses
  FOR SELECT
  USING (
    (expenses.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Expenses manage" ON dbasakan.expenses;
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

-- Incidents: Syndics can manage all, users can view own
DROP POLICY IF EXISTS "Incidents access" ON dbasakan.incidents;
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
DROP POLICY IF EXISTS "Announcements view" ON dbasakan.announcements;
CREATE POLICY "Announcements view" ON dbasakan.announcements
  FOR SELECT
  USING (
    (announcements.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Announcements manage" ON dbasakan.announcements;
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

-- Polls: All can view, syndics can manage
DROP POLICY IF EXISTS "Polls view" ON dbasakan.polls;
CREATE POLICY "Polls view" ON dbasakan.polls
  FOR SELECT
  USING (
    (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Polls manage" ON dbasakan.polls;
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
DROP POLICY IF EXISTS "Poll options view" ON dbasakan.poll_options;
CREATE POLICY "Poll options view" ON dbasakan.poll_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_options.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

DROP POLICY IF EXISTS "Poll options manage" ON dbasakan.poll_options;
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
DROP POLICY IF EXISTS "Poll votes view" ON dbasakan.poll_votes;
CREATE POLICY "Poll votes view" ON dbasakan.poll_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.polls
      WHERE polls.id = poll_votes.poll_id
      AND (polls.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
    )
  );

DROP POLICY IF EXISTS "Poll votes insert" ON dbasakan.poll_votes;
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

-- Deliveries: Guards can manage all in their residence, recipients can view own
DROP POLICY IF EXISTS "Deliveries management" ON dbasakan.deliveries;
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
DROP POLICY IF EXISTS "Access logs access" ON dbasakan.access_logs;
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

-- Transaction history: All can view, syndics can manage
DROP POLICY IF EXISTS "Transaction history view" ON dbasakan.transaction_history;
CREATE POLICY "Transaction history view" ON dbasakan.transaction_history
  FOR SELECT
  USING (
    (transaction_history.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Transaction history manage" ON dbasakan.transaction_history;
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

-- Balance snapshots: All can view, syndics can manage
DROP POLICY IF EXISTS "Balance snapshots view" ON dbasakan.balance_snapshots;
CREATE POLICY "Balance snapshots view" ON dbasakan.balance_snapshots
  FOR SELECT
  USING (
    (balance_snapshots.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

DROP POLICY IF EXISTS "Balance snapshots manage" ON dbasakan.balance_snapshots;
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

-- Notifications: Users can only see their own
DROP POLICY IF EXISTS "Notifications access" ON dbasakan.notifications;
CREATE POLICY "Notifications access" ON dbasakan.notifications
  FOR ALL
  USING (user_id = auth.uid()::text);

-- Syndic document submissions: Users can view own, admins can view all
DROP POLICY IF EXISTS "Document submissions access" ON dbasakan.syndic_document_submissions;
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

-- Syndic deletion requests: Syndics can view own, admins can view all
DROP POLICY IF EXISTS "Deletion requests access" ON dbasakan.syndic_deletion_requests;
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

-- Complaints: Complainants can view own, complained-about can view, syndics can view all
DROP POLICY IF EXISTS "Complaints access" ON dbasakan.complaints;
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

DROP POLICY IF EXISTS "Complaints create" ON dbasakan.complaints;
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

DROP POLICY IF EXISTS "Complaints update" ON dbasakan.complaints;
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
DROP POLICY IF EXISTS "Complaint evidence view" ON dbasakan.complaint_evidence;
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

DROP POLICY IF EXISTS "Complaint evidence upload" ON dbasakan.complaint_evidence;
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

-- Stripe customers: Users can only see their own
DROP POLICY IF EXISTS "Stripe customers access" ON dbasakan.stripe_customers;
CREATE POLICY "Stripe customers access" ON dbasakan.stripe_customers
  FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- 15. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_residences_syndic_user_id ON dbasakan.residences(syndic_user_id);
CREATE INDEX IF NOT EXISTS idx_residences_guard_user_id ON dbasakan.residences(guard_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_residences_profile_id ON dbasakan.profile_residences(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_residences_residence_id ON dbasakan.profile_residences(residence_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON dbasakan.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON dbasakan.profiles(verified);
CREATE INDEX IF NOT EXISTS idx_fees_residence_id ON dbasakan.fees(residence_id);
CREATE INDEX IF NOT EXISTS idx_fees_user_id ON dbasakan.fees(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_residence_id ON dbasakan.payments(residence_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON dbasakan.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON dbasakan.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_residence_id ON dbasakan.notifications(residence_id);

-- ============================================================================
-- 15.1. OTP VERIFICATION INDEXES
-- Migration: 20251204000000_add_otp_verification_indexes.sql
-- Description: Indexes for OTP verification system to improve query performance
-- ============================================================================

-- Index for email_verified status filtering (used to filter verified/unverified residents)
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified 
  ON dbasakan.profiles(email_verified) 
  WHERE email_verified = false;

-- Index for email_verification_code_expires_at (used to check expiration)
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_code_expires_at 
  ON dbasakan.profiles(email_verification_code_expires_at) 
  WHERE email_verification_code_expires_at IS NOT NULL;

-- Index for profile_residences.verified status filtering
-- This is used to filter verified/unverified residents in the residents list
CREATE INDEX IF NOT EXISTS idx_profile_residences_verified 
  ON dbasakan.profile_residences(verified) 
  WHERE verified = false;

-- Composite index for residence_id and verified (common query pattern)
-- Used when fetching residents for a specific residence filtered by verification status
CREATE INDEX IF NOT EXISTS idx_profile_residences_residence_id_verified 
  ON dbasakan.profile_residences(residence_id, verified);

COMMENT ON INDEX dbasakan.idx_profiles_email_verified IS 
  'Index for filtering verified/unverified users by email verification status';

COMMENT ON INDEX dbasakan.idx_profiles_email_verification_code_expires_at IS 
  'Index for checking OTP code expiration timestamps';

COMMENT ON INDEX dbasakan.idx_profile_residences_verified IS 
  'Index for filtering verified/unverified residents in residence listings';

COMMENT ON INDEX dbasakan.idx_profile_residences_residence_id_verified IS 
  'Composite index for efficient queries filtering residents by residence and verification status';

-- ============================================================================
-- 16. SCHEMA PERMISSIONS (Required for NextAuth Adapter)
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
-- 17. COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Database schema setup completed successfully!';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Schema: dbasakan';
    RAISE NOTICE 'New relationship model:';
    RAISE NOTICE '  - Syndics: 1:1 with Residence via residences.syndic_user_id';
    RAISE NOTICE '  - Guards: 1:1 with Residence via residences.guard_user_id';
    RAISE NOTICE '  - Residents: M:N with Residence via profile_residences';
    RAISE NOTICE '  - Profiles table: NO residence_id column';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'All tables, functions, triggers, RLS policies, and permissions created';
    RAISE NOTICE 'All migrations and cleanup steps completed';
    RAISE NOTICE '====================================================================';
END $$;



-- ============================================================================
-- ADD SYNDIC DELETION REQUESTS SYSTEM
-- Migration: 20250101000000_add_syndic_deletion_requests.sql
-- Description: Adds deletion request workflow for syndic account deletion
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ENUMS
-- ============================================================================

DO $$ 
BEGIN
  -- Deletion Request Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deletion_request_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.deletion_request_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
  END IF;
END $$;

-- ============================================================================
-- PART 2: CREATE SYNDIC DELETION REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.syndic_deletion_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  syndic_user_id text NOT NULL,
  residence_id bigint NOT NULL,
  status dbasakan.deletion_request_status NOT NULL DEFAULT 'pending'::dbasakan.deletion_request_status,
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by text, -- Admin ID who reviewed the request
  successor_user_id text, -- The resident selected by admin to become the new syndic
  rejection_reason text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT syndic_deletion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT syndic_deletion_requests_syndic_user_id_fkey FOREIGN KEY (syndic_user_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT syndic_deletion_requests_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id) ON DELETE CASCADE,
  CONSTRAINT syndic_deletion_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.admins(id),
  CONSTRAINT syndic_deletion_requests_successor_user_id_fkey FOREIGN KEY (successor_user_id) REFERENCES dbasakan.profiles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_syndic_user_id 
  ON dbasakan.syndic_deletion_requests(syndic_user_id);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_residence_id 
  ON dbasakan.syndic_deletion_requests(residence_id);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_status 
  ON dbasakan.syndic_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_syndic_deletion_requests_requested_at 
  ON dbasakan.syndic_deletion_requests(requested_at);

-- Add comments
COMMENT ON TABLE dbasakan.syndic_deletion_requests IS 'Tracks syndic account deletion requests that require admin approval and successor selection';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.status IS 'Current status of the deletion request';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.reviewed_by IS 'Admin ID who reviewed and approved/rejected the request';
COMMENT ON COLUMN dbasakan.syndic_deletion_requests.successor_user_id IS 'The resident selected by admin to become the new syndic';

-- ============================================================================
-- PART 3: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON dbasakan.syndic_deletion_requests TO authenticated;
GRANT ALL ON dbasakan.syndic_deletion_requests TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================================
-- ADD RESIDENT COMPLAINTS SYSTEM
-- Migration: 20250128000000_add_resident_complaints.sql
-- Description: Adds complaint system for residents to submit complaints about other residents
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ENUMS
-- ============================================================================

DO $$ 
BEGIN
  -- Complaint Reason Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_reason' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_reason AS ENUM (
      'noise', 
      'trash', 
      'behavior', 
      'parking', 
      'pets', 
      'property_damage', 
      'other'
    );
  END IF;
  
  -- Complaint Status Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_status AS ENUM (
      'submitted', 
      'reviewed', 
      'resolved'
    );
  END IF;
  
  -- Complaint Privacy Enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_privacy' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.complaint_privacy AS ENUM (
      'private', 
      'anonymous'
    );
  END IF;
END $$;

-- ============================================================================
-- PART 2: CREATE COMPLAINTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.complaints (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  complainant_id text NOT NULL, -- Resident who filed the complaint
  complained_about_id text NOT NULL, -- Resident being complained about
  reason dbasakan.complaint_reason NOT NULL,
  privacy dbasakan.complaint_privacy NOT NULL DEFAULT 'private',
  title text NOT NULL,
  description text NOT NULL,
  status dbasakan.complaint_status NOT NULL DEFAULT 'submitted',
  reviewed_at timestamp with time zone,
  resolved_at timestamp with time zone,
  reviewed_by text, -- Syndic who reviewed
  resolution_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id) ON DELETE CASCADE,
  CONSTRAINT complaints_complainant_id_fkey FOREIGN KEY (complainant_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT complaints_complained_about_id_fkey FOREIGN KEY (complained_about_id) REFERENCES dbasakan.profiles(id) ON DELETE CASCADE,
  CONSTRAINT complaints_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT complaints_no_self_complaint CHECK (complainant_id != complained_about_id)
);

-- Add constraint to ensure both residents are in the same residence
-- Note: This is checked at application level as well, but adding for data integrity
COMMENT ON TABLE dbasakan.complaints IS 'Resident complaints about other residents. Supports private and anonymous complaints.';
COMMENT ON COLUMN dbasakan.complaints.complainant_id IS 'Resident who filed the complaint';
COMMENT ON COLUMN dbasakan.complaints.complained_about_id IS 'Resident being complained about';
COMMENT ON COLUMN dbasakan.complaints.privacy IS 'private: complainant visible to complained-about resident. anonymous: complainant hidden from complained-about resident (but visible to syndic)';
COMMENT ON COLUMN dbasakan.complaints.status IS 'submitted: newly filed, reviewed: syndic has reviewed, resolved: complaint resolved';

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaints_residence_id ON dbasakan.complaints(residence_id);
CREATE INDEX IF NOT EXISTS idx_complaints_complainant_id ON dbasakan.complaints(complainant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_complained_about_id ON dbasakan.complaints(complained_about_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON dbasakan.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON dbasakan.complaints(created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_reason ON dbasakan.complaints(reason);

-- ============================================================================
-- PART 4: CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION dbasakan.update_complaints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_complaints_updated_at ON dbasakan.complaints;
CREATE TRIGGER trigger_update_complaints_updated_at
BEFORE UPDATE ON dbasakan.complaints
FOR EACH ROW
EXECUTE FUNCTION dbasakan.update_complaints_updated_at();

-- ============================================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on complaints table
ALTER TABLE dbasakan.complaints ENABLE ROW LEVEL SECURITY;

-- Policy: Residents can view their own complaints (as complainant)
DROP POLICY IF EXISTS "Residents can view their own complaints" ON dbasakan.complaints;
CREATE POLICY "Residents can view their own complaints" ON dbasakan.complaints
  FOR SELECT
  USING (
    complainant_id = auth.uid()::text
    OR complained_about_id = auth.uid()::text
  );

-- Policy: Residents can view complaints filed against them
-- (Privacy handling is done at application level - RLS just allows access)
DROP POLICY IF EXISTS "Residents can view complaints against them" ON dbasakan.complaints;
-- Note: This is already covered by the above policy, but keeping for clarity

-- Policy: Syndics can view all complaints in their residence
DROP POLICY IF EXISTS "Syndics can view all residence complaints" ON dbasakan.complaints;
CREATE POLICY "Syndics can view all residence complaints" ON dbasakan.complaints
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- Policy: Only residents can create complaints
DROP POLICY IF EXISTS "Residents can create complaints" ON dbasakan.complaints;
CREATE POLICY "Residents can create complaints" ON dbasakan.complaints
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

-- Policy: Only syndics can update complaints (review and resolve)
DROP POLICY IF EXISTS "Syndics can update complaints" ON dbasakan.complaints;
CREATE POLICY "Syndics can update complaints" ON dbasakan.complaints
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles p
      WHERE p.id = auth.uid()::text
      AND p.role = 'syndic'
    )
    AND (complaints.residence_id::bigint) = (dbasakan.get_user_residence_id(auth.uid())::bigint)
  );

-- ============================================================================
-- PART 6: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON dbasakan.complaints TO authenticated;
GRANT ALL ON dbasakan.complaints TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================


-- ============================================================================
-- ADD COMPLAINT EVIDENCE SUPPORT
-- Migration: 20250128000001_add_complaint_evidence.sql
-- Description: Adds evidence table for storing complaint attachments (photos, audio, video)
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE COMPLAINT EVIDENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dbasakan.complaint_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  complaint_id bigint NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL, -- 'image', 'audio', 'video'
  file_size bigint NOT NULL, -- Size in bytes
  mime_type text NOT NULL, -- e.g., 'image/jpeg', 'audio/mpeg', 'video/mp4'
  uploaded_by text NOT NULL, -- Complainant who uploaded
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_evidence_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES dbasakan.complaints(id) ON DELETE CASCADE,
  CONSTRAINT complaint_evidence_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT complaint_evidence_valid_file_type CHECK (file_type IN ('image', 'audio', 'video'))
);

-- Add comments
COMMENT ON TABLE dbasakan.complaint_evidence IS 'Evidence files (photos, audio, video) attached to complaints. Only visible to syndics.';
COMMENT ON COLUMN dbasakan.complaint_evidence.file_type IS 'Type of file: image, audio, or video';
COMMENT ON COLUMN dbasakan.complaint_evidence.file_size IS 'File size in bytes';

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_complaint_evidence_complaint_id ON dbasakan.complaint_evidence(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_uploaded_by ON dbasakan.complaint_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_file_type ON dbasakan.complaint_evidence(file_type);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on complaint_evidence table
ALTER TABLE dbasakan.complaint_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Only syndics can view evidence (evidence is private to syndics)
DROP POLICY IF EXISTS "Syndics can view complaint evidence" ON dbasakan.complaint_evidence;
CREATE POLICY "Syndics can view complaint evidence" ON dbasakan.complaint_evidence
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

-- Policy: Only residents who filed the complaint can upload evidence
DROP POLICY IF EXISTS "Complainants can upload evidence" ON dbasakan.complaint_evidence;
CREATE POLICY "Complainants can upload evidence" ON dbasakan.complaint_evidence
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
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON dbasakan.complaint_evidence TO authenticated;
GRANT ALL ON dbasakan.complaint_evidence TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbasakan TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- ============================================================================
-- 17. RESIDENT ONBOARDING OTP FIELDS
-- Migration: 20251206000000_separate_resident_onboarding_otp.sql
-- Description: Separate fields for resident onboarding OTP to avoid conflicts 
--              with email verification code
-- ============================================================================

-- Add columns for resident onboarding OTP (separate from email verification)
-- Note: These columns are already defined in the profiles table (section 3),
--       but this migration ensures they exist and adds indexes
ALTER TABLE dbasakan.profiles
  ADD COLUMN IF NOT EXISTS resident_onboarding_code text,
  ADD COLUMN IF NOT EXISTS resident_onboarding_code_expires_at timestamp with time zone;

-- Index for resident onboarding code lookup
CREATE INDEX IF NOT EXISTS idx_profiles_resident_onboarding_code 
  ON dbasakan.profiles(resident_onboarding_code) 
  WHERE resident_onboarding_code IS NOT NULL;

-- Index for resident onboarding code expiration
CREATE INDEX IF NOT EXISTS idx_profiles_resident_onboarding_code_expires_at 
  ON dbasakan.profiles(resident_onboarding_code_expires_at) 
  WHERE resident_onboarding_code_expires_at IS NOT NULL;

-- Add comments explaining the separation
COMMENT ON COLUMN dbasakan.profiles.email_verification_code IS 
  'OTP code for email verification during initial authentication/signup. Used by /api/verify-email-code endpoint.';

COMMENT ON COLUMN dbasakan.profiles.email_verification_code_expires_at IS 
  'Expiration timestamp for email verification OTP code. Used for authentication.';

COMMENT ON COLUMN dbasakan.profiles.resident_onboarding_code IS 
  'OTP code for resident onboarding when added by syndic. Used by /api/mobile/auth/verify-otp endpoint. Separate from email verification.';

COMMENT ON COLUMN dbasakan.profiles.resident_onboarding_code_expires_at IS 
  'Expiration timestamp for resident onboarding OTP code. Used when syndic adds a resident.';

COMMENT ON INDEX dbasakan.idx_profiles_resident_onboarding_code IS 
  'Index for quick lookup of resident onboarding OTP codes';

COMMENT ON INDEX dbasakan.idx_profiles_resident_onboarding_code_expires_at IS 
  'Index for checking resident onboarding OTP code expiration timestamps';

-- ============================================================================
-- 18. COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Database schema setup completed successfully!';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Schema: dbasakan';
    RAISE NOTICE 'New relationship model:';
    RAISE NOTICE '  - Syndics: 1:1 with Residence via residences.syndic_user_id';
    RAISE NOTICE '  - Guards: 1:1 with Residence via residences.guard_user_id';
    RAISE NOTICE '  - Residents: M:N with Residence via profile_residences';
    RAISE NOTICE '  - Profiles table: NO residence_id column';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Recent migrations integrated:';
    RAISE NOTICE '  - 20251125000000: Separate admin system (independent from users)';
    RAISE NOTICE '  - 20251204000000: OTP verification indexes';
    RAISE NOTICE '  - 20251205000000: Multiple apartments per residence support';
    RAISE NOTICE '  - 20251205000001: Prevent duplicate apartment assignments';
    RAISE NOTICE '  - 20251206000000: Separate resident onboarding OTP fields';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'All tables, functions, triggers, RLS policies, and permissions created';
    RAISE NOTICE 'All migrations and cleanup steps completed';
    RAISE NOTICE '====================================================================';
END $$;
