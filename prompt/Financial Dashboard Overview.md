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

# MyResidency – Financial Dashboard Overview Implementation Guide

## Task
Implement the **Dashboard Home: Financial & Operational Overview** in `app/app/page.tsx` for the Syndic (Admin) dashboard.  
This page displays key financial and operational stats in a beautiful, responsive grid of cards, using shadcn/ui and Tailwind variable-based colors.

---

## Implementation Steps

### 1. **Page Setup**

- File: `app/app/page.tsx`
- This is the dashboard landing page after login.
- The page must use the existing dashboard layout (sidebar, header).
- All content should be wrapped in a `<main>` with `bg-background` and responsive padding.

**Debug log:**  
Add a `console.log('[Dashboard] Rendering dashboard overview page')` at the top of the page component.

---

### 2. **Define the Overview Cards**

- Each card represents a key stat:
  - **Total Residents**
  - **Cash on Hand**
  - **Bank Balance**
  - **Outstanding Fees**
  - **Open Incidents**
  - **Recent Announcements**
- Use shadcn/ui’s `Card` component for each stat.
- Use Lucide icons for visual cues (e.g., Users, DollarSign, Banknote, AlertCircle, Megaphone).
- Each card must have:
  - Icon (left/top)
  - Stat label (e.g., "Total Residents")
  - Stat value (large, bold)
  - Optional: “View details” link (use shadcn/ui `Button` with `variant="link"`)
- Cards must be responsive:
  - 2 columns on mobile (`grid-cols-2`)
  - 3 or 4 columns on desktop (`md:grid-cols-3` or `lg:grid-cols-4`)
- Use Tailwind variable-based colors:
  - Card background: `bg-card`
  - Card text: `text-card-foreground`
  - Icon background: use `bg-primary/10` and icon color `text-primary`
- Cards should have subtle shadow and rounded corners.

**Debug log:**  
For each stat, after fetching or computing, log:  
`console.log('[Dashboard] {StatName}:', value)`

---

### 3. **Fetch/Stub Data for Stats**

- For now, use static/mock data or fetch from Supabase if available.
- **Data points:**
  - `totalResidents`: number
  - `cashOnHand`: number (sum of cash payments minus cash expenses)
  - `bankBalance`: number (sum of online payments minus bank expenses)
  - `outstandingFees`: number (sum of unpaid/overdue fees)
  - `openIncidents`: number (count of incidents with status 'open' or 'in_progress')
  - `recentAnnouncements`: array of last 2-3 announcements (title, date)
- Use the correct Supabase client for browser/server as per your data fetching guideline.
- If using mock data, define at the top of the file.

**Debug log:**  
After fetching all stats, log:  
`console.log('[Dashboard] Stats loaded', { totalResidents, cashOnHand, bankBalance, outstandingFees, openIncidents, recentAnnouncements })`

---

### 4. **Implement the Responsive Grid**

- Use a `div` with `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4` for the cards.
- Each card is a shadcn/ui `Card` with padding and flex layout.
- For “Recent Announcements”, use a single card with a list of the latest 2-3 announcements (title + date), and a “View all” link.

---

### 5. **Add “View Details” Links**

- Each card (except Announcements) should have a “View details” link/button that routes to the relevant module:
  - Residents → `/app/residents`
  - Payments → `/app/payments`
  - Incidents → `/app/incidents`
  - Announcements → `/app/announcements`
- Use Next.js `<Link>` and shadcn/ui `Button` with `variant="link"`.

---

### 6. **Accessibility & Responsiveness**

- All cards and links must be keyboard accessible.
- Ensure text contrast meets accessibility standards (use Tailwind variable colors).
- Cards must stack on small screens and align in grid on larger screens.

---

### 7. **Styling & Visual Polish**

- Use shadcn/ui and Tailwind variable-based colors only.
- No indigo/blue unless specified.
- Add hover effect to cards: `hover:shadow-lg transition-shadow`
- Use `rounded-xl` for card corners.
- Use `font-semibold` for stat labels, `text-2xl font-bold` for stat values.

---

### 8. **Componentization (Optional but Recommended)**

- If the card UI is reused, create a `components/app/OverviewCards.tsx` component.
- Pass stats as props.
- Add debug logs in the component:  
  `console.log('[OverviewCards] Rendering with stats', stats)`

---

### 9. **Error Handling & Loading State**

- If fetching data, show a loading spinner (shadcn/ui `Skeleton` or `Spinner`) until data is ready.
- If any stat fails to load, show “—” and log error:  
  `console.error('[Dashboard] Failed to load {StatName}', error)`

---

## Example Card Layout (Pseudocode)

```tsx
<Card className="flex flex-col gap-2 p-4 bg-card text-card-foreground rounded-xl shadow hover:shadow-lg transition-shadow">
  <div className="flex items-center gap-3">
    <div className="p-2 rounded-full bg-primary/10">
      <Users className="w-6 h-6 text-primary" />
    </div>
    <span className="font-semibold">Total Residents</span>
  </div>
  <div className="text-2xl font-bold">{totalResidents}</div>
  <Button asChild variant="link" className="p-0 h-auto">
    <Link href="/app/residents">View details</Link>
  </Button>
</Card>
```

---

## Final Checklist

- [ ] All stats cards are present, styled, and responsive.
- [ ] Data is fetched or stubbed, with debug logs for each stat.
- [ ] “View details” links route to correct modules.
- [ ] Recent Announcements card lists latest 2-3 items.
- [ ] All UI uses shadcn/ui and Tailwind variable-based colors.
- [ ] All debug logs are present for data fetching, rendering, and errors.

---

## Debug Log Summary

- At top of page:  
  `console.log('[Dashboard] Rendering dashboard overview page')`
- After fetching each stat:  
  `console.log('[Dashboard] {StatName}:', value)`
- After all stats loaded:  
  `console.log('[Dashboard] Stats loaded', { ... })`
- In OverviewCards component:  
  `console.log('[OverviewCards] Rendering with stats', stats)`
- On error:  
  `console.error('[Dashboard] Failed to load {StatName}', error)`

---

**Follow these steps to deliver a beautiful, maintainable, and debuggable dashboard overview page.**  
**Do not include any placeholder components for stats or announcements.**  
**All UI must be responsive and visually attractive.**