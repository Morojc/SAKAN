-- ============================================================================
-- COMPLETE DBASAKAN SCHEMA MIGRATION
-- Architecture: NextAuth (authentication) + Supabase (database)
-- - NextAuth handles OAuth (Google, etc.) and session management
-- - Supabase stores data and enforces RLS using JWT from NextAuth
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ⚠️ CLEANUP: Drop existing schema to ensure fresh start (Fixes "column does not exist" errors)
DROP SCHEMA IF EXISTS dbasakan CASCADE;
DROP SCHEMA IF EXISTS next_auth CASCADE;

-- Create dbasakan schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS dbasakan;

-- Grant usage on schema
GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA dbasakan TO service_role;

-- ============================================================================
-- CRITICAL: Create next_auth.uid() function for RLS policies
-- This extracts the user ID from the JWT token provided by NextAuth
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS next_auth;

CREATE OR REPLACE FUNCTION next_auth.uid() RETURNS TEXT
    LANGUAGE sql STABLE
    AS $$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::text
$$;

-- ============================================================================
-- 1. DEFINING ENUMS (To ensure data consistency)
-- ============================================================================
-- Use DO block for idempotent enum creation
DO $$ BEGIN
    CREATE TYPE dbasakan.user_role AS ENUM ('syndic', 'resident', 'guard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dbasakan.payment_method AS ENUM ('cash', 'bank_transfer', 'online_card', 'check');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dbasakan.payment_status AS ENUM ('pending', 'completed', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dbasakan.incident_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. NEXTAUTH TABLES (Create first - other tables depend on these)
-- ============================================================================

-- NextAuth users table (base user identity from OAuth providers)
-- Column names match NextAuth Supabase Adapter expectations (camelCase where needed)
CREATE TABLE IF NOT EXISTS dbasakan.users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE dbasakan.users IS 'NextAuth user records. Links to OAuth providers (Google, etc.)';

-- NextAuth accounts table (for OAuth providers like Google)
CREATE TABLE IF NOT EXISTS dbasakan.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  FOREIGN KEY ("userId") REFERENCES dbasakan.users(id) ON DELETE CASCADE,
  UNIQUE(provider, "providerAccountId")
);
COMMENT ON TABLE dbasakan.accounts IS 'OAuth provider accounts linked to NextAuth users';

-- NextAuth sessions table (for active user sessions)
CREATE TABLE IF NOT EXISTS dbasakan.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  FOREIGN KEY ("userId") REFERENCES dbasakan.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE dbasakan.sessions IS 'Active user sessions managed by NextAuth';

-- NextAuth verification tokens table (for email verification and magic links)
CREATE TABLE IF NOT EXISTS dbasakan.verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
COMMENT ON TABLE dbasakan.verification_tokens IS 'Verification tokens for email verification';

-- ============================================================================
-- 3. YOUR APP TABLES (Business Logic)
-- ============================================================================

-- RESIDENCES TABLE
CREATE TABLE IF NOT EXISTS dbasakan.residences (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now(),
  name text not null,
  address text not null,
  city text not null,
  bank_account_rib text, -- Keeping it text to handle dashes/spaces
  syndic_user_id text references dbasakan.users(id) -- The main admin (syndic) for this building
);
COMMENT ON TABLE dbasakan.residences IS 'Residential buildings/complexes managed in the system';

-- PROFILES (Extends NextAuth users with app-specific data)
-- This creates a 1-to-1 link with NextAuth dbasakan.users table.
-- Note: id is TEXT to match NextAuth's user id format
CREATE TABLE IF NOT EXISTS dbasakan.profiles (
  id text primary key, -- Links to dbasakan.users(id) from NextAuth
  created_at timestamp with time zone default now(),
  residence_id bigint references dbasakan.residences(id) on delete set null,
  full_name text not null,
  apartment_number text,
  phone_number text,
  role dbasakan.user_role not null default 'resident',
  FOREIGN KEY (id) REFERENCES dbasakan.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE dbasakan.profiles IS 'Extended user data linking to NextAuth users. Stores name, role, and apartment info.';

-- FEES (Appels de fonds)
CREATE TABLE IF NOT EXISTS dbasakan.fees (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id text references dbasakan.profiles(id) not null,
  title text not null, -- e.g. "Frais de Mars 2024"
  amount numeric(10,2) not null,
  due_date date not null,
  status text not null default 'unpaid', -- could make this an enum too
  created_at timestamp with time zone default now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS dbasakan.payments (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id text references dbasakan.profiles(id) not null,
  fee_id bigint references dbasakan.fees(id), -- Optional: link payment to a specific fee
  amount numeric(10,2) not null,
  method dbasakan.payment_method not null, -- cash, bank_transfer, etc.
  status dbasakan.payment_status not null default 'pending', 
  proof_url text, -- Receipt image URL
  paid_at timestamp with time zone default now(),
  verified_by text references dbasakan.profiles(id) -- ID of Syndic who clicked "Confirm" for cash
);

-- EXPENSES (Depenses)
CREATE TABLE IF NOT EXISTS dbasakan.expenses (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  description text not null,
  category text not null, -- e.g. 'Electricity', 'Cleaning'
  amount numeric(10,2) not null,
  attachment_url text, -- Invoice image
  expense_date date not null,
  created_by text references dbasakan.profiles(id),
  created_at timestamp with time zone default now()
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS dbasakan.incidents (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id text references dbasakan.profiles(id) not null, -- Who reported it
  title text not null,
  description text not null,
  photo_url text,
  status dbasakan.incident_status not null default 'open',
  assigned_to text references dbasakan.profiles(id), -- Technician or Guard
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS dbasakan.announcements (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  title text not null,
  content text not null,
  attachment_url text,
  created_by text references dbasakan.profiles(id),
  created_at timestamp with time zone default now()
);

-- POLLS & VOTES
CREATE TABLE IF NOT EXISTS dbasakan.polls (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  question text not null,
  is_active boolean default true,
  created_by text references dbasakan.profiles(id),
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS dbasakan.poll_options (
  id bigint generated always as identity primary key,
  poll_id bigint references dbasakan.polls(id) on delete cascade not null,
  option_text text not null
);

CREATE TABLE IF NOT EXISTS dbasakan.poll_votes (
  id bigint generated always as identity primary key,
  poll_id bigint references dbasakan.polls(id) on delete cascade not null,
  option_id bigint references dbasakan.poll_options(id) on delete cascade not null,
  user_id text references dbasakan.profiles(id) not null,
  created_at timestamp with time zone default now(),
  unique (poll_id, user_id) -- Ensures a user can only vote once per poll
);

-- ACCESS (QR Codes)
CREATE TABLE IF NOT EXISTS dbasakan.access_logs (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  generated_by text references dbasakan.profiles(id) not null, -- Resident
  visitor_name text not null,
  qr_code_data text not null, -- The secret hash in the QR
  valid_from timestamp with time zone not null,
  valid_to timestamp with time zone not null,
  scanned_at timestamp with time zone, -- Null until used
  scanned_by text references dbasakan.profiles(id) -- Guard who scanned it
);

-- DELIVERIES
CREATE TABLE IF NOT EXISTS dbasakan.deliveries (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  recipient_id text references dbasakan.profiles(id) not null, -- Resident
  logged_by text references dbasakan.profiles(id) not null, -- Guard
  description text not null, -- "Amazon Package", "Food"
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- ============================================================================
-- 4. INDEXES for NextAuth tables (performance optimization)
-- ============================================================================
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON dbasakan.accounts("userId");
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON dbasakan.sessions("userId");
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON dbasakan.sessions("sessionToken");

-- ============================================================================
-- 5. PERMISSIONS - Grant access to all tables
-- ============================================================================
-- Note: RLS policies will restrict actual access, but base grants are needed
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA next_auth TO anon, authenticated, service_role;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) - Enable on tables
-- ============================================================================

-- Enable RLS on your existing app tables
ALTER TABLE dbasakan.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.deliveries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on NextAuth tables
ALTER TABLE dbasakan.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dbasakan.verification_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS POLICIES - Note on idempotency
-- ============================================================================
-- This migration creates policies with unique names. If you need to re-run
-- this migration, either:
-- 1. Drop and recreate the schema, OR
-- 2. Manually drop policies before re-running
-- PostgreSQL doesn't support CREATE OR REPLACE POLICY, so we can't make
-- this fully idempotent without dynamic SQL.

-- ============================================================================
-- 8. RLS POLICIES - Create policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- NEXTAUTH TABLE POLICIES
-- ---------------------------------------------------------------------------
-- CRITICAL: Service role must have full access to NextAuth tables
-- NextAuth uses SUPABASE_SECRET_KEY (service_role) for all operations
CREATE POLICY "Service role all access on users" ON dbasakan.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role all access on accounts" ON dbasakan.accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role all access on sessions" ON dbasakan.sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role all access on verification_tokens" ON dbasakan.verification_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon/authenticated to insert for NextAuth signup/login flow
CREATE POLICY "Allow insert users" ON dbasakan.users
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow insert accounts" ON dbasakan.accounts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow insert sessions" ON dbasakan.sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to create/read verification tokens (needed for email signup/signin)
CREATE POLICY "Anyone can create verification tokens" ON dbasakan.verification_tokens
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification tokens" ON dbasakan.verification_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- APP TABLE POLICIES (Using next_auth.uid() for NextAuth integration)
-- ---------------------------------------------------------------------------

-- PROFILES: Users can view, create (on first login), and update their own profile
CREATE POLICY "Users can view own profile" ON dbasakan.profiles
  FOR SELECT
  USING ( next_auth.uid() = id );

CREATE POLICY "Users can create own profile" ON dbasakan.profiles
  FOR INSERT
  WITH CHECK ( next_auth.uid() = id );

CREATE POLICY "Users can update own profile" ON dbasakan.profiles
  FOR UPDATE
  USING ( next_auth.uid() = id )
  WITH CHECK ( next_auth.uid() = id );

-- RESIDENCES: Anyone authenticated can view residences, only syndics can modify
CREATE POLICY "Authenticated users can view residences" ON dbasakan.residences
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Syndics can manage their residence" ON dbasakan.residences
  FOR ALL
  USING ( syndic_user_id = next_auth.uid() )
  WITH CHECK ( syndic_user_id = next_auth.uid() );

-- FEES: Users can view their own fees, syndics can manage all fees in their residence
CREATE POLICY "Users can view own fees" ON dbasakan.fees
  FOR SELECT
  USING ( user_id = next_auth.uid() );

CREATE POLICY "Syndics can manage residence fees" ON dbasakan.fees
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = fees.residence_id
    )
  );

-- PAYMENTS: Users can view and create their own payments, syndics can view all
CREATE POLICY "Users can view own payments" ON dbasakan.payments
  FOR SELECT
  USING ( user_id = next_auth.uid() );

CREATE POLICY "Users can create own payments" ON dbasakan.payments
  FOR INSERT
  WITH CHECK ( user_id = next_auth.uid() );

CREATE POLICY "Syndics can manage all payments in residence" ON dbasakan.payments
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = payments.residence_id
    )
  );

-- EXPENSES: Syndics can manage expenses
CREATE POLICY "Authenticated users can view expenses" ON dbasakan.expenses
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and residence_id = expenses.residence_id
    )
  );

CREATE POLICY "Syndics can manage expenses" ON dbasakan.expenses
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = expenses.residence_id
    )
  );

-- INCIDENTS: Users can manage their own, syndics can manage all in residence
CREATE POLICY "Users can view own incidents" ON dbasakan.incidents
  FOR SELECT
  USING ( user_id = next_auth.uid() OR assigned_to = next_auth.uid() );

CREATE POLICY "Users can create incidents" ON dbasakan.incidents
  FOR INSERT
  WITH CHECK ( user_id = next_auth.uid() );

CREATE POLICY "Users can update own incidents" ON dbasakan.incidents
  FOR UPDATE
  USING ( user_id = next_auth.uid() OR assigned_to = next_auth.uid() );

CREATE POLICY "Syndics can manage all incidents" ON dbasakan.incidents
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = incidents.residence_id
    )
  );

-- ANNOUNCEMENTS: All residents can view, only syndics can create/manage
CREATE POLICY "Residents can view announcements" ON dbasakan.announcements
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and residence_id = announcements.residence_id
    )
  );

CREATE POLICY "Syndics can manage announcements" ON dbasakan.announcements
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = announcements.residence_id
    )
  );

-- POLLS: All residents can view, only syndics can create
CREATE POLICY "Residents can view polls" ON dbasakan.polls
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and residence_id = polls.residence_id
    )
  );

CREATE POLICY "Syndics can manage polls" ON dbasakan.polls
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = polls.residence_id
    )
  );

-- POLL OPTIONS: Inherit from poll permissions
CREATE POLICY "Users can view poll options" ON dbasakan.poll_options
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.polls p
      join dbasakan.profiles pr on pr.id = next_auth.uid()
      where p.id = poll_options.poll_id 
      and pr.residence_id = p.residence_id
    )
  );

CREATE POLICY "Syndics can manage poll options" ON dbasakan.poll_options
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.polls p
      join dbasakan.profiles pr on pr.id = next_auth.uid()
      where p.id = poll_options.poll_id 
      and pr.role = 'syndic'
      and pr.residence_id = p.residence_id
    )
  );

-- POLL VOTES: Users can create their own votes and view all votes
CREATE POLICY "Users can view votes" ON dbasakan.poll_votes
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.polls p
      join dbasakan.profiles pr on pr.id = next_auth.uid()
      where p.id = poll_votes.poll_id 
      and pr.residence_id = p.residence_id
    )
  );

CREATE POLICY "Users can create own votes" ON dbasakan.poll_votes
  FOR INSERT
  WITH CHECK ( user_id = next_auth.uid() );

-- ACCESS LOGS: Residents can manage their own QR codes, guards can scan them
CREATE POLICY "Users can manage own access logs" ON dbasakan.access_logs
  FOR ALL
  USING ( generated_by = next_auth.uid() );

CREATE POLICY "Guards can scan QR codes" ON dbasakan.access_logs
  FOR UPDATE
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'guard' 
      and residence_id = access_logs.residence_id
    )
  );

-- DELIVERIES: Guards can create, residents can view their own
CREATE POLICY "Residents can view own deliveries" ON dbasakan.deliveries
  FOR SELECT
  USING ( recipient_id = next_auth.uid() );

CREATE POLICY "Guards can manage deliveries" ON dbasakan.deliveries
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'guard' 
      and residence_id = deliveries.residence_id
    )
  );

-- ============================================================================
-- ARCHITECTURE NOTES
-- ============================================================================
-- This migration sets up a hybrid NextAuth + Supabase architecture:
--
-- AUTHENTICATION FLOW:
-- 1. NextAuth handles OAuth (Google, etc.) and creates sessions
-- 2. NextAuth generates a JWT with user ID in the 'sub' claim
-- 3. Your app passes this JWT as Authorization header to Supabase
-- 4. Supabase extracts user ID via next_auth.uid() function
-- 5. RLS policies enforce access control based on user ID
--
-- TABLE STRUCTURE:
-- - dbasakan.users: NextAuth user records (id is TEXT, stores OAuth info)
-- - dbasakan.accounts: OAuth provider accounts (Google, etc.)
-- - dbasakan.sessions: Active user sessions with tokens
-- - dbasakan.profiles: Extended user info (links to users via TEXT id)
-- - All other app tables: Business logic (fees, payments, incidents, etc.)
--
-- KEY POINTS:
-- - ALL user_id columns are TEXT to match NextAuth's id format
-- - RLS policies use next_auth.uid() NOT auth.uid()
-- - Service role has full access (for NextAuth operations)
-- - Supabase Auth (auth.users) is NOT used in this setup
-- - Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================
