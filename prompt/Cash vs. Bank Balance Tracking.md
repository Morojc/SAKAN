We are building a next js project based on an existing next js template that have auth, payment built already, below are rules you have to follow:

<frontend rules>
1. MUST Use 'use client' directive for client-side components; In Next.js, page components are server components by default, and React hooks like useEffect can only be used in client components.
2. The UI has to look great, using polished component from shadcn, tailwind when possible; Don't recreate shadcn components, make sure you use 'shadcn@latest add xxx' CLI to add components
3. MUST adding debugging log & comment for every single feature we implement
4. Make sure to concatenate strings correctly using backslash
7. Use stock photos from picsum.photos where appropriate, only valid URLs you know exist
8. Don't update shadcn components unless otherwise specified
9. Configure next.config.js image remotePatterns to enable stock photos from picsum.photos
11. MUST implement the navigation elements items in their rightful place i.e. Left sidebar, Top header
12. Accurately implement necessary grid layouts
13. Follow proper import practices:
   - Use @/ path aliases
   - Keep component imports organized
   - Update current src/app/page.tsx with new comprehensive code
   - Don't forget root route (page.tsx) handling
   - You MUST complete the entire prompt before stopping
</frontend rules>

<styling_requirements>
- You ALWAYS tries to use the shadcn/ui library.
- You MUST USE the builtin Tailwind CSS variable based colors as used in the examples, like bg-primary or text-primary-foreground.
- You DOES NOT use indigo or blue colors unless specified in the prompt.
- You MUST generate responsive designs.
- The React Code Block is rendered on top of a white background. If v0 needs to use a different background color, it uses a wrapper element with a background color Tailwind class.
</styling_requirements>

<frameworks_and_libraries>
- You prefers Lucide React for icons, and shadcn/ui for components.
- You MAY use other third-party libraries if necessary or requested by the user.
- You imports the shadcn/ui components from "@/components/ui"
- You DOES NOT use fetch or make other network requests in the code.
- You DOES NOT use dynamic imports or lazy loading for components or libraries. Ex: const Confetti = dynamic(...) is NOT allowed. Use import Confetti from 'react-confetti' instead.
- Prefer using native Web APIs and browser features when possible. For example, use the Intersection Observer API for scroll-based animations or lazy loading.
</frameworks_and_libraries>

# Feature Implementation Guide: Cash vs. Bank Balance Tracking

## Task
Implement **Cash on Hand** and **Bank Balance** tracking and display in the MyResidency Web Admin Dashboard.  
This feature enables Syndic users to see up-to-date cash and bank balances, computed from all payment and expense records, and displayed prominently on the dashboard and payments pages.

---

## Implementation Steps

### 1. Database Preparation

- Ensure the following tables exist in Supabase:
  - `payment` (tracks all payments, with `method` field: 'cash' or 'online')
  - `expense` (tracks all expenses, with `paid_from` field: 'cash' or 'bank')

**No schema changes are needed** if you use the provided schema.

---

### 2. Data Fetching Logic

#### 2.1. Compute Balances

- **Cash on Hand** =  
  Sum of all `payment.amount` where `method = 'cash'` and `status = 'completed'`  
  **minus**  
  Sum of all `expense.amount` where `paid_from = 'cash'`
- **Bank Balance** =  
  Sum of all `payment.amount` where `method = 'online'` and `status = 'completed'`  
  **minus**  
  Sum of all `expense.amount` where `paid_from = 'bank'`

#### 2.2. Server Action

- Create a server action in `app/actions/payments.ts`:

```typescript
// app/actions/payments.ts
import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function getBalances() {
  const supabase = await createSupabaseAdminClient();

  // Payments: Cash
  const { data: cashPayments, error: cashPaymentsError } = await supabase
    .from('payment')
    .select('amount')
    .eq('method', 'cash')
    .eq('status', 'completed');
  if (cashPaymentsError) {
    console.log('[getBalances] Error fetching cash payments:', cashPaymentsError);
    return { cashOnHand: 0, bankBalance: 0, error: cashPaymentsError.message };
  }

  // Payments: Online
  const { data: bankPayments, error: bankPaymentsError } = await supabase
    .from('payment')
    .select('amount')
    .eq('method', 'online')
    .eq('status', 'completed');
  if (bankPaymentsError) {
    console.log('[getBalances] Error fetching bank payments:', bankPaymentsError);
    return { cashOnHand: 0, bankBalance: 0, error: bankPaymentsError.message };
  }

  // Expenses: Cash
  const { data: cashExpenses, error: cashExpensesError } = await supabase
    .from('expense')
    .select('amount')
    .eq('paid_from', 'cash');
  if (cashExpensesError) {
    console.log('[getBalances] Error fetching cash expenses:', cashExpensesError);
    return { cashOnHand: 0, bankBalance: 0, error: cashExpensesError.message };
  }

  // Expenses: Bank
  const { data: bankExpenses, error: bankExpensesError } = await supabase
    .from('expense')
    .select('amount')
    .eq('paid_from', 'bank');
  if (bankExpensesError) {
    console.log('[getBalances] Error fetching bank expenses:', bankExpensesError);
    return { cashOnHand: 0, bankBalance: 0, error: bankExpensesError.message };
  }

  // Compute totals
  const cashIn = cashPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const cashOut = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const bankIn = bankPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const bankOut = bankExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const cashOnHand = cashIn - cashOut;
  const bankBalance = bankIn - bankOut;

  console.log('[getBalances] cashIn:', cashIn, 'cashOut:', cashOut, 'bankIn:', bankIn, 'bankOut:', bankOut);
  console.log('[getBalances] cashOnHand:', cashOnHand, 'bankBalance:', bankBalance);

  return { cashOnHand, bankBalance, error: null };
}
```

- **Debug Logging:**  
  - Log all errors with clear context.
  - Log computed sums and final balances for traceability.

---

### 3. UI Integration

#### 3.1. Overview Cards (Dashboard Home)

- In `components/app/OverviewCards.tsx`, add two cards:
  - **Cash on Hand**
  - **Bank Balance**

- Use shadcn/ui `Card` component, Lucide icons (`Wallet` for cash, `Banknote` for bank).
- Use Tailwind variable-based colors:  
  - Card: `bg-primary`  
  - Text: `text-primary-foreground`  
  - Icon: `text-muted-foreground`  
- Responsive grid: 2 columns on mobile, 3+ on desktop.

**Example Card Structure:**
```tsx
<Card className="bg-primary text-primary-foreground flex flex-col items-center justify-center p-6">
  <Wallet className="w-8 h-8 mb-2 text-muted-foreground" />
  <div className="text-lg font-semibold">Cash on Hand</div>
  <div className="text-2xl font-bold mt-1">{formatCurrency(cashOnHand)}</div>
</Card>
```

#### 3.2. Payments Page

- At the top of `app/app/payments/page.tsx`, display both balances in summary cards, using the same style as above.

#### 3.3. Data Flow

- Fetch balances using the server action (`getBalances`) in both dashboard and payments pages.
- Pass the values as props to the overview cards component.

#### 3.4. Error Handling

- If fetching fails, show a shadcn/ui `Alert` with the error message.
- Log all errors to the console with context.

---

### 4. UI/UX & Styling Constraints

- **Use shadcn/ui Card, Alert, and Lucide icons only.**
- **All colors must use Tailwind variable-based classes (e.g., bg-primary, text-primary-foreground).**
- **Cards must be responsive and visually attractive.**
- **No blue/indigo unless specified.**
- **No placeholder components.**
- **No fetch or direct network requests in UI; always use server action.**

---

### 5. Debug Logging & Traceability

- All server actions must log:
  - Each query error with table and filter context.
  - The computed sums for each category (cash in/out, bank in/out).
  - The final computed balances.
- In the UI, log when balances are loaded and if any error is displayed.

---

### 6. Example Usage in Dashboard

```tsx
// app/app/page.tsx
import { getBalances } from '@/app/actions/payments';
import OverviewCards from '@/components/app/OverviewCards';

export default async function DashboardPage() {
  const { cashOnHand, bankBalance, error } = await getBalances();

  if (error) {
    console.log('[DashboardPage] Error loading balances:', error);
  } else {
    console.log('[DashboardPage] Loaded balances:', { cashOnHand, bankBalance });
  }

  return (
    <div className="p-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <OverviewCards cashOnHand={cashOnHand} bankBalance={bankBalance} />
      {/* ...other dashboard content */}
    </div>
  );
}
```

---

## Summary Checklist

- [ ] Server action in `app/actions/payments.ts` to compute balances, with detailed debug logs.
- [ ] Overview cards in dashboard and payments page, styled with shadcn/ui and Tailwind variable-based colors.
- [ ] Error handling and logging in both server and UI.
- [ ] No direct fetch/network in UI; always use server action.
- [ ] Responsive, beautiful UI.

---

**Follow these steps to implement robust, traceable, and beautiful cash/bank balance tracking in MyResidency.**  
If you need the actual UI code for the cards or more details, let me know!