# Canceled Subscription UI Components

This document explains how to display and manage canceled subscriptions in the UI.

## Overview

When a user cancels their subscription via Stripe billing portal, the subscription is marked with `cancel_at_period_end = true`. The user **still has access** until the end of their billing period, but will not be automatically renewed.

---

## 🎯 Components Available

### 1. **CanceledSubscriptionAlert** (Full Banner)
**Location:** `components/stripe/CanceledSubscriptionAlert.tsx`

A prominent alert banner that shows cancellation status with countdown and reactivation button.

#### Features:
- ⚠️ Color-coded by urgency (amber → orange → red)
- ⏰ Days remaining countdown
- 📅 Access until date
- 🔄 One-click reactivation button
- 📊 Detailed information cards

#### Usage:
```tsx
import { CanceledSubscriptionAlert } from '@/components/stripe/CanceledSubscriptionAlert';

// In your component
{subscriptionData?.cancel_at_period_end && (
  <CanceledSubscriptionAlert
    planName="Pro"
    planInterval="month"
    daysRemaining={23}
    accessUntil={new Date('2025-03-15')}
    canceledAt={new Date('2025-02-20')}
  />
)}
```

#### Visual States:
- **23+ days**: Amber (⚠️ warning)
- **7-22 days**: Orange (⚠️ caution)
- **1-6 days**: Red (🚨 urgent)

---

### 2. **SubscriptionStatusCard** (Compact Card)
**Location:** `components/stripe/SubscriptionStatusCard.tsx`

A compact card showing subscription status, useful for dashboards or sidebar.

#### Features:
- ✅ Status badge (Active/Canceling/Inactive)
- 📅 Next billing date or access until
- ⏰ Days remaining
- 🔧 Manage subscription button

#### Usage:
```tsx
import { SubscriptionStatusCard } from '@/components/stripe/SubscriptionStatusCard';

<SubscriptionStatusCard
  planName="Pro"
  planInterval="month"
  status="active"
  currentPeriodEnd={new Date('2025-03-15')}
  cancelAtPeriodEnd={true}
  daysRemaining={23}
/>
```

---

## 🔧 Backend Functions

### Get Canceled Subscription Details

```typescript
import { getCanceledSubscriptionByUserId } from '@/lib/stripe/services/subscription.service';

const canceled = await getCanceledSubscriptionByUserId(userId);

if (canceled?.subscription) {
  console.log(`Subscription ending in ${canceled.daysRemaining} days`);
  console.log(`Access until: ${canceled.accessUntil}`);
  console.log(`Canceled on: ${canceled.canceledAt}`);
}
```

### Check if Subscription is Canceled

```typescript
import { hasCanceledSubscription } from '@/lib/stripe/services/subscription.service';

const isCanceled = await hasCanceledSubscription(userId);

if (isCanceled) {
  // Show cancellation UI
}
```

---

## 📋 Complete Implementation Example

### Server Component (Page)

```tsx
// app/app/billing/page.tsx
import { auth } from '@/lib/auth';
import { getSubscriptionDetails } from '@/lib/stripe/services/subscription.service';
import { CanceledSubscriptionAlert } from '@/components/stripe/CanceledSubscriptionAlert';

export default async function BillingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  
  if (!userId) {
    return <div>Please log in</div>;
  }
  
  const subscriptionDetails = await getSubscriptionDetails(userId);
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>
      
      {/* Show alert if subscription is canceled */}
      {subscriptionDetails.cancelAtPeriodEnd && subscriptionDetails.daysRemaining && (
        <CanceledSubscriptionAlert
          planName={subscriptionDetails.planName}
          planInterval={subscriptionDetails.planInterval}
          daysRemaining={subscriptionDetails.daysRemaining}
          accessUntil={subscriptionDetails.currentPeriodEnd!}
          canceledAt={subscriptionDetails.canceledAt}
        />
      )}
      
      {/* Rest of billing page */}
      <div className="mt-6">
        {/* ... subscription details ... */}
      </div>
    </div>
  );
}
```

### Client Component (Dashboard Widget)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { SubscriptionStatusCard } from '@/components/stripe/SubscriptionStatusCard';

export function DashboardSubscriptionWidget({ userId }: { userId: string }) {
  const [subData, setSubData] = useState<any>(null);
  
  useEffect(() => {
    async function fetchData() {
      const res = await fetch(`/api/subscription/${userId}`);
      const data = await res.json();
      setSubData(data);
    }
    fetchData();
  }, [userId]);
  
  if (!subData) return <div>Loading...</div>;
  
  return (
    <SubscriptionStatusCard
      planName={subData.planName}
      planInterval={subData.planInterval}
      status={subData.status}
      currentPeriodEnd={new Date(subData.currentPeriodEnd)}
      cancelAtPeriodEnd={subData.cancelAtPeriodEnd}
      daysRemaining={subData.daysRemaining}
    />
  );
}
```

---

## 🎨 Customization

### Custom Color Scheme

You can customize the alert colors by modifying the `getAlertStyles()` function:

```tsx
const getAlertStyles = () => {
  if (daysRemaining <= 3) {
    return 'bg-red-50 border-red-200 text-red-900'; // Urgent
  }
  if (daysRemaining <= 7) {
    return 'bg-orange-50 border-orange-200 text-orange-900'; // Warning
  }
  return 'bg-amber-50 border-amber-200 text-amber-900'; // Notice
};
```

### Custom Reactivation Handler

```tsx
<CanceledSubscriptionAlert
  // ... props
  onReactivate={() => {
    console.log('User clicked reactivate');
    // Custom logic here
  }}
/>
```

---

## 🔄 Reactivation Flow

1. User sees cancellation alert
2. Clicks "Reactivate Subscription" button
3. Opens Stripe billing portal in new tab
4. User clicks "Reactivate" in Stripe portal
5. Stripe webhook `customer.subscription.updated` fires
6. Database updated: `cancel_at_period_end = false`
7. UI refreshes, alert disappears

---

## 📊 Data Flow

```
┌─────────────────────────────────────────┐
│  User Cancels in Stripe Portal         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Stripe: cancel_at_period_end = true    │
│  Status: still 'active'                 │
│  current_period_end: unchanged          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  getCanceledSubscriptionByUserId()      │
│  Returns subscription details           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  UI: Show CanceledSubscriptionAlert     │
│  Display: days remaining, access until  │
│  Button: "Reactivate Subscription"      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  User Reactivates in Stripe Portal     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Stripe: cancel_at_period_end = false   │
│  Alert disappears                       │
└─────────────────────────────────────────┘
```

---

## 🧪 Testing

### Test Cancellation
1. Log in as a user with an active subscription
2. Go to `/app/billing`
3. Click "Manage Billing"
4. In Stripe portal, click "Cancel Subscription"
5. Select "Cancel at end of billing period"
6. Return to app
7. ✅ Should see `CanceledSubscriptionAlert`

### Test Reactivation
1. From canceled state, click "Reactivate Subscription"
2. In Stripe portal, click "Reactivate Subscription"
3. Return to app
4. ✅ Alert should disappear

---

## 🚨 Edge Cases

### 1. Subscription Already Ended
```typescript
if (canceled?.daysRemaining && canceled.daysRemaining <= 0) {
  // Subscription has ended, no alert needed
  return <div>Your subscription has ended</div>;
}
```

### 2. No Current Period End
```typescript
if (!subscriptionDetails.currentPeriodEnd) {
  // Free plan or no subscription
  return null;
}
```

### 3. Network Errors
The component handles errors gracefully and displays an error message if the portal fails to open.

---

## 📝 API Reference

### `getCanceledSubscriptionByUserId(userId: string)`

Returns subscription details only if `cancel_at_period_end = true`.

**Returns:**
```typescript
{
  subscription: Stripe.Subscription | null;
  customer: Stripe.Customer | null;
  planName: string;
  planInterval: string;
  priceId: string | null;
  customerId: string | null;
  daysRemaining: number | null;      // Days until access ends
  accessUntil: Date | null;          // Exact end date
  canceledAt: Date | null;           // When user requested cancellation
}
```

### `hasCanceledSubscription(userId: string)`

Quick boolean check for canceled status.

**Returns:** `boolean`

---

## 💡 Best Practices

1. **Always check `daysRemaining > 0`** before showing the alert
2. **Use server components** for initial data fetch
3. **Refresh data** after reactivation
4. **Show countdown** for urgency
5. **Provide reactivation** option prominently
6. **Color-code by urgency** (amber → orange → red)
7. **Log all actions** for debugging

---

## 🔗 Related Files

- `lib/stripe/services/subscription.service.ts` - Backend logic
- `components/stripe/CanceledSubscriptionAlert.tsx` - Full alert banner
- `components/stripe/SubscriptionStatusCard.tsx` - Compact card
- `components/app/billing/BillingInfo.tsx` - Billing page implementation
- `app/actions/stripe.ts` - Server actions for portal

---

## 📚 Additional Resources

- [Stripe Subscription Lifecycle](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe cancel_at_period_end](https://stripe.com/docs/api/subscriptions/object#subscription_object-cancel_at_period_end)
- [Billing Portal Configuration](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

