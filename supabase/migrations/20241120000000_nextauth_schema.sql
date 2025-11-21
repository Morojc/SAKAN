-- ============================================================================
-- COMPLETE DBASAKAN SCHEMA MIGRATION
-- Includes: Your existing app tables + NextAuth tables for OAuth
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- Create dbasakan schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS dbasakan;

-- Grant usage on schema
GRANT USAGE ON SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA dbasakan TO service_role;

-- ============================================================================
-- 1. DEFINING ENUMS (To ensure data consistency)
-- ============================================================================
CREATE TYPE IF NOT EXISTS dbasakan.user_role AS ENUM ('syndic', 'resident', 'guard');
CREATE TYPE IF NOT EXISTS dbasakan.payment_method AS ENUM ('cash', 'bank_transfer', 'online_card', 'check');
CREATE TYPE IF NOT EXISTS dbasakan.payment_status AS ENUM ('pending', 'completed', 'rejected');
CREATE TYPE IF NOT EXISTS dbasakan.incident_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- ============================================================================
-- 2. YOUR EXISTING APP TABLES
-- ============================================================================

-- RESIDENCES TABLE
CREATE TABLE IF NOT EXISTS dbasakan.residences (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now(),
  name text not null,
  address text not null,
  city text not null,
  bank_account_rib text, -- Keeping it text to handle dashes/spaces
  syndic_user_id uuid references auth.users(id) -- The main admin for this building
);

-- PROFILES (Extends auth.users)
-- This creates a 1-to-1 link with Supabase Auth.
CREATE TABLE IF NOT EXISTS dbasakan.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  created_at timestamp with time zone default now(),
  residence_id bigint references dbasakan.residences(id) on delete set null,
  full_name text not null,
  apartment_number text,
  phone_number text,
  role dbasakan.user_role not null default 'resident'
);
COMMENT ON TABLE dbasakan.profiles IS 'Extended user data linking to Supabase Auth. Stores name, role, and apartment info.';

-- FEES (Appels de fonds)
CREATE TABLE IF NOT EXISTS dbasakan.fees (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null,
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
  user_id uuid references dbasakan.profiles(id) not null,
  fee_id bigint references dbasakan.fees(id), -- Optional: link payment to a specific fee
  amount numeric(10,2) not null,
  method dbasakan.payment_method not null, -- cash, bank_transfer, etc.
  status dbasakan.payment_status not null default 'pending', 
  proof_url text, -- Receipt image URL
  paid_at timestamp with time zone default now(),
  verified_by uuid references dbasakan.profiles(id) -- ID of Syndic who clicked "Confirm" for cash
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
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

-- INCIDENTS
CREATE TABLE IF NOT EXISTS dbasakan.incidents (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null, -- Who reported it
  title text not null,
  description text not null,
  photo_url text,
  status dbasakan.incident_status not null default 'open',
  assigned_to uuid references dbasakan.profiles(id), -- Technician or Guard
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
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

-- POLLS & VOTES
CREATE TABLE IF NOT EXISTS dbasakan.polls (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  question text not null,
  is_active boolean default true,
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
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
  user_id uuid references dbasakan.profiles(id) not null,
  created_at timestamp with time zone default now(),
  unique (poll_id, user_id) -- Ensures a user can only vote once per poll
);

-- ACCESS (QR Codes)
CREATE TABLE IF NOT EXISTS dbasakan.access_logs (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  generated_by uuid references dbasakan.profiles(id) not null, -- Resident
  visitor_name text not null,
  qr_code_data text not null, -- The secret hash in the QR
  valid_from timestamp with time zone not null,
  valid_to timestamp with time zone not null,
  scanned_at timestamp with time zone, -- Null until used
  scanned_by uuid references dbasakan.profiles(id) -- Guard who scanned it
);

-- DELIVERIES
CREATE TABLE IF NOT EXISTS dbasakan.deliveries (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  recipient_id uuid references dbasakan.profiles(id) not null, -- Resident
  logged_by uuid references dbasakan.profiles(id) not null, -- Guard
  description text not null, -- "Amazon Package", "Food"
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- ============================================================================
-- 3. NEXTAUTH TABLES (Required for OAuth/Google Sign-in)
-- These are SEPARATE from your existing tables and auth.users
-- ============================================================================

-- NextAuth users table (for session management - separate from auth.users and dbasakan.profiles)
CREATE TABLE IF NOT EXISTS dbasakan.users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NextAuth accounts table (for OAuth providers like Google)
CREATE TABLE IF NOT EXISTS dbasakan.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES dbasakan.users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_account_id)
);

-- NextAuth sessions table (for active user sessions)
CREATE TABLE IF NOT EXISTS dbasakan.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES dbasakan.users(id) ON DELETE CASCADE
);

-- NextAuth verification tokens table (for email verification and magic links)
CREATE TABLE IF NOT EXISTS dbasakan.verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================================
-- INDEXES for NextAuth tables (performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON dbasakan.accounts(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON dbasakan.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_session_token_idx ON dbasakan.sessions(session_token);

-- ============================================================================
-- PERMISSIONS - Grant access to all tables
-- ============================================================================
GRANT ALL ON ALL TABLES IN SCHEMA dbasakan TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA dbasakan TO anon, authenticated, service_role;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Enable on tables
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
-- RLS POLICIES - Drop existing if they exist (idempotent)
-- ============================================================================

-- Drop existing NextAuth policies
DROP POLICY IF EXISTS "Service role all access on users" ON dbasakan.users;
DROP POLICY IF EXISTS "Service role all access on accounts" ON dbasakan.accounts;
DROP POLICY IF EXISTS "Service role all access on sessions" ON dbasakan.sessions;
DROP POLICY IF EXISTS "Service role all access on verification_tokens" ON dbasakan.verification_tokens;
DROP POLICY IF EXISTS "Allow insert users" ON dbasakan.users;
DROP POLICY IF EXISTS "Allow insert accounts" ON dbasakan.accounts;
DROP POLICY IF EXISTS "Allow insert sessions" ON dbasakan.sessions;
DROP POLICY IF EXISTS "Anyone can create verification tokens" ON dbasakan.verification_tokens;
DROP POLICY IF EXISTS "Anyone can read verification tokens" ON dbasakan.verification_tokens;

-- Drop existing app policies (if they exist)
DROP POLICY IF EXISTS "Users can view own profile" ON dbasakan.profiles;
DROP POLICY IF EXISTS "Syndics view all payments" ON dbasakan.payments;

-- ============================================================================
-- RLS POLICIES - Create policies
-- ============================================================================

-- CRITICAL: Service role must have full access to NextAuth tables for NextAuth to work
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

-- Your existing app policies
CREATE POLICY "Users can view own profile" ON dbasakan.profiles
  FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Syndics view all payments" ON dbasakan.payments
  FOR SELECT
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = auth.uid() 
      and role = 'syndic' 
      and residence_id = payments.residence_id
    )
  );

-- ============================================================================
-- NOTES
-- ============================================================================
-- This migration includes:
-- 1. Your existing app tables (profiles, residences, fees, payments, etc.)
-- 2. NextAuth tables (users, accounts, sessions, verification_tokens)
--
-- Important distinctions:
-- - dbasakan.users (NextAuth) is SEPARATE from auth.users (Supabase Auth) and dbasakan.profiles (your app)
-- - NextAuth tables are ONLY for OAuth/session management
-- - Your existing tables remain unchanged and functional
-- - Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================
