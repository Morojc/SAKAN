-- ============================================================================
-- FIX RELATIONSHIPS AND ADD BILLING TABLES
-- Migration: 20241121000000_fix_relationships_and_add_billing.sql
-- Description: 
--   1. Add missing stripe_customers table (CRITICAL for billing)
--   2. Fix foreign key constraints with proper ON DELETE behaviors
--   3. Add performance indexes on foreign keys
--   4. Add financial tracking tables (transaction_history, balance_snapshots)
--   5. Add enhanced RLS policies
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- PART 1: ADD MISSING STRIPE_CUSTOMERS TABLE
-- ============================================================================
-- CRITICAL: This table is used extensively in code but missing from migration
-- Links NextAuth users to Stripe subscriptions for SaaS billing

CREATE TABLE IF NOT EXISTS dbasakan.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references dbasakan.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  subscription_id text, -- Stripe subscription ID
  plan_active boolean not null default false,
  plan_expires bigint, -- Unix timestamp in milliseconds
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

COMMENT ON TABLE dbasakan.stripe_customers IS 'Links NextAuth users to Stripe subscriptions for SaaS billing. CRITICAL: Required for billing system to function.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS stripe_customers_user_id_idx ON dbasakan.stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS stripe_customers_stripe_customer_id_idx ON dbasakan.stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS stripe_customers_subscription_id_idx ON dbasakan.stripe_customers(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stripe_customers_plan_active_idx ON dbasakan.stripe_customers(plan_active) WHERE plan_active = true;

-- Enable RLS
ALTER TABLE dbasakan.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own subscription" ON dbasakan.stripe_customers;
DROP POLICY IF EXISTS "Service role full access" ON dbasakan.stripe_customers;

-- RLS Policies
CREATE POLICY "Users can view own subscription" ON dbasakan.stripe_customers
  FOR SELECT
  USING (user_id = next_auth.uid());

CREATE POLICY "Service role full access" ON dbasakan.stripe_customers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE dbasakan.stripe_customers TO anon, authenticated, service_role;

-- ============================================================================
-- PART 2: FIX FOREIGN KEY CONSTRAINTS WITH PROPER ON DELETE BEHAVIORS
-- ============================================================================

-- 1. Fix residences.syndic_user_id
-- Decision: SET NULL if syndic account deleted (building can have new syndic)
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'residences_syndic_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.residences DROP CONSTRAINT residences_syndic_user_id_fkey;
  END IF;
  
  -- Add new constraint with proper ON DELETE
  ALTER TABLE dbasakan.residences
    ADD CONSTRAINT residences_syndic_user_id_fkey 
    FOREIGN KEY (syndic_user_id) 
    REFERENCES dbasakan.users(id) 
    ON DELETE SET NULL;
END $$;

-- 2. Fix fees.user_id
-- Decision: CASCADE if resident profile deleted (remove their fees)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fees_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.fees DROP CONSTRAINT fees_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.fees
    ADD CONSTRAINT fees_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE CASCADE;
END $$;

-- 3. Fix fees.residence_id (ensure NOT NULL and proper cascade)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fees_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.fees DROP CONSTRAINT fees_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.fees
    ADD CONSTRAINT fees_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 4. Fix payments.verified_by
-- Decision: SET NULL to preserve audit trail of who verified
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_verified_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.payments DROP CONSTRAINT payments_verified_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.payments
    ADD CONSTRAINT payments_verified_by_fkey 
    FOREIGN KEY (verified_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 5. Fix payments.fee_id (optional link)
-- Decision: SET NULL if fee deleted (payment record remains)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_fee_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.payments DROP CONSTRAINT payments_fee_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.payments
    ADD CONSTRAINT payments_fee_id_fkey 
    FOREIGN KEY (fee_id) 
    REFERENCES dbasakan.fees(id) 
    ON DELETE SET NULL;
END $$;

-- 6. Fix payments.residence_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.payments DROP CONSTRAINT payments_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.payments
    ADD CONSTRAINT payments_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 7. Fix payments.user_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.payments DROP CONSTRAINT payments_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.payments
    ADD CONSTRAINT payments_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE CASCADE;
END $$;

-- 8. Fix expenses.created_by
-- Decision: SET NULL to preserve audit trail
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expenses_created_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.expenses DROP CONSTRAINT expenses_created_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.expenses
    ADD CONSTRAINT expenses_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 9. Fix expenses.residence_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expenses_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.expenses DROP CONSTRAINT expenses_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.expenses
    ADD CONSTRAINT expenses_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 10. Fix incidents.assigned_to
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'incidents_assigned_to_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.incidents DROP CONSTRAINT incidents_assigned_to_fkey;
  END IF;
  
  ALTER TABLE dbasakan.incidents
    ADD CONSTRAINT incidents_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 11. Fix announcements.created_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'announcements_created_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.announcements DROP CONSTRAINT announcements_created_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.announcements
    ADD CONSTRAINT announcements_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 12. Fix polls.created_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'polls_created_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.polls DROP CONSTRAINT polls_created_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.polls
    ADD CONSTRAINT polls_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- ============================================================================
-- PART 3: ADD PERFORMANCE INDEXES ON FOREIGN KEYS AND QUERY PATTERNS
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_residence_id_idx ON dbasakan.profiles(residence_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON dbasakan.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_residence_role_idx ON dbasakan.profiles(residence_id, role);

-- Fees indexes
CREATE INDEX IF NOT EXISTS fees_residence_id_idx ON dbasakan.fees(residence_id);
CREATE INDEX IF NOT EXISTS fees_user_id_idx ON dbasakan.fees(user_id);
CREATE INDEX IF NOT EXISTS fees_residence_user_idx ON dbasakan.fees(residence_id, user_id);
CREATE INDEX IF NOT EXISTS fees_status_idx ON dbasakan.fees(status);
CREATE INDEX IF NOT EXISTS fees_due_date_idx ON dbasakan.fees(due_date);
CREATE INDEX IF NOT EXISTS fees_residence_status_due_idx ON dbasakan.fees(residence_id, status, due_date);

-- Payments indexes
CREATE INDEX IF NOT EXISTS payments_residence_id_idx ON dbasakan.payments(residence_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON dbasakan.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_fee_id_idx ON dbasakan.payments(fee_id) WHERE fee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_method_idx ON dbasakan.payments(method);
CREATE INDEX IF NOT EXISTS payments_status_idx ON dbasakan.payments(status);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON dbasakan.payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS payments_residence_user_status_idx ON dbasakan.payments(residence_id, user_id, status);
CREATE INDEX IF NOT EXISTS payments_verified_by_idx ON dbasakan.payments(verified_by) WHERE verified_by IS NOT NULL;

-- Expenses indexes
CREATE INDEX IF NOT EXISTS expenses_residence_id_idx ON dbasakan.expenses(residence_id);
CREATE INDEX IF NOT EXISTS expenses_created_by_idx ON dbasakan.expenses(created_by);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON dbasakan.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON dbasakan.expenses(category);
CREATE INDEX IF NOT EXISTS expenses_residence_date_idx ON dbasakan.expenses(residence_id, expense_date DESC);

-- Incidents indexes
CREATE INDEX IF NOT EXISTS incidents_residence_id_idx ON dbasakan.incidents(residence_id);
CREATE INDEX IF NOT EXISTS incidents_user_id_idx ON dbasakan.incidents(user_id);
CREATE INDEX IF NOT EXISTS incidents_assigned_to_idx ON dbasakan.incidents(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS incidents_status_idx ON dbasakan.incidents(status);
CREATE INDEX IF NOT EXISTS incidents_residence_status_idx ON dbasakan.incidents(residence_id, status);
CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON dbasakan.incidents(created_at DESC);

-- Announcements indexes
CREATE INDEX IF NOT EXISTS announcements_residence_id_idx ON dbasakan.announcements(residence_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON dbasakan.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON dbasakan.announcements(created_by);

-- Polls indexes
CREATE INDEX IF NOT EXISTS polls_residence_id_idx ON dbasakan.polls(residence_id);
CREATE INDEX IF NOT EXISTS polls_is_active_idx ON dbasakan.polls(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS polls_created_by_idx ON dbasakan.polls(created_by);

-- Access logs indexes
CREATE INDEX IF NOT EXISTS access_logs_residence_id_idx ON dbasakan.access_logs(residence_id);
CREATE INDEX IF NOT EXISTS access_logs_generated_by_idx ON dbasakan.access_logs(generated_by);
CREATE INDEX IF NOT EXISTS access_logs_scanned_by_idx ON dbasakan.access_logs(scanned_by) WHERE scanned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS access_logs_valid_to_idx ON dbasakan.access_logs(valid_to);
CREATE INDEX IF NOT EXISTS access_logs_scanned_at_idx ON dbasakan.access_logs(scanned_at) WHERE scanned_at IS NOT NULL;

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS deliveries_residence_id_idx ON dbasakan.deliveries(residence_id);
CREATE INDEX IF NOT EXISTS deliveries_recipient_id_idx ON dbasakan.deliveries(recipient_id);
CREATE INDEX IF NOT EXISTS deliveries_logged_by_idx ON dbasakan.deliveries(logged_by);
CREATE INDEX IF NOT EXISTS deliveries_picked_up_at_idx ON dbasakan.deliveries(picked_up_at) WHERE picked_up_at IS NOT NULL;

-- ============================================================================
-- PART 4: ADD FINANCIAL TRACKING TABLES
-- ============================================================================

-- Transaction History Table
CREATE TABLE IF NOT EXISTS dbasakan.transaction_history (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) on delete cascade not null,
  transaction_type text not null, -- 'payment', 'expense', 'fee_generated', 'refund'
  reference_id bigint, -- ID of related payment, expense, or fee
  reference_table text, -- 'payments', 'expenses', 'fees'
  amount numeric(10,2) not null,
  balance_after numeric(10,2), -- Running balance after this transaction
  method text, -- 'cash', 'bank_transfer', 'online_card' (for payments)
  description text,
  created_by text references dbasakan.profiles(id) on delete set null,
  created_at timestamptz default now()
);

COMMENT ON TABLE dbasakan.transaction_history IS 'Complete audit trail of all financial transactions for transparency and reporting';

-- Indexes for transaction_history
CREATE INDEX IF NOT EXISTS transaction_history_residence_id_idx ON dbasakan.transaction_history(residence_id);
CREATE INDEX IF NOT EXISTS transaction_history_type_idx ON dbasakan.transaction_history(transaction_type);
CREATE INDEX IF NOT EXISTS transaction_history_created_at_idx ON dbasakan.transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_history_reference_idx ON dbasakan.transaction_history(reference_table, reference_id);
CREATE INDEX IF NOT EXISTS transaction_history_residence_date_idx ON dbasakan.transaction_history(residence_id, created_at DESC);

-- Enable RLS
ALTER TABLE dbasakan.transaction_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Residents can view residence transactions" ON dbasakan.transaction_history;
DROP POLICY IF EXISTS "Syndics can manage residence transactions" ON dbasakan.transaction_history;

-- RLS Policies
CREATE POLICY "Residents can view residence transactions" ON dbasakan.transaction_history
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and residence_id = transaction_history.residence_id
    )
  );

CREATE POLICY "Syndics can manage residence transactions" ON dbasakan.transaction_history
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = transaction_history.residence_id
    )
  );

GRANT ALL ON TABLE dbasakan.transaction_history TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE dbasakan.transaction_history_id_seq TO anon, authenticated, service_role;

-- Balance Snapshots Table
CREATE TABLE IF NOT EXISTS dbasakan.balance_snapshots (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) on delete cascade not null,
  snapshot_date date not null,
  cash_balance numeric(10,2) not null default 0,
  bank_balance numeric(10,2) not null default 0,
  notes text,
  created_by text references dbasakan.profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(residence_id, snapshot_date)
);

COMMENT ON TABLE dbasakan.balance_snapshots IS 'Historical snapshots of cash and bank balances for financial reporting';

-- Indexes for balance_snapshots
CREATE INDEX IF NOT EXISTS balance_snapshots_residence_id_idx ON dbasakan.balance_snapshots(residence_id);
CREATE INDEX IF NOT EXISTS balance_snapshots_date_idx ON dbasakan.balance_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS balance_snapshots_residence_date_idx ON dbasakan.balance_snapshots(residence_id, snapshot_date DESC);

-- Enable RLS
ALTER TABLE dbasakan.balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Residents can view residence balances" ON dbasakan.balance_snapshots;
DROP POLICY IF EXISTS "Syndics can manage residence balances" ON dbasakan.balance_snapshots;

-- RLS Policies
CREATE POLICY "Residents can view residence balances" ON dbasakan.balance_snapshots
  FOR SELECT TO authenticated
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and residence_id = balance_snapshots.residence_id
    )
  );

CREATE POLICY "Syndics can manage residence balances" ON dbasakan.balance_snapshots
  FOR ALL
  USING (
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'syndic' 
      and residence_id = balance_snapshots.residence_id
    )
  );

GRANT ALL ON TABLE dbasakan.balance_snapshots TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE dbasakan.balance_snapshots_id_seq TO anon, authenticated, service_role;

-- ============================================================================
-- PART 5: ENHANCED RLS POLICIES
-- ============================================================================

-- Allow guards to view their own scanned access logs
DROP POLICY IF EXISTS "Guards can view scanned access logs" ON dbasakan.access_logs;
CREATE POLICY "Guards can view scanned access logs" ON dbasakan.access_logs
  FOR SELECT
  USING (
    scanned_by = next_auth.uid() OR
    exists (
      select 1 from dbasakan.profiles
      where id = next_auth.uid() 
      and role = 'guard' 
      and residence_id = access_logs.residence_id
    )
  );

-- Allow residents to view their own fee history (if not already exists)
DROP POLICY IF EXISTS "Residents can view own fee history" ON dbasakan.fees;
CREATE POLICY "Residents can view own fee history" ON dbasakan.fees
  FOR SELECT
  USING (user_id = next_auth.uid());

-- Allow residents to view their own payment history (if not already exists)
DROP POLICY IF EXISTS "Residents can view own payment history" ON dbasakan.payments;
CREATE POLICY "Residents can view own payment history" ON dbasakan.payments
  FOR SELECT
  USING (user_id = next_auth.uid());

-- Syndics can view all residents in their residence
DROP POLICY IF EXISTS "Syndics can view all residence profiles" ON dbasakan.profiles;
CREATE POLICY "Syndics can view all residence profiles" ON dbasakan.profiles
  FOR SELECT
  USING (
    exists (
      select 1 from dbasakan.profiles p
      where p.id = next_auth.uid() 
      and p.role = 'syndic' 
      and p.residence_id = profiles.residence_id
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. ✅ Added stripe_customers table (CRITICAL for billing)
-- 2. ✅ Fixed all foreign key constraints with proper ON DELETE behaviors
-- 3. ✅ Added 40+ performance indexes on foreign keys and query patterns
-- 4. ✅ Added transaction_history and balance_snapshots for financial tracking
-- 5. ✅ Enhanced RLS policies for complete security coverage
-- ============================================================================
