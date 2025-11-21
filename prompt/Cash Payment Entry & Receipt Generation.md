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

# Cash Payment Entry & Receipt Generation — Implementation Guide

## Task
Enable Syndic (admin) users to record cash payments for residents, generate a PDF receipt for each cash payment, and allow downloading the receipt.  
**All UI must use shadcn/ui, Lucide icons, and Tailwind variable-based colors.**  
**All data interactions must use Supabase client with proper auth.**  
**All UI must be responsive and visually attractive.**  
**Detailed debug logs must be included at every critical step.**

---

## Implementation Steps

### 1. Update Payments Page UI (`app/app/payments/page.tsx`)

#### a. Add “Add Payment” Button

- Place a prominent `Add Payment` button above the payments table.
- Use shadcn/ui `<Button>` with `variant="default"` and a Lucide `Plus` icon.
- On click, open a modal dialog for payment entry.

#### b. Payment Entry Modal

- Use shadcn/ui `<Dialog>` for the modal.
- Form fields:
  - **Resident**: shadcn/ui `<Select>` populated with residents from Supabase.
  - **Amount**: shadcn/ui `<Input type="number">`
  - **Method**: shadcn/ui `<Select>` with options: “Cash”, “Online” (default to “Cash”)
- “Save” button (shadcn/ui `<Button>`, full width on mobile).
- On submit, trigger the payment creation logic (see below).

#### c. Payments Table

- Add a “Receipt” column for cash payments.
- For each cash payment, show a “Download PDF” button (shadcn/ui `<Button>` with Lucide `FileText` icon).
- Clicking the button triggers PDF generation and download.

---

### 2. Data Fetching & State Management

#### a. Fetch Residents for Select

- Use Supabase browser client (`utils/supabase/client.ts`) to fetch residents:
  - Only users with `role = 'resident'` and `status = 'active'`.
- Log debug info:
  - On fetch start: `console.log('[Payments] Fetching residents for payment entry...')`
  - On success: `console.log('[Payments] Residents fetched:', residents)`
  - On error: `console.error('[Payments] Error fetching residents:', error)`

#### b. Add Payment (Cash)

- On form submit:
  - Validate all fields.
  - Use Supabase client to insert a new row into `payment` table:
    - `user_id`, `amount`, `method: 'cash'`, `status: 'completed'`, `paid_at: now()`
  - Log debug info:
    - On submit: `console.log('[Payments] Submitting cash payment:', { user_id, amount })`
    - On success: `console.log('[Payments] Cash payment recorded:', payment)`
    - On error: `console.error('[Payments] Error recording payment:', error)`
- After successful insert, close modal and refresh payments list.

---

### 3. PDF Receipt Generation

#### a. PDF Utility

- Use `pdf-lib` (or similar) in `utils/pdf.ts` for PDF generation.
- Receipt must include:
  - Residence name & address (fetch from `residence` table, or cache in state)
  - Resident name & apartment
  - Payment amount, date, method (“Cash”)
  - Unique receipt number (use payment `id`)
  - Syndic name
- Log debug info:
  - On generation start: `console.log('[Receipt] Generating PDF for payment:', payment)`
  - On success: `console.log('[Receipt] PDF generated successfully')`
  - On error: `console.error('[Receipt] PDF generation failed:', error)`

#### b. Download Button

- In the payments table, for each cash payment, show a “Download PDF” button.
- On click:
  - Fetch payment, resident, and residence info as needed.
  - Call PDF utility to generate the receipt.
  - Trigger download in browser.
- Log debug info:
  - On click: `console.log('[Receipt] Download button clicked for payment:', payment.id)`
  - On download: `console.log('[Receipt] PDF download triggered')`

---

### 4. Update Payment Table State

- After adding a payment, refresh the payments list from Supabase.
- Log debug info:
  - On fetch start: `console.log('[Payments] Fetching payments list...')`
  - On success: `console.log('[Payments] Payments list updated:', payments)`
  - On error: `console.error('[Payments] Error fetching payments:', error)`

---

### 5. UI/UX & Styling

- All UI must use shadcn/ui components and Tailwind variable-based colors (e.g., `bg-primary`, `text-primary-foreground`).
- Use Lucide icons for all actions (Plus, FileText, etc.).
- Modal/dialog must be mobile-friendly (full width on mobile, centered on desktop).
- Table must be responsive (horizontal scroll on small screens).
- “Add Payment” button is sticky on mobile (if possible).
- Use shadcn/ui `<Badge>` to indicate payment method in the table.

---

### 6. Accessibility & Feedback

- All form fields must have labels and error messages.
- Show loading spinners (shadcn/ui `<Spinner>`) during async actions.
- Show toast notifications (shadcn/ui `<Toast>`) for success/error:
  - On payment add success: “Cash payment recorded and receipt ready for download.”
  - On error: “Failed to record payment. Please try again.”

---

### 7. Example Debug Log Flow

- User clicks “Add Payment” →  
  `console.log('[Payments] Add Payment button clicked')`
- Residents fetched →  
  `console.log('[Payments] Residents fetched:', residents)`
- User submits form →  
  `console.log('[Payments] Submitting cash payment:', { user_id, amount })`
- Payment inserted →  
  `console.log('[Payments] Cash payment recorded:', payment)`
- User clicks “Download PDF” →  
  `console.log('[Receipt] Download button clicked for payment:', payment.id)`
- PDF generated →  
  `console.log('[Receipt] PDF generated successfully')`

---

## Constraints & Guidelines

- **Do not use fetch or direct network requests; always use Supabase client.**
- **Do not use placeholder components for PDF receipt.**
- **All UI must be responsive and visually attractive.**
- **All debug logs must be present at every async/data step.**
- **No dynamic imports or lazy loading.**
- **No blue/indigo colors unless specified.**
- **No code for authentication or payment logic—reuse existing template.**
- **No code for testing or code review.**

---

## Example: Payment Insert (Supabase Client)

```typescript
import { getSupabaseClient } from '@/utils/supabase/client';

const supabase = await getSupabaseClient();
console.log('[Payments] Submitting cash payment:', { user_id, amount });
const { data, error } = await supabase
  .from('payment')
  .insert({
    user_id,
    amount,
    method: 'cash',
    status: 'completed',
    paid_at: new Date().toISOString(),
  })
  .select()
  .single();

if (error) {
  console.error('[Payments] Error recording payment:', error);
  // Show error toast
} else {
  console.log('[Payments] Cash payment recorded:', data);
  // Show success toast
}
```

---

## Example: PDF Generation Utility

```typescript
// utils/pdf.ts
import { PDFDocument, rgb } from 'pdf-lib';

export async function generateCashReceiptPDF({ payment, resident, residence, syndic }) {
  console.log('[Receipt] Generating PDF for payment:', payment);
  // ... PDF generation logic ...
  // On success:
  console.log('[Receipt] PDF generated successfully');
  // On error:
  // console.error('[Receipt] PDF generation failed:', error);
}
```

---

## Deliverables

- Updated `app/app/payments/page.tsx` with:
  - “Add Payment” modal (shadcn/ui)
  - Payments table with “Download PDF” for cash payments
  - All debug logs as specified
- PDF utility in `utils/pdf.ts` for receipt generation
- All UI styled with shadcn/ui and Tailwind variable-based colors
- No placeholder or missing features for cash payment or receipt

---

**Follow these steps and constraints to deliver a robust, beautiful, and debuggable cash payment entry and receipt feature.**  
If you need a breakdown for the PDF layout or toast notification usage, request a subtask!