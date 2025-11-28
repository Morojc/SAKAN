# SAKAN Project - Complete Database Analysis

## Executive Summary

This document provides a comprehensive analysis of all database tables and functions used in the SAKAN property management system. The project uses **PostgreSQL (Supabase)** with a custom schema `dbasakan` (separate from `public` and `auth` schemas).

**Database Schema**: `dbasakan`  
**Database Type**: PostgreSQL (Supabase)  
**Authentication**: NextAuth.js (not Supabase Auth)

---

## Database Tables

### 1. NextAuth Authentication Tables

These tables are managed by NextAuth.js for authentication and session management:

#### `dbasakan.users`
- **Purpose**: NextAuth user records (base user identity from OAuth providers)
- **Key Columns**: 
  - `id` (TEXT, PK) - User ID from NextAuth
  - `name` (TEXT)
  - `email` (TEXT, UNIQUE)
  - `emailVerified` (TIMESTAMPTZ)
  - `image` (TEXT)
  - `createdAt` (TIMESTAMPTZ)
- **Used In**: All authentication flows, profile lookups, user management

#### `dbasakan.accounts`
- **Purpose**: OAuth provider accounts linked to NextAuth users
- **Key Columns**:
  - `id` (UUID, PK)
  - `userId` (TEXT, FK → users.id)
  - `type` (TEXT)
  - `provider` (TEXT) - e.g., 'google'
  - `providerAccountId` (TEXT)
  - `refresh_token`, `access_token`, `expires_at`, etc.
- **Used In**: OAuth sign-in flows, account linking

#### `dbasakan.sessions`
- **Purpose**: Active user sessions managed by NextAuth
- **Key Columns**:
  - `id` (UUID, PK)
  - `sessionToken` (TEXT, UNIQUE)
  - `userId` (TEXT, FK → users.id)
  - `expires` (TIMESTAMPTZ)
- **Used In**: Session management, authentication checks

#### `dbasakan.verification_tokens`
- **Purpose**: Verification tokens for email verification and magic links
- **Key Columns**:
  - `identifier` (TEXT, PK)
  - `token` (TEXT, UNIQUE)
  - `expires` (TIMESTAMPTZ)
- **Used In**: Email verification flows

---

### 2. Application Core Tables

#### `dbasakan.profiles`
- **Purpose**: Extended user profiles (1:1 with NextAuth users)
- **Key Columns**:
  - `id` (TEXT, PK, FK → users.id)
  - `created_at` (TIMESTAMPTZ)
  - `residence_id` (BIGINT, FK → residences.id, nullable)
  - `full_name` (TEXT)
  - `apartment_number` (TEXT)
  - `phone_number` (TEXT)
  - `role` (user_role ENUM: 'syndic', 'resident', 'guard')
  - `onboarding_completed` (BOOLEAN, default: false)
  - `verified` (BOOLEAN, default: false)
  - `verification_token` (TEXT, UNIQUE)
  - `verification_token_expires_at` (TIMESTAMPTZ)
- **Used In**: User profile management, role-based access control, resident verification
- **Code References**: 
  - `app/actions/dashboard.ts`
  - `app/app/residents/actions.ts`
  - `lib/auth.config.ts`
  - `app/api/profile/route.ts`
  - All authentication and profile-related code

#### `dbasakan.residences`
- **Purpose**: Residential buildings/complexes managed in the system
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `created_at` (TIMESTAMPTZ)
  - `name` (TEXT, NOT NULL)
  - `address` (TEXT, NOT NULL)
  - `city` (TEXT, NOT NULL)
  - `bank_account_rib` (TEXT)
  - `syndic_user_id` (TEXT, FK → users.id, nullable)
- **Used In**: Residence management, onboarding, dashboard
- **Code References**:
  - `app/app/onboarding/actions.ts`
  - `app/app/residences/page.tsx`
  - `lib/utils/account-transfer.ts`

---

### 3. Financial Management Tables

#### `dbasakan.fees`
- **Purpose**: Monthly or periodic fees (Appels de fonds) charged to residents
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `user_id` (TEXT, FK → profiles.id, NOT NULL)
  - `title` (TEXT, NOT NULL) - e.g., "Frais de Mars 2024"
  - `amount` (NUMERIC(10,2), NOT NULL)
  - `due_date` (DATE, NOT NULL)
  - `status` (TEXT, default: 'unpaid')
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Fee management, payment tracking, dashboard statistics
- **Code References**:
  - `app/app/residents/fee-actions.ts`
  - `app/actions/dashboard.ts`
  - `app/actions/payments.ts`

#### `dbasakan.payments`
- **Purpose**: Payment records for fees (supports multiple payment methods)
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `user_id` (TEXT, FK → profiles.id, NOT NULL)
  - `fee_id` (BIGINT, FK → fees.id, nullable) - Optional link to specific fee
  - `amount` (NUMERIC(10,2), NOT NULL)
  - `method` (payment_method ENUM: 'cash', 'bank_transfer', 'online_card', 'check')
  - `status` (payment_status ENUM: 'pending', 'completed', 'rejected', default: 'pending')
  - `proof_url` (TEXT) - Receipt image URL
  - `paid_at` (TIMESTAMPTZ, default: now())
  - `verified_by` (TEXT, FK → profiles.id, nullable) - Syndic who confirmed cash payment
- **Used In**: Payment processing, balance calculations, financial reporting
- **Code References**:
  - `app/actions/payments.ts`
  - `app/api/payments/route.ts`
  - `app/actions/dashboard.ts`

#### `dbasakan.expenses`
- **Purpose**: Building maintenance and operational expenses logged by syndics
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `description` (TEXT, NOT NULL)
  - `category` (TEXT, NOT NULL) - e.g., 'Electricity', 'Cleaning'
  - `amount` (NUMERIC(10,2), NOT NULL)
  - `attachment_url` (TEXT) - Invoice image
  - `expense_date` (DATE, NOT NULL)
  - `created_by` (TEXT, FK → profiles.id, nullable)
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Expense tracking, financial reporting, balance calculations
- **Code References**:
  - `app/actions/payments.ts`

#### `dbasakan.transaction_history`
- **Purpose**: Complete audit trail of all financial transactions
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `transaction_type` (TEXT, NOT NULL) - 'payment', 'expense', 'fee_generated', 'refund'
  - `reference_id` (BIGINT) - ID of related payment, expense, or fee
  - `reference_table` (TEXT) - 'payments', 'expenses', 'fees'
  - `amount` (NUMERIC(10,2), NOT NULL)
  - `balance_after` (NUMERIC(10,2)) - Running balance after transaction
  - `method` (TEXT) - Payment method for payments
  - `description` (TEXT)
  - `created_by` (TEXT, FK → profiles.id, nullable)
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Financial audit trail, transaction reporting
- **Note**: Created in migration but may not be actively used in code yet

#### `dbasakan.balance_snapshots`
- **Purpose**: Historical snapshots of cash and bank balances for financial reporting
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `snapshot_date` (DATE, NOT NULL)
  - `cash_balance` (NUMERIC(10,2), default: 0)
  - `bank_balance` (NUMERIC(10,2), default: 0)
  - `notes` (TEXT)
  - `created_by` (TEXT, FK → profiles.id, nullable)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE(residence_id, snapshot_date)
- **Used In**: Financial reporting, balance tracking
- **Note**: Created in migration but may not be actively used in code yet

---

### 4. Incident & Communication Tables

#### `dbasakan.incidents`
- **Purpose**: Maintenance requests and incident reports from residents
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `user_id` (TEXT, FK → profiles.id, NOT NULL) - Who reported it
  - `title` (TEXT, NOT NULL)
  - `description` (TEXT, NOT NULL)
  - `photo_url` (TEXT)
  - `status` (incident_status ENUM: 'open', 'in_progress', 'resolved', 'closed', default: 'open')
  - `assigned_to` (TEXT, FK → profiles.id, nullable) - Technician or Guard
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **Used In**: Incident management, dashboard statistics
- **Code References**:
  - `app/actions/dashboard.ts`

#### `dbasakan.announcements`
- **Purpose**: Building-wide announcements and notices posted by syndics
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `title` (TEXT, NOT NULL)
  - `content` (TEXT, NOT NULL)
  - `attachment_url` (TEXT)
  - `created_by` (TEXT, FK → profiles.id, nullable)
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Announcement management, dashboard statistics
- **Code References**:
  - `app/actions/dashboard.ts`

---

### 5. Polling System Tables

#### `dbasakan.polls`
- **Purpose**: Resident voting polls for building decisions
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `question` (TEXT, NOT NULL)
  - `is_active` (BOOLEAN, default: true)
  - `created_by` (TEXT, FK → profiles.id, nullable)
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Poll management, resident voting

#### `dbasakan.poll_options`
- **Purpose**: Voting options for polls
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `poll_id` (BIGINT, FK → polls.id, CASCADE DELETE, NOT NULL)
  - `option_text` (TEXT, NOT NULL)
- **Used In**: Poll option management

#### `dbasakan.poll_votes`
- **Purpose**: Individual votes cast by residents on poll options
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `poll_id` (BIGINT, FK → polls.id, CASCADE DELETE, NOT NULL)
  - `option_id` (BIGINT, FK → poll_options.id, CASCADE DELETE, NOT NULL)
  - `user_id` (TEXT, FK → profiles.id, NOT NULL)
  - `created_at` (TIMESTAMPTZ)
  - UNIQUE(poll_id, user_id) - Ensures one vote per user per poll
- **Used In**: Vote tracking, poll results

---

### 6. Access & Delivery Tables

#### `dbasakan.access_logs`
- **Purpose**: QR code-based visitor access logs (tracks visitor entry/exit)
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `generated_by` (TEXT, FK → profiles.id, NOT NULL) - Resident who generated QR
  - `visitor_name` (TEXT, NOT NULL)
  - `qr_code_data` (TEXT, NOT NULL) - The secret hash in the QR
  - `valid_from` (TIMESTAMPTZ, NOT NULL)
  - `valid_to` (TIMESTAMPTZ, NOT NULL)
  - `scanned_at` (TIMESTAMPTZ, nullable) - Null until used
  - `scanned_by` (TEXT, FK → profiles.id, nullable) - Guard who scanned it
- **Used In**: Visitor access management, QR code generation

#### `dbasakan.deliveries`
- **Purpose**: Package and delivery tracking for residents
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `residence_id` (BIGINT, FK → residences.id, NOT NULL)
  - `recipient_id` (TEXT, FK → profiles.id, NOT NULL) - Resident
  - `logged_by` (TEXT, FK → profiles.id, NOT NULL) - Guard
  - `description` (TEXT, NOT NULL) - "Amazon Package", "Food"
  - `picked_up_at` (TIMESTAMPTZ, nullable)
  - `created_at` (TIMESTAMPTZ)
- **Used In**: Delivery tracking, package management

---

### 7. Access Codes Table (Account Transfer/Replacement)

#### `dbasakan.access_codes`
- **Purpose**: Access codes for syndic replacement flow and resident verification
- **Key Columns**:
  - `id` (BIGINT, PK, Identity)
  - `code` (TEXT, UNIQUE, NOT NULL) - 6-8 digit alphanumeric code
  - `original_user_id` (TEXT, FK → profiles.id, CASCADE DELETE, NOT NULL)
  - `replacement_email` (TEXT, NOT NULL) - Email of replacement resident
  - `residence_id` (BIGINT, FK → residences.id, nullable) - Can be NULL for verify_resident codes
  - `action_type` (TEXT, NOT NULL) - 'delete_account', 'change_role', 'verify_resident'
  - `code_used` (BOOLEAN, default: false)
  - `used_by_user_id` (TEXT, FK → profiles.id, nullable) - Set when code is used
  - `expires_at` (TIMESTAMPTZ, NOT NULL) - 7 days from creation
  - `created_at` (TIMESTAMPTZ)
  - `used_at` (TIMESTAMPTZ, nullable)
- **Used In**: Account transfer, resident replacement, resident verification
- **Code References**:
  - `lib/utils/access-code.ts`
  - `app/api/account/validate-code/route.ts`
  - `app/api/account/cancel-code/route.ts`
  - `app/api/residents/validate-code/route.ts`

---

### 8. Billing/Subscription Tables

#### `dbasakan.stripe_customers`
- **Purpose**: Links NextAuth users to Stripe subscriptions for SaaS billing
- **Key Columns**:
  - `id` (UUID, PK)
  - `user_id` (TEXT, FK → users.id, CASCADE DELETE, NOT NULL)
  - `stripe_customer_id` (TEXT, UNIQUE, NOT NULL)
  - `subscription_id` (TEXT, nullable)
  - `plan_active` (BOOLEAN, default: false)
  - `plan_expires` (BIGINT) - Unix timestamp in milliseconds
  - `plan_name` (TEXT) - Human-readable plan name (e.g., Basic, Pro)
  - `price_id` (TEXT) - Stripe price ID
  - `amount` (NUMERIC(10,2)) - Subscription amount
  - `currency` (TEXT, default: 'usd')
  - `interval` (TEXT) - Billing interval (month, year)
  - `subscription_status` (TEXT) - Stripe subscription status
  - `days_remaining` (INTEGER) - Calculated from plan_expires
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **Used In**: Subscription management, billing, Stripe webhooks
- **Code References**:
  - `app/api/webhook/stripe/route.ts`
  - `lib/stripe/services/customer.service.ts`
  - `app/api/(payment)/checkout/route.ts`
  - `app/api/account/delete/route.ts`

---

### 9. Legacy/Unused Tables (in database.types.ts but not in migrations)

#### `public.notes`
- **Purpose**: Notes/tasks (appears to be a legacy table from template)
- **Key Columns**: `id`, `title`, `content`, `user_id`
- **Status**: Referenced in `types/database.types.ts` and `app/app/notes/` but may be legacy
- **Code References**:
  - `app/app/notes/page.tsx`
  - `app/app/notes/actions.ts`

#### Other legacy tables in `database.types.ts`:
- `public.blogs`
- `public.instruments`
- `public.planets`
- `public.posts`
- `public.users_clerk`

**Note**: These appear to be from a template and may not be actively used in the SAKAN application.

---

## Database Functions (RPC Functions)

### 1. Authentication & User Management Functions

#### `next_auth.uid()`
- **Purpose**: Extracts user ID from JWT token provided by NextAuth
- **Returns**: TEXT (user ID)
- **Used In**: All RLS policies for access control
- **Location**: `supabase/migrations/20241120000000_nextauth_schema.sql`

---

### 2. Profile Management Functions

#### `dbasakan.create_profile_on_user_insert()`
- **Purpose**: Automatically creates a profile record when a new user is inserted into `dbasakan.users`
- **Returns**: TRIGGER
- **Behavior**: Creates profile with default role 'syndic' and `onboarding_completed = false`
- **Location**: 
  - `supabase/migrations/20241122000000_create_profile_trigger.sql`
  - `supabase/migrations/20250101000000_add_onboarding_and_syndic_default.sql`

#### `dbasakan.create_profile_if_missing()`
- **Purpose**: Fallback trigger to create profile if it doesn't exist (safety net)
- **Returns**: TRIGGER
- **Behavior**: Preserves existing profiles, doesn't overwrite verified status
- **Location**: 
  - `supabase/migrations/20251123020000_add_profile_fallback_trigger.sql`
  - `supabase/migrations/20250124010000_update_profile_trigger_for_verification.sql`

---

### 3. Access Code Functions

#### `dbasakan.create_access_code(p_code, p_original_user_id, p_replacement_email, p_residence_id, p_action_type, p_expires_at)`
- **Purpose**: Creates an access code, bypassing RLS policies
- **Parameters**:
  - `p_code` (TEXT) - The access code
  - `p_original_user_id` (TEXT) - User ID of the original account
  - `p_replacement_email` (TEXT) - Email of replacement resident
  - `p_residence_id` (BIGINT, nullable) - Residence ID (can be NULL for verify_resident)
  - `p_action_type` (TEXT) - 'delete_account', 'change_role', 'verify_resident'
  - `p_expires_at` (TIMESTAMPTZ) - Expiration timestamp
- **Returns**: `dbasakan.access_codes` record
- **Security**: SECURITY DEFINER (bypasses RLS)
- **Used In**: Account transfer, resident replacement, resident verification
- **Code References**:
  - `lib/utils/access-code.ts` (line 48)
- **Location**: 
  - `supabase/migrations/20251123013622_fix_access_code_permissions.sql`
  - `supabase/migrations/20250124020000_make_residence_id_nullable_for_verify_resident.sql`

#### `dbasakan.get_access_code_by_code(p_code)`
- **Purpose**: Fetches access code details by code string, bypassing RLS
- **Parameters**: `p_code` (TEXT) - The access code to look up
- **Returns**: SETOF `dbasakan.access_codes`
- **Security**: SECURITY DEFINER (bypasses RLS)
- **Used In**: Code validation, account transfer verification
- **Code References**:
  - `lib/utils/access-code.ts` (lines 124, 214)
  - `app/api/account/cancel-code/route.ts` (line 37)
- **Location**: `supabase/migrations/20251123023000_add_validate_code_rpc.sql`

#### `dbasakan.get_access_codes_by_email(p_email)`
- **Purpose**: Retrieves access codes by replacement email, bypassing RLS
- **Parameters**: `p_email` (TEXT) - Email address to search for
- **Returns**: SETOF `dbasakan.access_codes`
- **Security**: SECURITY DEFINER (bypasses RLS)
- **Used In**: Checking if user is a replacement email
- **Code References**:
  - `lib/utils/access-code.ts` (line 304)
- **Location**: `supabase/migrations/20250123020000_add_get_access_codes_by_email_rpc.sql`

#### `dbasakan.mark_access_code_as_used(p_code, p_used_by_user_id)`
- **Purpose**: Marks an access code as used, bypassing RLS
- **Parameters**:
  - `p_code` (TEXT) - The access code
  - `p_used_by_user_id` (TEXT) - User ID who used the code
- **Returns**: BOOLEAN (true if code was found and updated)
- **Security**: SECURITY DEFINER (bypasses RLS)
- **Used In**: Code usage tracking
- **Code References**:
  - `lib/utils/access-code.ts` (line 171)
- **Location**: `supabase/migrations/20250123030000_add_mark_access_code_as_used_rpc.sql`

#### `dbasakan.delete_access_code(p_code)`
- **Purpose**: Deletes an access code by code string, bypassing RLS
- **Parameters**: `p_code` (TEXT) - The access code to delete
- **Returns**: BOOLEAN (true if code was found and deleted)
- **Security**: SECURITY DEFINER (bypasses RLS)
- **Used In**: Cancelling access codes
- **Code References**:
  - `lib/utils/access-code.ts` (line 275)
- **Location**: `supabase/migrations/20250123010000_add_delete_access_code_rpc.sql`

#### `dbasakan.delete_used_access_code()`
- **Purpose**: Trigger function that automatically deletes access codes when `code_used` becomes true
- **Returns**: TRIGGER
- **Behavior**: Deletes the access code record when it's marked as used
- **Location**: `supabase/migrations/20250123040000_delete_used_access_codes_trigger.sql`

---

### 4. Stripe/Billing Functions

#### `dbasakan.calculate_days_remaining(expires_timestamp)`
- **Purpose**: Calculates days remaining from plan_expires timestamp (in milliseconds)
- **Parameters**: `expires_timestamp` (BIGINT) - Unix timestamp in milliseconds
- **Returns**: INTEGER (days remaining, never negative, NULL if invalid)
- **Used In**: Subscription status calculations
- **Location**: `supabase/migrations/20241123000000_enhance_stripe_customers_table.sql`

#### `dbasakan.update_stripe_customers_days_remaining()`
- **Purpose**: Trigger function to auto-update `days_remaining` when `plan_expires` changes
- **Returns**: TRIGGER
- **Behavior**: Recalculates days_remaining on INSERT or UPDATE of plan_expires
- **Location**: `supabase/migrations/20241123000000_enhance_stripe_customers_table.sql`

#### `dbasakan.refresh_stripe_customers_days_remaining()`
- **Purpose**: Updates days_remaining for all stripe_customers rows
- **Returns**: VOID
- **Used In**: Scheduled jobs (pg_cron) to keep days_remaining current
- **Location**: `supabase/migrations/20241123000000_enhance_stripe_customers_table.sql`

#### `dbasakan.update_stripe_customers_updated_at()`
- **Purpose**: Trigger function to auto-update `updated_at` timestamp
- **Returns**: TRIGGER
- **Behavior**: Sets updated_at to NOW() on UPDATE
- **Location**: `supabase/migrations/20241123000000_enhance_stripe_customers_table.sql`

---

### 5. Utility Functions

#### `dbasakan.drop_fk_constraint_if_exists(table_schema_name, table_name, column_name)`
- **Purpose**: Helper function to safely drop foreign key constraints
- **Parameters**:
  - `table_schema_name` (TEXT)
  - `table_name` (TEXT)
  - `column_name` (TEXT)
- **Returns**: VOID
- **Used In**: Migration scripts for idempotent constraint management
- **Location**: `supabase/migrations/20241125000000_clean_schema_corrections.sql`

---

## Database Enums

### `dbasakan.user_role`
- **Values**: 'syndic', 'resident', 'guard'
- **Used In**: `profiles.role` column
- **Purpose**: Defines user roles in the system

### `dbasakan.payment_method`
- **Values**: 'cash', 'bank_transfer', 'online_card', 'check'
- **Used In**: `payments.method` column
- **Purpose**: Payment method types

### `dbasakan.payment_status`
- **Values**: 'pending', 'completed', 'rejected'
- **Used In**: `payments.status` column
- **Purpose**: Payment status values

### `dbasakan.incident_status`
- **Values**: 'open', 'in_progress', 'resolved', 'closed'
- **Used In**: `incidents.status` column
- **Purpose**: Incident/ticket status values

---

## Table Usage Summary by Code Section

### Authentication & User Management
- `users` - User identity (NextAuth)
- `accounts` - OAuth provider accounts
- `sessions` - Active sessions
- `verification_tokens` - Email verification
- `profiles` - Extended user data

### Dashboard & Statistics
- `profiles` - User roles, residence info
- `users` - User email, name, image
- `fees` - Outstanding fees, fee amounts
- `payments` - Payment statistics
- `incidents` - Open incidents count
- `announcements` - Recent announcements count

### Payment & Financial Management
- `payments` - Payment records
- `fees` - Fee management
- `expenses` - Expense tracking
- `profiles` - User residence lookup
- `transaction_history` - Audit trail (defined but may not be actively used)
- `balance_snapshots` - Balance history (defined but may not be actively used)

### Resident Management
- `profiles` - Resident data, verification status
- `users` - User email, name
- `residences` - Residence information
- `fees` - Resident fees
- `access_codes` - Verification and transfer codes

### Account Transfer & Replacement
- `access_codes` - Transfer codes
- `profiles` - User roles, residence assignments
- `users` - User accounts
- `residences` - Residence ownership
- All related tables (fees, payments, incidents, etc.) - Data transfer

### Billing & Subscriptions
- `stripe_customers` - Subscription data
- `users` - User accounts
- `profiles` - User roles

### Incident & Communication
- `incidents` - Incident reports
- `announcements` - Building announcements
- `profiles` - User and assignee info
- `residences` - Residence context

---

## Key Relationships

```
users (1) ──< (1) profiles
users (1) ──< (1) stripe_customers
users (1) ──< (many) accounts
users (1) ──< (many) sessions

residences (1) ──< (many) profiles
residences (1) ──< (many) fees
residences (1) ──< (many) payments
residences (1) ──< (many) expenses
residences (1) ──< (many) incidents
residences (1) ──< (many) announcements
residences (1) ──< (many) polls
residences (1) ──< (many) access_logs
residences (1) ──< (many) deliveries
residences (1) ──< (many) transaction_history
residences (1) ──< (many) balance_snapshots

profiles (1) ──< (many) fees
profiles (1) ──< (many) payments
profiles (1) ──< (many) expenses (created_by)
profiles (1) ──< (many) incidents (user_id, assigned_to)
profiles (1) ──< (many) poll_votes
profiles (1) ──< (many) access_codes (original_user_id, used_by_user_id)
profiles (1) ──< (many) access_logs (generated_by, scanned_by)
profiles (1) ──< (many) deliveries (recipient_id, logged_by)

fees (1) ──< (many) payments (optional via fee_id)

polls (1) ──< (many) poll_options
polls (1) ──< (many) poll_votes
poll_options (1) ──< (many) poll_votes
```

---

## Migration Files Reference

1. `20241120000000_nextauth_schema.sql` - Base schema with NextAuth tables and core app tables
2. `20241121000000_fix_relationships_and_add_billing.sql` - Stripe customers, transaction history, balance snapshots
3. `20241122000000_create_profile_trigger.sql` - Profile creation trigger
4. `20241123000000_enhance_stripe_customers_table.sql` - Enhanced billing columns and functions
5. `20241125000000_clean_schema_corrections.sql` - Foreign key fixes, indexes, cleanup
6. `20250101000000_add_onboarding_and_syndic_default.sql` - Onboarding field, default role
7.  `20251123002849_add_access_codes_table.sql` - Access codes table
8.  `20251123013622_fix_access_code_permissions.sql` - Access code creation function
9.  `20251123020000_add_profile_fallback_trigger.sql` - Profile fallback trigger
10. `20251123023000_add_validate_code_rpc.sql` - Code validation function
11. `20250123010000_add_delete_access_code_rpc.sql` - Delete access code function
12. `20250123020000_add_get_access_codes_by_email_rpc.sql` - Get codes by email function
13. `20250123030000_add_mark_access_code_as_used_rpc.sql` - Mark code as used function
14. `20250123040000_delete_used_access_codes_trigger.sql` - Auto-delete used codes trigger
15. `20250124000000_add_resident_verification.sql` - Verification fields
16. `20250124010000_update_profile_trigger_for_verification.sql` - Updated profile trigger
17. `20250124020000_make_residence_id_nullable_for_verify_resident.sql` - Nullable residence_id for access codes

---

## Notes

1. **Schema Isolation**: All application tables are in the `dbasakan` schema, not `public`
2. **RLS Policies**: Row Level Security is enabled on all tables for access control
3. **NextAuth Integration**: Uses `next_auth.uid()` function for RLS, not `auth.uid()` (Supabase Auth)
4. **Service Role**: Service role has full access to NextAuth tables for authentication operations
5. **Cascade Behavior**: Most foreign keys use CASCADE DELETE for data cleanup, SET NULL for audit trails
6. **Indexes**: Extensive indexing on foreign keys and query patterns for performance
7. **Legacy Tables**: Some tables in `database.types.ts` (notes, blogs, etc.) appear to be from a template and may not be actively used

---

*This analysis was generated by deep-diving into all migration files, code references, and database usage patterns across the entire SAKAN project.*

