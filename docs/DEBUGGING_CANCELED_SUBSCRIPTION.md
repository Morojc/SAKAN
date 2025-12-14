# Debugging Canceled Subscription Alert

This guide helps you debug why the canceled subscription alert might not be showing.

---

## 🔍 Debug Checklist

### 1. Check Browser Console

Open browser DevTools (F12) and look for these logs:

```
[Profile API] Profile data fetched successfully
[Profile API] Cancellation status: {
  cancel_at_period_end: true,
  days_remaining: 23,
  plan_expires: 1710547199000
}
```

```
[BillingContent] Subscription data: {
  cancel_at_period_end: true,
  days_remaining: 23,
  plan_expires: 1710547199000,
  showAlert: true
}
```

---

### 2. Check Network Tab

**Request:** `GET /api/profile`

**Expected Response:**
```json
{
  "userData": { ... },
  "subscriptionData": {
    "subscription_id": "sub_xxx",
    "stripe_customer_id": "cus_xxx",
    "plan_active": true,
    "plan_expires": 1710547199000,
    "cancel_at": 1710547199000,
    "cancel_at_period_end": true,    ← MUST be true
    "canceled_at": 1708000000000,
    "days_remaining": 23              ← MUST NOT be null
  },
  "planName": "Pro",
  "planInterval": "month",
  "priceData": [...]
}
```

---

### 3. Common Issues & Solutions

#### Issue 1: Alert Not Showing (All Fields Present)

**Symptoms:**
- `cancel_at_period_end: true` ✓
- `days_remaining: 23` ✓
- `plan_expires: 1710547199000` ✓
- But alert still not visible

**Solution:**
Check if `CanceledSubscriptionAlert` component is imported correctly:

```tsx
import { CanceledSubscriptionAlert } from '@/components/stripe/CanceledSubscriptionAlert';
```

---

#### Issue 2: `days_remaining` is `null`

**Symptoms:**
```json
{
  "cancel_at_period_end": true,
  "days_remaining": null,  ← Problem!
  "plan_expires": 1710547199000
}
```

**Root Cause:**
Stripe subscription might not have `current_period_end` set.

**Solution:**
Check Stripe subscription object:

```bash
# In Stripe Dashboard or via CLI
stripe subscriptions retrieve sub_xxx
```

Look for:
```json
{
  "current_period_end": 1710547199,  ← Must exist
  "cancel_at_period_end": true
}
```

---

#### Issue 3: `cancel_at_period_end` is `false`

**Symptoms:**
```json
{
  "cancel_at_period_end": false,  ← Alert won't show
  "days_remaining": 23
}
```

**Root Cause:**
Subscription was not canceled, or was reactivated.

**Solution:**
1. Cancel subscription in Stripe billing portal
2. Verify in Stripe Dashboard:
   - Go to Customer → Subscriptions
   - Check "Cancel at period end" badge
3. Refresh the page

---

#### Issue 4: API Returns `null` for `subscriptionData`

**Symptoms:**
```json
{
  "subscriptionData": null  ← No subscription at all
}
```

**Root Cause:**
- No Stripe customer found
- No active subscription

**Solution:**
1. Check `stripe_customers` table in Supabase
2. Verify user has a row with `stripe_customer_id`
3. Check Stripe for active subscription

---

### 4. Step-by-Step Debugging

#### Step 1: Verify Stripe Subscription

```bash
# Get customer ID from database
SELECT stripe_customer_id FROM dbasakan.stripe_customers WHERE user_id = 'USER_ID';

# Check subscription in Stripe
stripe subscriptions list --customer cus_xxx
```

**Look for:**
- `status: "active"`
- `cancel_at_period_end: true`
- `current_period_end: 1710547199`

---

#### Step 2: Check Service Layer

Add logs to `lib/stripe/services/subscription.service.ts`:

```typescript
export async function getSubscriptionDetails(userId: string) {
    const result = await getActiveSubscriptionByUserId(userId);
    
    console.log('[DEBUG] Subscription result:', {
        hasSubscription: !!result?.subscription,
        cancelAtPeriodEnd: result?.subscription?.cancel_at_period_end,
        currentPeriodEnd: result?.subscription?.current_period_end,
    });
    
    // ... rest of function
}
```

---

#### Step 3: Check API Response

```bash
# Test API endpoint
curl -X GET http://localhost:3000/api/profile \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

#### Step 4: Check Frontend State

Add to `BillingContent.tsx`:

```tsx
useEffect(() => {
    if (profileData) {
        console.log('[DEBUG] Profile data received:', {
            hasSubscriptionData: !!profileData.subscriptionData,
            cancelAtPeriodEnd: profileData.subscriptionData?.cancel_at_period_end,
            daysRemaining: profileData.subscriptionData?.days_remaining,
        });
    }
}, [profileData]);
```

---

### 5. Force Show Alert (Testing)

To test the UI without actual cancellation:

```tsx
// In BillingContent.tsx - TEMPORARY FOR TESTING
{/* Force show alert for testing */}
{(subscriptionData?.cancel_at_period_end || true) && 
 subscriptionData?.plan_expires && (
    <motion.div variants={fadeIn}>
        <CanceledSubscriptionAlert
            planName={planName}
            planInterval={planInterval}
            daysRemaining={subscriptionData?.days_remaining || 15}  // Fallback for testing
            accessUntil={new Date(subscriptionData.plan_expires)}
            canceledAt={subscriptionData?.canceled_at ? new Date(subscriptionData.canceled_at) : null}
        />
    </motion.div>
)}
```

**⚠️ Remove this after testing!**

---

### 6. Webhook Check

Verify webhook is updating the database:

```sql
-- Check if cancellation is recorded in database
SELECT 
    user_id,
    subscription_id,
    plan_active,
    plan_expires,
    updated_at
FROM dbasakan.stripe_customers
WHERE user_id = 'USER_ID';
```

**Note:** Database is for audit only. Alert data comes from Stripe SDK, not database.

---

### 7. Cache Issues

If data seems stale:

1. **Hard refresh:** Ctrl + Shift + R (Windows/Linux) or Cmd + Shift + R (Mac)
2. **Clear cookies:** DevTools → Application → Cookies → Clear
3. **Restart dev server:** Kill and restart `npm run dev`

---

## 🎯 Expected Behavior

### Cancellation Flow

```
1. User clicks "Manage Billing"
   ↓
2. Opens Stripe billing portal
   ↓
3. User clicks "Cancel Subscription"
   ↓
4. Stripe sets: cancel_at_period_end = true
   ↓
5. Webhook fires (optional, for audit)
   ↓
6. User returns to /app/billing
   ↓
7. Frontend fetches /api/profile
   ↓
8. getSubscriptionDetails() queries Stripe SDK
   ↓
9. Returns cancel_at_period_end: true, days_remaining: X
   ↓
10. Alert appears! 🎉
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────┐
│  User navigates to /app/billing         │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  BillingContent.tsx useEffect()         │
│  - Fetches /api/profile                 │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  /api/profile route                     │
│  - Calls getSubscriptionDetails(userId) │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  subscription.service.ts                │
│  1. getStripeCustomerIdFromDB(userId)   │
│  2. stripe.customers.retrieve(custId)   │
│  3. stripe.subscriptions.list()         │
│  4. Calculate days_remaining            │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Returns to API:                        │
│  {                                      │
│    cancel_at_period_end: true,          │
│    days_remaining: 23,                  │
│    plan_expires: 1710547199000          │
│  }                                      │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  BillingContent checks condition:       │
│  IF cancel_at_period_end === true       │
│  AND days_remaining !== null            │
│  AND plan_expires exists                │
│  THEN show CanceledSubscriptionAlert    │
└─────────────────────────────────────────┘
```

---

## 🛠️ Quick Fix Commands

### Check Stripe Customer
```bash
stripe customers retrieve cus_xxx
```

### Check Subscription
```bash
stripe subscriptions retrieve sub_xxx
```

### Check Database
```sql
SELECT * FROM dbasakan.stripe_customers WHERE user_id = 'USER_ID';
```

### Test API Endpoint
```bash
# Get session token from browser cookies
curl http://localhost:3000/api/profile \
  -H "Cookie: next-auth.session-token=TOKEN" \
  | jq '.subscriptionData'
```

---

## 📞 Still Not Working?

If alert still doesn't show after all checks:

1. **Restart everything:**
   ```bash
   # Kill all Node processes
   pkill -f node
   
   # Clear Next.js cache
   rm -rf .next
   
   # Reinstall dependencies
   npm install
   
   # Start fresh
   npm run dev
   ```

2. **Check component rendering:**
   - Add `<div>TEST ALERT AREA</div>` where alert should be
   - If you don't see "TEST ALERT AREA", component isn't rendering

3. **Check imports:**
   - Verify all components are exported/imported correctly
   - Check for typos in component names

4. **Check Tailwind:**
   - Alert might be rendered but hidden by CSS
   - Inspect element in DevTools
   - Check for `display: none` or `visibility: hidden`

---

## ✅ Success Criteria

Alert should appear when ALL these are true:

- ✅ `subscriptionData.cancel_at_period_end === true`
- ✅ `subscriptionData.days_remaining !== null && !== undefined`
- ✅ `subscriptionData.plan_expires !== null`
- ✅ `CanceledSubscriptionAlert` component imported
- ✅ No JavaScript errors in console
- ✅ Stripe subscription has `cancel_at_period_end: true`

---

**Good luck debugging! 🚀**

