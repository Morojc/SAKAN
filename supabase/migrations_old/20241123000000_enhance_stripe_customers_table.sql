-- ============================================================================
-- ENHANCE STRIPE_CUSTOMERS TABLE WITH ADDITIONAL BILLING INFORMATION
-- Migration: 20241123000000_enhance_stripe_customers_table.sql
-- Description: 
--   1. Add plan_name, price_id, amount, currency, interval, subscription_status columns
--   2. Add days_remaining computed column or function
--   3. Add indexes for new columns
-- Safe to run multiple times (uses IF NOT EXISTS and IF EXISTS checks)
-- ============================================================================

-- ============================================================================
-- PART 1: ADD NEW COLUMNS TO STRIPE_CUSTOMERS
-- ============================================================================

-- Add plan_name column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'plan_name'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN plan_name text;
    END IF;
END $$;

-- Add price_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'price_id'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN price_id text;
    END IF;
END $$;

-- Add amount column (stored in cents, same as Stripe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN amount numeric(10,2);
    END IF;
END $$;

-- Add currency column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN currency text DEFAULT 'usd';
    END IF;
END $$;

-- Add interval column (month, year, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'interval'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN interval text;
    END IF;
END $$;

-- Add subscription_status column (active, trialing, incomplete, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN subscription_status text;
    END IF;
END $$;

-- Add days_remaining column (calculated field, updated via trigger or computed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'stripe_customers' 
        AND column_name = 'days_remaining'
    ) THEN
        ALTER TABLE dbasakan.stripe_customers ADD COLUMN days_remaining integer;
    END IF;
END $$;

-- Add comments to new columns
COMMENT ON COLUMN dbasakan.stripe_customers.plan_name IS 'Human-readable plan name (e.g., Basic, Pro)';
COMMENT ON COLUMN dbasakan.stripe_customers.price_id IS 'Stripe price ID for the subscription';
COMMENT ON COLUMN dbasakan.stripe_customers.amount IS 'Subscription amount in currency units (not cents)';
COMMENT ON COLUMN dbasakan.stripe_customers.currency IS 'Currency code (usd, eur, etc.)';
COMMENT ON COLUMN dbasakan.stripe_customers.interval IS 'Billing interval (month, year, etc.)';
COMMENT ON COLUMN dbasakan.stripe_customers.subscription_status IS 'Current Stripe subscription status (active, trialing, incomplete, etc.)';
COMMENT ON COLUMN dbasakan.stripe_customers.days_remaining IS 'Number of days remaining in subscription period, calculated from plan_expires';

-- ============================================================================
-- PART 2: CREATE FUNCTION TO CALCULATE DAYS REMAINING
-- ============================================================================

-- Function to calculate days remaining from plan_expires timestamp
CREATE OR REPLACE FUNCTION dbasakan.calculate_days_remaining(expires_timestamp bigint)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    seconds_remaining numeric;
    days_remaining numeric;
BEGIN
    -- If expires_timestamp is null or invalid, return null
    IF expires_timestamp IS NULL OR expires_timestamp <= 0 THEN
        RETURN NULL;
    END IF;
    
    -- Calculate days remaining from now
    -- plan_expires is in milliseconds, so divide by 1000 to get seconds
    -- Then calculate difference in days
    -- Use FLOOR to get whole days remaining, and ensure it's never negative
    -- This will automatically decrement each day as time passes
    seconds_remaining := (expires_timestamp / 1000.0) - EXTRACT(EPOCH FROM NOW());
    days_remaining := FLOOR(seconds_remaining / 86400.0);
    RETURN GREATEST(0, days_remaining::integer);
END;
$$;

COMMENT ON FUNCTION dbasakan.calculate_days_remaining IS 'Calculates days remaining from plan_expires timestamp (in milliseconds). Returns NULL if expires is null or invalid, otherwise returns days remaining (never negative).';

-- ============================================================================
-- PART 3: CREATE TRIGGER TO AUTO-UPDATE DAYS_REMAINING
-- ============================================================================

-- Function to update days_remaining on insert or update
CREATE OR REPLACE FUNCTION dbasakan.update_stripe_customers_days_remaining()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Calculate and set days_remaining whenever plan_expires changes
    NEW.days_remaining = dbasakan.calculate_days_remaining(NEW.plan_expires);
    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_stripe_customers_days_remaining ON dbasakan.stripe_customers;

-- Create trigger to auto-update days_remaining
-- Trigger fires on INSERT or UPDATE of plan_expires
-- The trigger will recalculate days_remaining whenever plan_expires changes
-- This means days_remaining will automatically decrement as time passes
CREATE TRIGGER trigger_update_stripe_customers_days_remaining
    BEFORE INSERT OR UPDATE OF plan_expires ON dbasakan.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION dbasakan.update_stripe_customers_days_remaining();

-- Note: days_remaining is calculated dynamically based on current time (NOW())
-- The trigger recalculates it whenever plan_expires is inserted or updated
-- Since it uses NOW(), the value will be current at the time of insert/update
-- For real-time days remaining that auto-decrements, you can:
-- 1. Query with: SELECT *, dbasakan.calculate_days_remaining(plan_expires) as current_days_remaining FROM stripe_customers
-- 2. Or run a scheduled job (cron) to update days_remaining periodically (e.g., daily)
-- 3. Or create a view that calculates it on-the-fly

-- ============================================================================
-- PART 4: UPDATE EXISTING ROWS WITH CALCULATED DAYS_REMAINING
-- ============================================================================

-- Update existing rows to calculate days_remaining
UPDATE dbasakan.stripe_customers
SET days_remaining = dbasakan.calculate_days_remaining(plan_expires)
WHERE plan_expires IS NOT NULL;

-- ============================================================================
-- OPTIONAL: Create a function to refresh days_remaining for all rows
-- This can be called by a scheduled job (pg_cron) to update days_remaining daily
-- ============================================================================

CREATE OR REPLACE FUNCTION dbasakan.refresh_stripe_customers_days_remaining()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update days_remaining for all rows with valid plan_expires
    UPDATE dbasakan.stripe_customers
    SET days_remaining = dbasakan.calculate_days_remaining(plan_expires)
    WHERE plan_expires IS NOT NULL AND plan_expires > 0;
END;
$$;

COMMENT ON FUNCTION dbasakan.refresh_stripe_customers_days_remaining IS 'Updates days_remaining for all stripe_customers. Call this from a scheduled job (pg_cron) to keep days_remaining current.';

-- To set up a daily cron job in Supabase, run this in the Supabase SQL editor:
-- SELECT cron.schedule('refresh-days-remaining', '0 0 * * *', 'SELECT dbasakan.refresh_stripe_customers_days_remaining();');

-- ============================================================================
-- PART 5: ADD INDEXES FOR NEW COLUMNS
-- ============================================================================

-- Index on price_id for lookups
CREATE INDEX IF NOT EXISTS stripe_customers_price_id_idx ON dbasakan.stripe_customers(price_id) WHERE price_id IS NOT NULL;

-- Index on subscription_status for filtering
CREATE INDEX IF NOT EXISTS stripe_customers_subscription_status_idx ON dbasakan.stripe_customers(subscription_status) WHERE subscription_status IS NOT NULL;

-- Index on days_remaining for sorting/filtering
CREATE INDEX IF NOT EXISTS stripe_customers_days_remaining_idx ON dbasakan.stripe_customers(days_remaining) WHERE days_remaining IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS stripe_customers_status_active_idx ON dbasakan.stripe_customers(plan_active, subscription_status, days_remaining) 
WHERE plan_active = true;

-- ============================================================================
-- PART 6: UPDATE UPDATED_AT TRIGGER (if not exists)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION dbasakan.update_stripe_customers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_stripe_customers_updated_at ON dbasakan.stripe_customers;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_update_stripe_customers_updated_at
    BEFORE UPDATE ON dbasakan.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION dbasakan.update_stripe_customers_updated_at();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. ✅ Added plan_name, price_id, amount, currency, interval, subscription_status, days_remaining columns
-- 2. ✅ Created calculate_days_remaining() function
-- 3. ✅ Created trigger to auto-update days_remaining on insert/update
-- 4. ✅ Updated existing rows with calculated days_remaining
-- 5. ✅ Added indexes for performance
-- 6. ✅ Added updated_at trigger
-- ============================================================================

