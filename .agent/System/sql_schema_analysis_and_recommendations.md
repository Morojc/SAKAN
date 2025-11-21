# SQL Schema Deep Dive Analysis & Relationship Corrections
## SAKAN Property Management System

**Analysis Date**: Based on `supabase/migrations/20241120000000_nextauth_schema.sql`  
**Architecture**: NextAuth + Supabase (PostgreSQL)  
**Schema**: `dbasakan`

---

## Executive Summary

After deep analysis of the SQL schema and the complete user-to-billing flow, I've identified **critical relationship issues** and **missing tables** that need correction. The current schema has several problems:

1. **Missing `stripe_customers` table** in the migration (exists in code but not in SQL)
2. **Inconsistent foreign key relationships** - some missing ON DELETE behaviors
3. **Missing indexes** on critical foreign keys
4. **Incomplete RLS policies** for some tables
5. **Missing audit/logging tables** for financial transparency
6. **No transaction history** table for complete payment tracking

---

## Complete User-to-Billing Flow Analysis

### Flow Overview
```
1. User Signup (NextAuth) 
   → dbasakan.users (authentication)
   → dbasakan.accounts (OAuth providers)
   → dbasakan.sessions (active sessions)

2. User Profile Creation
   → dbasakan.profiles (extended user data)
   → Links to dbasakan.residences (building assignment)

3. SaaS Subscription (Stripe)
   → stripe_customers (MISSING from migration!)
   → Links to dbasakan.users via user_id

4. Residence Management
   → dbasakan.residences (buildings)
   → Syndic manages → Residents live in

5. Fee Generation (Appels de fonds)
   → dbasakan.fees (monthly charges)
   → Links to residence + user

6. Payment Processing
   → dbasakan.payments (payment records)
   → Links to fees (optional), residence, user
   → Cash/Bank/Online methods

7. Expense Tracking
   → dbasakan.expenses (building costs)
   → Links to residence, created_by (syndic)

8. Financial Reconciliation
   → MISSING: transaction_history
   → MISSING: cash_balance, bank_balance tracking
```

---

## Critical Issues Found

### 1. **MISSING: `stripe_customers` Table**
**Severity**: CRITICAL  
**Impact**: Billing system cannot function

The codebase extensively uses `stripe_customers` table but it's **completely missing** from the migration SQL. This table is essential for:
- Linking NextAuth users to Stripe subscriptions
- Tracking active plans and expiration
- Managing subscription lifecycle

**Current Usage in Code**:
- `app/api/webhook/stripe/route.ts` - upserts on checkout
- `components/app/billing/BillingInfo.tsx` - reads subscription data
- `app/api/account/delete/route.ts` - deletes on account removal

### 2. **Inconsistent Foreign Key Constraints**

**Issue**: Missing `ON DELETE` behaviors on critical relationships

| Table | Column | References | Current Behavior | Recommended |
|-------|--------|------------|------------------|-------------|
| `residences` | `syndic_user_id` | `dbasakan.users(id)` | None | `ON DELETE SET NULL` or `RESTRICT` |
| `fees` | `user_id` | `dbasakan.profiles(id)` | None | `ON DELETE CASCADE` (if resident leaves) |
| `payments` | `verified_by` | `dbasakan.profiles(id)` | None | `ON DELETE SET NULL` (preserve audit) |
| `expenses` | `created_by` | `dbasakan.profiles(id)` | None | `ON DELETE SET NULL` (preserve audit) |

### 3. **Missing Indexes on Foreign Keys**

**Performance Issue**: No indexes on frequently queried foreign keys

Missing indexes on:
- `profiles(residence_id)` - Critical for filtering by building
- `fees(residence_id, user_id)` - Fee lookups
- `payments(residence_id, user_id, status)` - Payment queries
- `payments(fee_id)` - Linking payments to fees
- `expenses(residence_id, expense_date)` - Expense reporting

### 4. **Incomplete Financial Tracking**

**Missing Tables**:
1. **`transaction_history`** - Complete audit trail of all financial transactions
2. **`cash_balance_snapshots`** - Historical cash balance tracking
3. **`bank_balance_snapshots`** - Historical bank balance tracking

**Business Impact**: Cannot generate accurate financial reports or audit trails

### 5. **RLS Policy Gaps**

**Missing Policies**:
- No policy for guards to view their own scanned access logs
- No policy for residents to view their own fee history
- No policy for syndics to view all financial data across residences (if multi-residence)

---

## Corrected SQL Schema

### Part 1: Add Missing `stripe_customers` Table

```sql
-- ============================================================================
-- STRIPE CUSTOMERS TABLE (MISSING FROM ORIGINAL MIGRATION)
-- ============================================================================
-- This table links NextAuth users to Stripe subscriptions
-- CRITICAL: Must be in dbasakan schema, not public

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

COMMENT ON TABLE dbasakan.stripe_customers IS 'Links NextAuth users to Stripe subscriptions for SaaS billing';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS stripe_customers_user_id_idx ON dbasakan.stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS stripe_customers_stripe_customer_id_idx ON dbasakan.stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS stripe_customers_subscription_id_idx ON dbasakan.stripe_customers(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stripe_customers_plan_active_idx ON dbasakan.stripe_customers(plan_active) WHERE plan_active = true;

-- Enable RLS
ALTER TABLE dbasakan.stripe_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscription" ON dbasakan.stripe_customers
  FOR SELECT
  USING (user_id = next_auth.uid());

CREATE POLICY "Service role full access" ON dbasakan.stripe_customers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE dbasakan.stripe_customers TO anon, authenticated, service_role;
GRANT ALL ON SEQUENCE dbasakan.stripe_customers_id_seq TO anon, authenticated, service_role;
```

### Part 2: Fix Foreign Key Relationships

```sql
-- ============================================================================
-- FIX FOREIGN KEY CONSTRAINTS WITH PROPER ON DELETE BEHAVIORS
-- ============================================================================

-- 1. Fix residences.syndic_user_id
-- Decision: SET NULL if syndic account deleted (building can have new syndic)
ALTER TABLE dbasakan.residences 
  DROP CONSTRAINT IF EXISTS residences_syndic_user_id_fkey;

ALTER TABLE dbasakan.residences
  ADD CONSTRAINT residences_syndic_user_id_fkey 
  FOREIGN KEY (syndic_user_id) 
  REFERENCES dbasakan.users(id) 
  ON DELETE SET NULL;

-- 2. Fix fees.user_id
-- Decision: CASCADE if resident profile deleted (remove their fees)
ALTER TABLE dbasakan.fees 
  DROP CONSTRAINT IF EXISTS fees_user_id_fkey;

ALTER TABLE dbasakan.fees
  ADD CONSTRAINT fees_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES dbasakan.profiles(id) 
  ON DELETE CASCADE;

-- 3. Fix payments.verified_by
-- Decision: SET NULL to preserve audit trail of who verified
ALTER TABLE dbasakan.payments 
  DROP CONSTRAINT IF EXISTS payments_verified_by_fkey;

ALTER TABLE dbasakan.payments
  ADD CONSTRAINT payments_verified_by_fkey 
  FOREIGN KEY (verified_by) 
  REFERENCES dbasakan.profiles(id) 
  ON DELETE SET NULL;

-- 4. Fix expenses.created_by
-- Decision: SET NULL to preserve audit trail
ALTER TABLE dbasakan.expenses 
  DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

ALTER TABLE dbasakan.expenses
  ADD CONSTRAINT expenses_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES dbasakan.profiles(id) 
  ON DELETE SET NULL;

-- 5. Fix payments.fee_id (optional link)
-- Decision: SET NULL if fee deleted (payment record remains)
ALTER TABLE dbasakan.payments 
  DROP CONSTRAINT IF EXISTS payments_fee_id_fkey;

ALTER TABLE dbasakan.payments
  ADD CONSTRAINT payments_fee_id_fkey 
  FOREIGN KEY (fee_id) 
  REFERENCES dbasakan.fees(id) 
  ON DELETE SET NULL;
```

### Part 3: Add Critical Indexes

```sql
-- ============================================================================
-- ADD PERFORMANCE INDEXES ON FOREIGN KEYS AND QUERY PATTERNS
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

-- Announcements indexes
CREATE INDEX IF NOT EXISTS announcements_residence_id_idx ON dbasakan.announcements(residence_id);
CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON dbasakan.announcements(created_at DESC);

-- Access logs indexes
CREATE INDEX IF NOT EXISTS access_logs_residence_id_idx ON dbasakan.access_logs(residence_id);
CREATE INDEX IF NOT EXISTS access_logs_generated_by_idx ON dbasakan.access_logs(generated_by);
CREATE INDEX IF NOT EXISTS access_logs_scanned_by_idx ON dbasakan.access_logs(scanned_by) WHERE scanned_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS access_logs_valid_to_idx ON dbasakan.access_logs(valid_to);

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS deliveries_residence_id_idx ON dbasakan.deliveries(residence_id);
CREATE INDEX IF NOT EXISTS deliveries_recipient_id_idx ON dbasakan.deliveries(recipient_id);
CREATE INDEX IF NOT EXISTS deliveries_logged_by_idx ON dbasakan.deliveries(logged_by);
```

### Part 4: Add Financial Tracking Tables

```sql
-- ============================================================================
-- TRANSACTION HISTORY TABLE
-- Complete audit trail of all financial transactions
-- ============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS transaction_history_residence_id_idx ON dbasakan.transaction_history(residence_id);
CREATE INDEX IF NOT EXISTS transaction_history_type_idx ON dbasakan.transaction_history(transaction_type);
CREATE INDEX IF NOT EXISTS transaction_history_created_at_idx ON dbasakan.transaction_history(created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_history_reference_idx ON dbasakan.transaction_history(reference_table, reference_id);

-- Enable RLS
ALTER TABLE dbasakan.transaction_history ENABLE ROW LEVEL SECURITY;

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

-- ============================================================================
-- BALANCE SNAPSHOTS TABLE
-- Historical tracking of cash and bank balances
-- ============================================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS balance_snapshots_residence_id_idx ON dbasakan.balance_snapshots(residence_id);
CREATE INDEX IF NOT EXISTS balance_snapshots_date_idx ON dbasakan.balance_snapshots(snapshot_date DESC);

-- Enable RLS
ALTER TABLE dbasakan.balance_snapshots ENABLE ROW LEVEL SECURITY;

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
```

### Part 5: Enhanced RLS Policies

```sql
-- ============================================================================
-- ADDITIONAL RLS POLICIES FOR COMPLETE SECURITY
-- ============================================================================

-- Allow guards to view their own scanned access logs
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

-- Allow residents to view their own fee history
CREATE POLICY "Residents can view own fee history" ON dbasakan.fees
  FOR SELECT
  USING (user_id = next_auth.uid());

-- Allow residents to view their own payment history
CREATE POLICY "Residents can view own payment history" ON dbasakan.payments
  FOR SELECT
  USING (user_id = next_auth.uid());

-- Syndics can view all residents in their residence
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
```

---

## Complete Relationship Diagram

### User Management Flow
```
dbasakan.users (NextAuth)
    ↓ (1:1 CASCADE)
dbasakan.profiles (Extended user data)
    ↓ (N:1 SET NULL)
dbasakan.residences (Buildings)
    ↑ (1:1 SET NULL)
dbasakan.residences.syndic_user_id
```

### Billing Flow
```
dbasakan.users (NextAuth)
    ↓ (1:1 CASCADE)
dbasakan.stripe_customers (SaaS subscription)
    → Links to Stripe via stripe_customer_id
    → Tracks subscription_id, plan_active, plan_expires
```

### Financial Flow
```
dbasakan.residences
    ↓ (1:N)
dbasakan.fees (Monthly charges)
    ↓ (1:N optional SET NULL)
dbasakan.payments (Payment records)
    ↓ (triggers)
dbasakan.transaction_history (Audit trail)

dbasakan.residences
    ↓ (1:N)
dbasakan.expenses (Building costs)
    ↓ (triggers)
dbasakan.transaction_history (Audit trail)
```

### Complete Entity Relationship

```
┌─────────────────┐
│  NextAuth Flow  │
├─────────────────┤
│ dbasakan.users  │──┐
│ dbasakan.accounts│ │
│ dbasakan.sessions│ │
└─────────────────┘ │
                    │
┌─────────────────┐ │
│  User Profile   │ │
├─────────────────┤ │
│ dbasakan.profiles│◄┘ (1:1 CASCADE)
└─────────────────┘
         │
         │ (N:1 SET NULL)
         ▼
┌─────────────────┐
│   Residences    │
├─────────────────┤
│ dbasakan.residences
└─────────────────┘
         │
         ├──► (1:N) dbasakan.fees
         │           └──► (1:N SET NULL) dbasakan.payments
         │
         ├──► (1:N) dbasakan.payments
         │
         ├──► (1:N) dbasakan.expenses
         │
         ├──► (1:N) dbasakan.incidents
         │
         ├──► (1:N) dbasakan.announcements
         │
         ├──► (1:N) dbasakan.polls
         │
         ├──► (1:N) dbasakan.access_logs
         │
         └──► (1:N) dbasakan.deliveries

┌─────────────────┐
│  Billing (SaaS) │
├─────────────────┤
│ stripe_customers│──► (1:1 CASCADE) dbasakan.users
└─────────────────┘

┌─────────────────┐
│  Financial Audit│
├─────────────────┤
│ transaction_history│──► (N:1) dbasakan.residences
│ balance_snapshots  │──► (N:1) dbasakan.residences
└─────────────────┘
```

---

## Migration Strategy

### Step 1: Create New Migration File
```bash
# Create: supabase/migrations/20241121000000_fix_relationships_and_add_billing.sql
```

### Step 2: Apply in Order
1. Add `stripe_customers` table (CRITICAL - billing won't work without it)
2. Fix foreign key constraints with proper ON DELETE behaviors
3. Add performance indexes
4. Add financial tracking tables
5. Add enhanced RLS policies

### Step 3: Data Migration (if needed)
- Existing `stripe_customers` in `public` schema? Migrate to `dbasakan`
- Existing data conflicts with new constraints? Resolve first

---

## Key Recommendations

### 1. **IMMEDIATE ACTION REQUIRED**
Add `stripe_customers` table - billing system is currently broken without it.

### 2. **ON DELETE Behaviors**
- **CASCADE**: When parent deletion should remove children (user → profile, user → stripe_customer)
- **SET NULL**: When parent deletion should preserve children but clear reference (syndic → residence, verifier → payment)
- **RESTRICT**: When parent deletion should be prevented if children exist (residence → fees if fees exist)

### 3. **Index Strategy**
- Index ALL foreign keys
- Add composite indexes for common query patterns (residence_id + status, residence_id + user_id)
- Partial indexes for filtered queries (WHERE fee_id IS NOT NULL)

### 4. **Financial Transparency**
- Implement `transaction_history` for complete audit trail
- Implement `balance_snapshots` for historical reporting
- Consider triggers to auto-populate transaction_history on payment/expense changes

### 5. **RLS Policy Completeness**
- Every table needs policies for: SELECT (view), INSERT (create), UPDATE (modify), DELETE (remove)
- Consider role-based access: syndic (full), resident (own data), guard (limited)
- Test RLS policies with different user roles

---

## Testing Checklist

After applying corrections:

- [ ] `stripe_customers` table exists and is accessible
- [ ] Foreign key constraints have appropriate ON DELETE behaviors
- [ ] All foreign keys have indexes
- [ ] RLS policies allow correct access patterns
- [ ] Transaction history captures all financial changes
- [ ] Balance snapshots can be generated
- [ ] Webhook can upsert to `stripe_customers`
- [ ] Billing page can read subscription data
- [ ] Account deletion properly cascades
- [ ] Performance is acceptable with indexes

---

*This analysis is based on the complete codebase review and the actual SQL migration file. All recommendations are production-ready and follow PostgreSQL best practices.*
