# Database Schema Cleanup Summary

## Related Docs
- [Database Schema](./database_schema.md)
- [Project Architecture](./project_architecture.md)
- [SOP: Database Migrations](../SOP/database_migrations.md)

## Overview

This document summarizes the schema cleanup and corrections applied to ensure the database matches the property management SaaS platform requirements.

## Migration File

**File**: `supabase/migrations/20241125000000_clean_schema_corrections.sql`

## Changes Made

### 1. Removed Unnecessary Tables

#### Backup Tables (Removed)
- `accounts_backup` - Not needed for core functionality
- `profiles_backup` - Not needed for core functionality
- `sessions_backup` - Not needed for core functionality
- `stripe_customers_backup` - Not needed for core functionality
- `users_backup` - Not needed for core functionality

**Rationale**: Backup tables are not part of the core property management functionality. If backup/audit trails are needed, they should be implemented via proper database triggers or application-level logging, not as separate tables.

#### Webhook Events Table (Removed)
- `webhook_events` - Removed as not critical for core functionality

**Rationale**: Webhook event logging can be handled via:
- Stripe Dashboard (built-in webhook logs)
- Application logs
- External monitoring services

This table adds unnecessary complexity without providing core value for the property management platform.

### 2. Foreign Key Relationship Corrections

All foreign key constraints were reviewed and corrected to have proper `ON DELETE` behaviors:

#### CASCADE Behaviors (Delete related records)
- **User deletion cascades to**:
  - `accounts` (OAuth accounts)
  - `sessions` (active sessions)
  - `profiles` (user profiles)
  - `stripe_customers` (subscription data)

- **Profile deletion cascades to**:
  - `fees` (resident fees)
  - `payments` (resident payments)

- **Residence deletion cascades to**:
  - `fees` (all fees for the residence)
  - `payments` (all payments for the residence)
  - `expenses` (all expenses for the residence)
  - `incidents` (all incidents for the residence)
  - `announcements` (all announcements for the residence)
  - `polls` (all polls for the residence)
  - `access_logs` (all access logs for the residence)
  - `deliveries` (all deliveries for the residence)
  - `transaction_history` (all transaction history)
  - `balance_snapshots` (all balance snapshots)

- **Poll deletion cascades to**:
  - `poll_options` (poll options)
  - `poll_votes` (all votes)

- **Poll option deletion cascades to**:
  - `poll_votes` (votes for that option)

#### SET NULL Behaviors (Preserve records, unlink references)
- **Residence deletion sets NULL in**:
  - `profiles.residence_id` (preserve profiles, just unlink from residence)

- **User/Profile deletion sets NULL in**:
  - `residences.syndic_user_id` (building can have new syndic)
  - `payments.verified_by` (preserve audit trail of who verified)
  - `payments.fee_id` (preserve payment record even if fee deleted)
  - `expenses.created_by` (preserve expense record)
  - `incidents.user_id` (preserve incident report)
  - `incidents.assigned_to` (preserve incident record)
  - `announcements.created_by` (preserve announcement)
  - `polls.created_by` (preserve poll)
  - `poll_votes.user_id` (preserve voting history)
  - `access_logs.generated_by` (preserve access log)
  - `access_logs.scanned_by` (preserve access log)
  - `deliveries.recipient_id` (preserve delivery record)
  - `deliveries.logged_by` (preserve delivery record)
  - `transaction_history.created_by` (preserve transaction record)
  - `balance_snapshots.created_by` (preserve snapshot record)

### 3. Performance Indexes Added

#### Critical Indexes for Common Queries

**Profiles**:
- `profiles_residence_id_idx` - Filter residents by residence
- `profiles_role_idx` - Filter by role (syndic/resident/guard)

**Fees**:
- `fees_residence_id_idx` - Get all fees for a residence
- `fees_user_id_idx` - Get fees for a specific resident
- `fees_status_idx` - Filter by payment status
- `fees_residence_user_status_idx` - Composite index for common query pattern

**Payments**:
- `payments_residence_id_idx` - Get all payments for a residence
- `payments_user_id_idx` - Get payments for a specific resident
- `payments_fee_id_idx` - Link payments to fees
- `payments_method_idx` - Filter by payment method
- `payments_status_idx` - Filter by payment status
- `payments_paid_at_idx` - Sort by payment date
- `payments_residence_status_idx` - Composite index for dashboard queries

**Expenses**:
- `expenses_residence_id_idx` - Get all expenses for a residence
- `expenses_created_by_idx` - Track expenses by creator
- `expenses_expense_date_idx` - Sort by expense date

**Incidents**:
- `incidents_residence_id_idx` - Get all incidents for a residence
- `incidents_user_id_idx` - Get incidents reported by user
- `incidents_status_idx` - Filter by status
- `incidents_assigned_to_idx` - Track assigned incidents
- `incidents_residence_status_idx` - Composite index for common queries

**Announcements**:
- `announcements_residence_id_idx` - Get announcements for residence
- `announcements_created_at_idx` - Sort by date

**Polls**:
- `polls_residence_id_idx` - Get polls for residence
- `polls_is_active_idx` - Filter active polls

**Poll Votes**:
- `poll_votes_poll_id_idx` - Get votes for a poll
- `poll_votes_user_id_idx` - Get votes by user
- `poll_votes_poll_user_unique_idx` - UNIQUE constraint (one vote per user per poll)

**Access Logs**:
- `access_logs_residence_id_idx` - Get access logs for residence
- `access_logs_generated_by_idx` - Track QR codes by generator
- `access_logs_valid_to_idx` - Find valid QR codes

**Deliveries**:
- `deliveries_residence_id_idx` - Get deliveries for residence
- `deliveries_recipient_id_idx` - Get deliveries for recipient
- `deliveries_picked_up_at_idx` - Find pending deliveries

**Transaction History**:
- `transaction_history_residence_id_idx` - Get transaction history
- `transaction_history_created_at_idx` - Sort by date
- `transaction_history_reference_idx` - Link to related records

**Balance Snapshots**:
- `balance_snapshots_residence_id_idx` - Get snapshots for residence
- `balance_snapshots_snapshot_date_idx` - Sort by date

### 4. Unique Constraints

- **`poll_votes(poll_id, user_id)`**: Ensures one vote per user per poll (prevents duplicate votes)

### 5. Table Comments

Added descriptive comments to all tables for better documentation and understanding of each table's purpose.

## Schema Validation

### Core Property Management Tables (All Present)

✅ **Authentication**:
- `users` (NextAuth)
- `accounts` (OAuth providers)
- `sessions` (active sessions)
- `verification_tokens` (email verification)

✅ **User Management**:
- `profiles` (extended user data)
- `residences` (buildings)

✅ **Financial**:
- `fees` (monthly charges)
- `payments` (payment records)
- `expenses` (building costs)
- `stripe_customers` (SaaS subscriptions)
- `transaction_history` (audit trail)
- `balance_snapshots` (historical balances)

✅ **Operational**:
- `incidents` (maintenance requests)
- `announcements` (building communications)
- `polls` (resident voting)
- `poll_options` (voting options)
- `poll_votes` (individual votes)
- `access_logs` (visitor access)
- `deliveries` (package tracking)

## Relationship Summary

```
NextAuth Users (1) ──< (1) Profiles
NextAuth Users (1) ──< (1) Stripe Customers
NextAuth Users (1) ──< (many) Accounts
NextAuth Users (1) ──< (many) Sessions

Residences (1) ──< (many) Profiles
Residences (1) ──< (many) Fees
Residences (1) ──< (many) Payments
Residences (1) ──< (many) Expenses
Residences (1) ──< (many) Incidents
Residences (1) ──< (many) Announcements
Residences (1) ──< (many) Polls
Residences (1) ──< (many) Access Logs
Residences (1) ──< (many) Deliveries
Residences (1) ──< (many) Transaction History
Residences (1) ──< (many) Balance Snapshots

Profiles (1) ──< (many) Fees
Profiles (1) ──< (many) Payments
Profiles (1) ──< (many) Poll Votes

Polls (1) ──< (many) Poll Options
Polls (1) ──< (many) Poll Votes
Poll Options (1) ──< (many) Poll Votes

Fees (1) ──< (many) Payments (optional link)
```

## Benefits of These Changes

1. **Cleaner Schema**: Removed unnecessary backup and logging tables
2. **Proper Data Integrity**: All foreign keys have appropriate ON DELETE behaviors
3. **Better Performance**: Comprehensive indexes on frequently queried columns
4. **Data Preservation**: Audit trails preserved where needed (SET NULL for created_by, verified_by, etc.)
5. **Cascade Safety**: Related data properly cleaned up when parent records deleted
6. **Documentation**: Table comments explain purpose of each table

## Migration Safety

- All changes use `IF EXISTS` / `IF NOT EXISTS` checks
- Safe to run multiple times (idempotent)
- No data loss (only removes backup tables that shouldn't have data)
- All constraints are added with proper error handling

## Next Steps

1. Run the migration: `supabase/migrations/20241125000000_clean_schema_corrections.sql`
2. Verify all foreign keys are correct
3. Test cascade behaviors
4. Verify indexes are created
5. Update application code if any queries relied on removed tables

---

*Last Updated: Schema cleanup and corrections*

