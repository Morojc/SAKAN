-- ============================================================================
-- CLEAN SCHEMA CORRECTIONS FOR PROPERTY MANAGEMENT SAAS
-- Migration: 20241125000000_clean_schema_corrections.sql
-- Description: 
--   1. Remove unnecessary backup tables
--   2. Remove webhook_events table (not critical for core functionality)
--   3. Ensure all foreign keys have proper ON DELETE behaviors
--   4. Add missing indexes for performance
--   5. Ensure schema matches property management SaaS requirements
-- Safe to run multiple times (uses IF EXISTS checks)
-- ============================================================================

-- ============================================================================
-- PART 1: REMOVE UNNECESSARY TABLES
-- ============================================================================

-- Remove backup tables (not needed for core functionality)
DROP TABLE IF EXISTS dbasakan.accounts_backup CASCADE;
DROP TABLE IF EXISTS dbasakan.profiles_backup CASCADE;
DROP TABLE IF EXISTS dbasakan.sessions_backup CASCADE;
DROP TABLE IF EXISTS dbasakan.stripe_customers_backup CASCADE;
DROP TABLE IF EXISTS dbasakan.users_backup CASCADE;

-- Remove webhook_events table (webhook handling can be done via Stripe dashboard/logs)
DROP TABLE IF EXISTS dbasakan.webhook_events CASCADE;

-- ============================================================================
-- PART 2: ENSURE ENUMS EXIST
-- ============================================================================

-- Create enums if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.user_role AS ENUM ('syndic', 'resident', 'guard');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.payment_method AS ENUM ('cash', 'bank_transfer', 'online_card', 'check');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.payment_status AS ENUM ('pending', 'completed', 'rejected');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')) THEN
    CREATE TYPE dbasakan.incident_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;
END $$;

-- ============================================================================
-- PART 3: HELPER FUNCTION TO DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Helper function to safely drop foreign key constraints by table and column
-- Handles both quoted (camelCase) and unquoted (lowercase) column names
CREATE OR REPLACE FUNCTION dbasakan.drop_fk_constraint_if_exists(
  table_schema_name text,
  table_name text,
  column_name text
) RETURNS void AS $$
DECLARE
  constraint_name_var text;
BEGIN
  -- Find the actual constraint name by table and column
  -- Try both the exact column name and lowercase version (PostgreSQL stores unquoted names as lowercase)
  SELECT conname INTO constraint_name_var
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = table_schema_name
    AND t.relname = table_name
    AND c.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.conrelid
        AND a.attnum = ANY(c.conkey)
        AND (a.attname = column_name OR a.attname = LOWER(column_name))
    )
  LIMIT 1;
  
  -- Drop constraint if it exists
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', table_schema_name, table_name, constraint_name_var);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: FIX FOREIGN KEY CONSTRAINTS WITH PROPER ON DELETE BEHAVIORS
-- ============================================================================

-- 1. Fix residences.syndic_user_id
-- Decision: SET NULL if syndic account deleted (building can have new syndic)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'residences_syndic_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.residences DROP CONSTRAINT residences_syndic_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.residences
    ADD CONSTRAINT residences_syndic_user_id_fkey 
    FOREIGN KEY (syndic_user_id) 
    REFERENCES dbasakan.users(id) 
    ON DELETE SET NULL;
END $$;

-- 2. Fix profiles.id (references users)
-- Decision: CASCADE - if user deleted, profile should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.profiles
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES dbasakan.users(id) 
    ON DELETE CASCADE;
END $$;

-- 3. Fix profiles.residence_id
-- Decision: SET NULL if residence deleted (preserve profile, just unlink)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.profiles DROP CONSTRAINT profiles_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.profiles
    ADD CONSTRAINT profiles_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE SET NULL;
END $$;

-- 4. Fix accounts.userId
-- Decision: CASCADE - if user deleted, accounts should be deleted
SELECT dbasakan.drop_fk_constraint_if_exists('dbasakan', 'accounts', 'userId');

ALTER TABLE dbasakan.accounts
  ADD CONSTRAINT accounts_userId_fkey 
  FOREIGN KEY ("userId") 
  REFERENCES dbasakan.users(id) 
  ON DELETE CASCADE;

-- 5. Fix sessions.userId
-- Decision: CASCADE - if user deleted, sessions should be deleted
SELECT dbasakan.drop_fk_constraint_if_exists('dbasakan', 'sessions', 'userId');

ALTER TABLE dbasakan.sessions
  ADD CONSTRAINT sessions_userId_fkey 
  FOREIGN KEY ("userId") 
  REFERENCES dbasakan.users(id) 
  ON DELETE CASCADE;

-- 6. Fix stripe_customers.user_id
-- Decision: CASCADE - if user deleted, subscription data should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stripe_customers_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.stripe_customers DROP CONSTRAINT stripe_customers_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.stripe_customers
    ADD CONSTRAINT stripe_customers_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES dbasakan.users(id) 
    ON DELETE CASCADE;
END $$;

-- 7. Fix fees.residence_id
-- Decision: CASCADE - if residence deleted, fees should be deleted
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

-- 8. Fix fees.user_id
-- Decision: CASCADE - if resident profile deleted, their fees should be deleted
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

-- 9. Fix payments.residence_id
-- Decision: CASCADE - if residence deleted, payments should be deleted
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

-- 10. Fix payments.user_id
-- Decision: CASCADE - if resident profile deleted, their payments should be deleted
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

-- 11. Fix payments.fee_id (optional link)
-- Decision: SET NULL if fee deleted (payment record remains for audit)
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

-- 12. Fix payments.verified_by
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

-- 13. Fix expenses.residence_id
-- Decision: CASCADE - if residence deleted, expenses should be deleted
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

-- 14. Fix expenses.created_by
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

-- 15. Fix incidents.residence_id
-- Decision: CASCADE - if residence deleted, incidents should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'incidents_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.incidents DROP CONSTRAINT incidents_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.incidents
    ADD CONSTRAINT incidents_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 16. Fix incidents.user_id (reporter)
-- Decision: SET NULL to preserve incident record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'incidents_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.incidents DROP CONSTRAINT incidents_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.incidents
    ADD CONSTRAINT incidents_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 17. Fix incidents.assigned_to
-- Decision: SET NULL if assigned user deleted
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

-- 18. Fix announcements.residence_id
-- Decision: CASCADE - if residence deleted, announcements should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'announcements_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.announcements DROP CONSTRAINT announcements_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.announcements
    ADD CONSTRAINT announcements_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 19. Fix announcements.created_by
-- Decision: SET NULL to preserve announcement record
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

-- 20. Fix polls.residence_id
-- Decision: CASCADE - if residence deleted, polls should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'polls_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.polls DROP CONSTRAINT polls_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.polls
    ADD CONSTRAINT polls_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 21. Fix polls.created_by
-- Decision: SET NULL to preserve poll record
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

-- 22. Fix poll_options.poll_id
-- Decision: CASCADE - if poll deleted, options should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'poll_options_poll_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.poll_options DROP CONSTRAINT poll_options_poll_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.poll_options
    ADD CONSTRAINT poll_options_poll_id_fkey 
    FOREIGN KEY (poll_id) 
    REFERENCES dbasakan.polls(id) 
    ON DELETE CASCADE;
END $$;

-- 23. Fix poll_votes.poll_id
-- Decision: CASCADE - if poll deleted, votes should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'poll_votes_poll_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.poll_votes DROP CONSTRAINT poll_votes_poll_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.poll_votes
    ADD CONSTRAINT poll_votes_poll_id_fkey 
    FOREIGN KEY (poll_id) 
    REFERENCES dbasakan.polls(id) 
    ON DELETE CASCADE;
END $$;

-- 24. Fix poll_votes.option_id
-- Decision: CASCADE - if option deleted, votes should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'poll_votes_option_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.poll_votes DROP CONSTRAINT poll_votes_option_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.poll_votes
    ADD CONSTRAINT poll_votes_option_id_fkey 
    FOREIGN KEY (option_id) 
    REFERENCES dbasakan.poll_options(id) 
    ON DELETE CASCADE;
END $$;

-- 25. Fix poll_votes.user_id
-- Decision: SET NULL to preserve vote record (or CASCADE if you want to remove votes when user deleted)
-- Using SET NULL to preserve voting history
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'poll_votes_user_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.poll_votes DROP CONSTRAINT poll_votes_user_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.poll_votes
    ADD CONSTRAINT poll_votes_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 26. Fix access_logs.residence_id
-- Decision: CASCADE - if residence deleted, access logs should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'access_logs_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.access_logs DROP CONSTRAINT access_logs_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.access_logs
    ADD CONSTRAINT access_logs_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 27. Fix access_logs.generated_by
-- Decision: SET NULL to preserve access log record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'access_logs_generated_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.access_logs DROP CONSTRAINT access_logs_generated_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.access_logs
    ADD CONSTRAINT access_logs_generated_by_fkey 
    FOREIGN KEY (generated_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 28. Fix access_logs.scanned_by
-- Decision: SET NULL to preserve access log record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'access_logs_scanned_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.access_logs DROP CONSTRAINT access_logs_scanned_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.access_logs
    ADD CONSTRAINT access_logs_scanned_by_fkey 
    FOREIGN KEY (scanned_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 29. Fix deliveries.residence_id
-- Decision: CASCADE - if residence deleted, deliveries should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deliveries_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.deliveries DROP CONSTRAINT deliveries_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.deliveries
    ADD CONSTRAINT deliveries_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 30. Fix deliveries.recipient_id
-- Decision: SET NULL to preserve delivery record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deliveries_recipient_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.deliveries DROP CONSTRAINT deliveries_recipient_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.deliveries
    ADD CONSTRAINT deliveries_recipient_id_fkey 
    FOREIGN KEY (recipient_id) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 31. Fix deliveries.logged_by
-- Decision: SET NULL to preserve delivery record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'deliveries_logged_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.deliveries DROP CONSTRAINT deliveries_logged_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.deliveries
    ADD CONSTRAINT deliveries_logged_by_fkey 
    FOREIGN KEY (logged_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 32. Fix transaction_history.residence_id
-- Decision: CASCADE - if residence deleted, transaction history should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transaction_history_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.transaction_history DROP CONSTRAINT transaction_history_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.transaction_history
    ADD CONSTRAINT transaction_history_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 33. Fix transaction_history.created_by
-- Decision: SET NULL to preserve transaction record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transaction_history_created_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.transaction_history DROP CONSTRAINT transaction_history_created_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.transaction_history
    ADD CONSTRAINT transaction_history_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- 34. Fix balance_snapshots.residence_id
-- Decision: CASCADE - if residence deleted, balance snapshots should be deleted
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'balance_snapshots_residence_id_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.balance_snapshots DROP CONSTRAINT balance_snapshots_residence_id_fkey;
  END IF;
  
  ALTER TABLE dbasakan.balance_snapshots
    ADD CONSTRAINT balance_snapshots_residence_id_fkey 
    FOREIGN KEY (residence_id) 
    REFERENCES dbasakan.residences(id) 
    ON DELETE CASCADE;
END $$;

-- 35. Fix balance_snapshots.created_by
-- Decision: SET NULL to preserve snapshot record
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'balance_snapshots_created_by_fkey' 
    AND table_schema = 'dbasakan'
  ) THEN
    ALTER TABLE dbasakan.balance_snapshots DROP CONSTRAINT balance_snapshots_created_by_fkey;
  END IF;
  
  ALTER TABLE dbasakan.balance_snapshots
    ADD CONSTRAINT balance_snapshots_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES dbasakan.profiles(id) 
    ON DELETE SET NULL;
END $$;

-- ============================================================================
-- PART 4: ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_residence_id_idx ON dbasakan.profiles(residence_id) WHERE residence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_role_idx ON dbasakan.profiles(role);

-- Fees indexes
CREATE INDEX IF NOT EXISTS fees_residence_id_idx ON dbasakan.fees(residence_id);
CREATE INDEX IF NOT EXISTS fees_user_id_idx ON dbasakan.fees(user_id);
CREATE INDEX IF NOT EXISTS fees_status_idx ON dbasakan.fees(status);
CREATE INDEX IF NOT EXISTS fees_residence_user_status_idx ON dbasakan.fees(residence_id, user_id, status);

-- Payments indexes
CREATE INDEX IF NOT EXISTS payments_residence_id_idx ON dbasakan.payments(residence_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON dbasakan.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_fee_id_idx ON dbasakan.payments(fee_id) WHERE fee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_method_idx ON dbasakan.payments(method);
CREATE INDEX IF NOT EXISTS payments_status_idx ON dbasakan.payments(status);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON dbasakan.payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS payments_residence_status_idx ON dbasakan.payments(residence_id, status);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS expenses_residence_id_idx ON dbasakan.expenses(residence_id);
CREATE INDEX IF NOT EXISTS expenses_created_by_idx ON dbasakan.expenses(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON dbasakan.expenses(expense_date DESC);

-- Incidents indexes
CREATE INDEX IF NOT EXISTS incidents_residence_id_idx ON dbasakan.incidents(residence_id);
CREATE INDEX IF NOT EXISTS incidents_user_id_idx ON dbasakan.incidents(user_id);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON dbasakan.incidents(status);
CREATE INDEX IF NOT EXISTS incidents_assigned_to_idx ON dbasakan.incidents(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS incidents_residence_status_idx ON dbasakan.incidents(residence_id, status);

-- Announcements indexes
CREATE INDEX IF NOT EXISTS announcements_residence_id_idx ON dbasakan.announcements(residence_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON dbasakan.announcements(created_at DESC);

-- Polls indexes
CREATE INDEX IF NOT EXISTS polls_residence_id_idx ON dbasakan.polls(residence_id);
CREATE INDEX IF NOT EXISTS polls_is_active_idx ON dbasakan.polls(is_active) WHERE is_active = true;

-- Poll votes indexes
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON dbasakan.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_id_idx ON dbasakan.poll_votes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_user_unique_idx ON dbasakan.poll_votes(poll_id, user_id);

-- Access logs indexes
CREATE INDEX IF NOT EXISTS access_logs_residence_id_idx ON dbasakan.access_logs(residence_id);
CREATE INDEX IF NOT EXISTS access_logs_generated_by_idx ON dbasakan.access_logs(generated_by);
CREATE INDEX IF NOT EXISTS access_logs_valid_to_idx ON dbasakan.access_logs(valid_to) WHERE scanned_at IS NULL;

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS deliveries_residence_id_idx ON dbasakan.deliveries(residence_id);
CREATE INDEX IF NOT EXISTS deliveries_recipient_id_idx ON dbasakan.deliveries(recipient_id);
CREATE INDEX IF NOT EXISTS deliveries_picked_up_at_idx ON dbasakan.deliveries(picked_up_at) WHERE picked_up_at IS NULL;

-- Transaction history indexes
CREATE INDEX IF NOT EXISTS transaction_history_residence_id_idx ON dbasakan.transaction_history(residence_id);
CREATE INDEX IF NOT EXISTS transaction_history_created_at_idx ON dbasakan.transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_history_reference_idx ON dbasakan.transaction_history(reference_table, reference_id) WHERE reference_id IS NOT NULL;

-- Balance snapshots indexes
CREATE INDEX IF NOT EXISTS balance_snapshots_residence_id_idx ON dbasakan.balance_snapshots(residence_id);
CREATE INDEX IF NOT EXISTS balance_snapshots_snapshot_date_idx ON dbasakan.balance_snapshots(snapshot_date DESC);

-- ============================================================================
-- PART 5: ADD UNIQUE CONSTRAINTS WHERE NEEDED
-- ============================================================================

-- Ensure one vote per user per poll
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'poll_votes_poll_user_unique' 
    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dbasakan')
  ) THEN
    ALTER TABLE dbasakan.poll_votes
      ADD CONSTRAINT poll_votes_poll_user_unique 
      UNIQUE (poll_id, user_id);
  END IF;
END $$;

-- ============================================================================
-- PART 6: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE dbasakan.residences IS 'Buildings/residences managed by syndics. Each residence has one syndic and multiple residents.';
COMMENT ON TABLE dbasakan.profiles IS 'Extended user profiles linking to NextAuth users. Stores resident/syndic/guard information and apartment details.';
COMMENT ON TABLE dbasakan.fees IS 'Monthly or periodic fees (Appels de fonds) charged to residents.';
COMMENT ON TABLE dbasakan.payments IS 'Payment records for fees. Supports cash, bank transfer, online card, and check methods.';
COMMENT ON TABLE dbasakan.expenses IS 'Building maintenance and operational expenses logged by syndics.';
COMMENT ON TABLE dbasakan.incidents IS 'Maintenance requests and incident reports from residents.';
COMMENT ON TABLE dbasakan.announcements IS 'Building-wide announcements and notices posted by syndics.';
COMMENT ON TABLE dbasakan.polls IS 'Resident voting polls for building decisions.';
COMMENT ON TABLE dbasakan.poll_options IS 'Voting options for polls.';
COMMENT ON TABLE dbasakan.poll_votes IS 'Individual votes cast by residents on poll options. One vote per user per poll.';
COMMENT ON TABLE dbasakan.access_logs IS 'QR code-based visitor access logs. Tracks visitor entry/exit.';
COMMENT ON TABLE dbasakan.deliveries IS 'Package and delivery tracking for residents.';
COMMENT ON TABLE dbasakan.transaction_history IS 'Complete audit trail of all financial transactions (payments and expenses).';
COMMENT ON TABLE dbasakan.balance_snapshots IS 'Historical balance snapshots for financial reconciliation and reporting.';
COMMENT ON TABLE dbasakan.stripe_customers IS 'Links NextAuth users to Stripe subscriptions for SaaS billing.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

