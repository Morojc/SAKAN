# SQL Relationship Corrections - Quick Reference Summary

## Critical Issues Fixed

### 1. **MISSING `stripe_customers` Table** ⚠️ CRITICAL
**Problem**: Table used extensively in code but completely missing from migration  
**Impact**: Billing system cannot function  
**Fix**: Added complete table with proper indexes and RLS policies

### 2. **Inconsistent Foreign Key Behaviors**
**Problem**: Missing or incorrect `ON DELETE` behaviors  
**Fixes Applied**:
- `residences.syndic_user_id` → `ON DELETE SET NULL` (building can have new syndic)
- `fees.user_id` → `ON DELETE CASCADE` (remove fees when resident leaves)
- `payments.verified_by` → `ON DELETE SET NULL` (preserve audit trail)
- `payments.fee_id` → `ON DELETE SET NULL` (keep payment record)
- All `residence_id` FKs → `ON DELETE CASCADE` (clean up when building deleted)

### 3. **Missing Performance Indexes**
**Problem**: No indexes on foreign keys causing slow queries  
**Fix**: Added 40+ indexes on:
- All foreign key columns
- Common query patterns (residence_id + status, residence_id + user_id)
- Partial indexes for filtered queries

### 4. **Incomplete Financial Tracking**
**Problem**: No audit trail or historical balance tracking  
**Fix**: Added:
- `transaction_history` - Complete audit trail
- `balance_snapshots` - Historical balance tracking

---

## Complete Relationship Map

### User Management Chain
```
dbasakan.users (NextAuth auth)
    ↓ 1:1 CASCADE
dbasakan.profiles (Extended user data)
    ↓ N:1 SET NULL
dbasakan.residences (Buildings)
    ↑ 1:1 SET NULL (syndic_user_id)
```

### Billing Chain
```
dbasakan.users (NextAuth)
    ↓ 1:1 CASCADE
dbasakan.stripe_customers (SaaS subscription)
    → Links to Stripe via stripe_customer_id
```

### Financial Chain
```
dbasakan.residences
    ↓ 1:N CASCADE
dbasakan.fees (Monthly charges)
    ↓ 1:N SET NULL (optional link)
dbasakan.payments (Payment records)
    ↓ triggers
dbasakan.transaction_history (Audit)

dbasakan.residences
    ↓ 1:N CASCADE
dbasakan.expenses (Building costs)
    ↓ triggers
dbasakan.transaction_history (Audit)
```

---

## ON DELETE Behavior Decisions

| Relationship | ON DELETE | Reasoning |
|-------------|-----------|-----------|
| `users → profiles` | CASCADE | Profile is extension of user |
| `users → stripe_customers` | CASCADE | Subscription tied to user |
| `users → residences.syndic_user_id` | SET NULL | Building can get new syndic |
| `profiles → fees` | CASCADE | Remove fees when resident leaves |
| `profiles → payments` | CASCADE | Remove payments when resident leaves |
| `profiles → payments.verified_by` | SET NULL | Preserve who verified |
| `profiles → expenses.created_by` | SET NULL | Preserve who created |
| `fees → payments.fee_id` | SET NULL | Keep payment, clear link |
| `residences → *` | CASCADE | Clean up all data when building deleted |

---

## Migration File

**File**: `supabase/migrations/20241121000000_fix_relationships_and_add_billing.sql`

**Apply Order**:
1. Run the new migration file
2. Verify `stripe_customers` table exists
3. Test foreign key constraints
4. Verify indexes are created
5. Test RLS policies

**Testing**:
```sql
-- Verify stripe_customers exists
SELECT * FROM dbasakan.stripe_customers LIMIT 1;

-- Check foreign key constraints
SELECT conname, confdeltype 
FROM pg_constraint 
WHERE conrelid = 'dbasakan.residences'::regclass;

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'dbasakan' 
AND tablename = 'payments';
```

---

## Key Takeaways

1. **`stripe_customers` is CRITICAL** - Billing won't work without it
2. **CASCADE** for dependent data (user → profile, residence → fees)
3. **SET NULL** for audit trails (who verified, who created)
4. **Index everything** - Foreign keys, common queries, filtered patterns
5. **Financial transparency** - Transaction history and balance snapshots essential

See full analysis in `sql_schema_analysis_and_recommendations.md`
