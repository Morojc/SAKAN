# SAKAN - Product Requirements Document (PRD)
## UI/UX Requirements for Unimplemented Features

**Version:** 1.0  
**Date:** 2024-11-25  
**Status:** Draft  
**Focus:** UI/UX Design & User Experience

---

## Document Overview

This PRD outlines the UI/UX requirements for all unimplemented features in the SAKAN property management SaaS platform. It focuses on user interface design, user experience flows, and visual design specifications while ignoring features that are already implemented.

### Already Implemented Features (Excluded from this PRD)
- ✅ Billing & Subscriptions (Stripe integration) for the sign-up user


### Unimplemented Features (Covered in this PRD)
- ❌ Payments Management (Cash payments, receipt generation)
- ❌ Dashboard Overview (Financial & Operational Stats)
- ❌ Residents Management
- ❌ Expenses Management
- ❌ Incidents Management
- ❌ Announcements
- ❌ Polls & Voting
- ❌ Access Control (QR Code Visitor Access)
- ❌ Deliveries Management
- ❌ Transaction History & Export
- ❌ Balance Snapshots

---

## Design System & UI Standards

### Technology Stack
- **UI Library:** shadcn/ui components
- **Styling:** Tailwind CSS with variable-based colors
- **Icons:** Lucide React
- **Animations:** Framer Motion (where appropriate)
- **Notifications:** react-hot-toast

### Color System
- Use Tailwind CSS variable-based colors exclusively:
  - `bg-primary`, `text-primary-foreground`
  - `bg-background`, `text-foreground`
  - `bg-card`, `text-card-foreground`
  - `bg-muted`, `text-muted-foreground`
  - `bg-destructive`, `text-destructive-foreground`
  - `bg-success`, `text-success-foreground` (if available)
- **Do NOT use** indigo or blue colors unless explicitly specified
- All backgrounds default to white; use wrapper elements for colored backgrounds

### Responsive Design
- **Mobile-first approach**
- Breakpoints:
  - Mobile: Default (< 768px)
  - Tablet: `md:` (≥ 768px)
  - Desktop: `lg:` (≥ 1024px)
  - Large Desktop: `xl:` (≥ 1280px)

### Component Standards
- All interactive elements must be keyboard accessible
- All forms must have proper labels and error states
- All data tables must be horizontally scrollable on mobile
- All dialogs/modals must be full-screen on mobile
- Loading states must use shadcn/ui `Skeleton` components
- Error states must display user-friendly messages with retry options

---

## 1. Residents Management

### 1.1 Overview
**Page:** `/app/residents`  
**User Role:** Syndic (Admin)  
**Purpose:** Manage building residents, view profiles, track outstanding fees, and manage resident data.

### 1.2 User Stories
1. As a Syndic, I want to view all residents in a searchable, filterable table so I can quickly find specific residents.
2. As a Syndic, I want to add new residents with their apartment details so I can maintain an accurate resident database.
3. As a Syndic, I want to edit resident information so I can keep records up to date.
4. As a Syndic, I want to see outstanding fees for each resident at a glance so I can prioritize collection efforts.
5. As a Syndic, I want to create fees for individual residents so I can charge for specific services or charges.

### 1.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Residents" (h1, `text-2xl font-bold`)
  - Search bar: shadcn/ui `Input` with search icon (Lucide `Search`)
  - Filter dropdown: Status filter (Active/Inactive/All) using shadcn/ui `Select`
  - "Add Resident" button: Primary button with plus icon (Lucide `UserPlus`), positioned top-right

- **Main Content:**
  - Responsive table container with horizontal scroll on mobile
  - Table uses shadcn/ui `Table` component
  - Empty state: Friendly message with illustration when no residents found

#### Residents Table
**Columns:**
1. **Name** (sortable)
   - Full name from `profiles.full_name`
   - Clickable to view details
   - Font weight: `font-medium`

2. **Apartment** (sortable)
   - Apartment/unit number from `profiles.apartment_number`
   - Badge style: `bg-muted text-muted-foreground rounded px-2 py-1`

3. **Email**
   - Email from `users.email` (joined)
   - Truncate with ellipsis on mobile
   - Clickable to open email client

4. **Phone**
   - Phone number from `profiles.phone_number`
   - Format: Display with dashes/spaces for readability

5. **Role** (Badge)
   - Display role from `profiles.role`
   - Badge colors:
     - Syndic: `bg-primary text-primary-foreground`
     - Resident: `bg-muted text-muted-foreground`
     - Guard: `bg-secondary text-secondary-foreground`

6. **Outstanding Fees** (Badge)
   - Calculated sum of unpaid fees
   - Badge colors:
     - > 0: `bg-destructive text-destructive-foreground`
     - = 0: `bg-success text-success-foreground` (or muted)
   - Clickable to view fee details

7. **Actions** (Dropdown Menu)
   - Edit icon (Lucide `Pencil`)
   - Delete icon (Lucide `Trash2`)
   - Add Fee icon (Lucide `DollarSign`)
   - Use shadcn/ui `DropdownMenu` component

#### Add Resident Dialog
- **Trigger:** "Add Resident" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Full Name (required, `Input`)
  - Email (required, `Input` type="email")
  - Phone Number (optional, `Input` type="tel")
  - Apartment Number (required, `Input`)
  - Residence (required, `Select` dropdown - list of residences)
  - Role (required, `Select` - default: "resident")
- **Actions:**
  - Cancel button (secondary)
  - Submit button (primary)
- **Validation:**
  - Real-time validation with error messages
  - Email format validation
  - Required field indicators

#### Edit Resident Dialog
- **Trigger:** Edit action from table row
- **Component:** shadcn/ui `Dialog`
- **Pre-filled:** All current resident data
- **Form Fields:** Same as Add Resident Dialog
- **Actions:** Cancel, Save (primary)

#### Delete Resident Dialog
- **Trigger:** Delete action from table row
- **Component:** shadcn/ui `AlertDialog`
- **Content:**
  - Warning message: "Are you sure you want to delete [Name]?"
  - Subtext: "This action cannot be undone. All associated fees and payments will be removed."
- **Actions:**
  - Cancel button (secondary)
  - Delete button (destructive variant)

#### Add Fee Dialog
- **Trigger:** "Add Fee" action from table row
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Title (required, e.g., "Monthly Fee - March 2024")
  - Amount (required, `Input` type="number", step="0.01")
  - Due Date (required, Date picker)
  - Status (default: "unpaid", `Select`)
- **Actions:** Cancel, Create Fee (primary)

### 1.4 Data Fetching
- Use server actions in `app/app/residents/actions.ts`
- Fetch from `dbasakan.profiles` joined with `dbasakan.users`
- Calculate outstanding fees by summing `dbasakan.fees` where `status != 'paid'`
- Implement search by name, apartment, or email
- Filter by role and status

### 1.5 Loading & Error States
- **Loading:** Skeleton table with 5 rows
- **Error:** Alert component with retry button
- **Empty State:** Illustration with message "No residents found. Add your first resident to get started."

### 1.6 Accessibility
- All table headers have `aria-sort` attributes
- All buttons have `aria-label`
- All form inputs have associated labels
- Keyboard navigation: Tab through form fields, Enter to submit

---

## 2. Expenses Management

### 2.1 Overview
**Page:** `/app/expenses`  
**User Role:** Syndic (Admin)  
**Purpose:** Track building maintenance and operational expenses, categorize expenses, and maintain expense records with attachments.

### 2.2 User Stories
1. As a Syndic, I want to log building expenses so I can track where money is being spent.
2. As a Syndic, I want to categorize expenses so I can analyze spending patterns.
3. As a Syndic, I want to attach receipts/invoices to expenses so I can maintain proper documentation.
4. As a Syndic, I want to filter expenses by category and date range so I can generate reports.
5. As a Syndic, I want to see expense totals by category so I can understand spending distribution.

### 2.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Expenses" (h1)
  - Date range filter: Start date and end date pickers
  - Category filter: Multi-select dropdown (Electricity, Cleaning, Maintenance, etc.)
  - "Add Expense" button: Primary button with plus icon (Lucide `Receipt`)

- **Summary Cards (Top Section):**
  - Total Expenses (current period)
  - Expenses by Category (pie chart or bar chart - optional, can be simple list)
  - Average Monthly Expense

#### Expenses Table
**Columns:**
1. **Date** (sortable)
   - Expense date from `expenses.expense_date`
   - Format: "MMM DD, YYYY"
   - Sortable by date

2. **Description**
   - Expense description
   - Truncate with tooltip on hover for long descriptions

3. **Category** (Badge)
   - Category from `expenses.category`
   - Color-coded badges per category
   - Common categories: Electricity, Cleaning, Maintenance, Security, Insurance, etc.

4. **Amount** (sortable)
   - Amount from `expenses.amount`
   - Format: Currency with 2 decimals
   - Right-aligned
   - Font weight: `font-semibold`

5. **Attachment**
   - If `expenses.attachment_url` exists, show attachment icon (Lucide `Paperclip`)
   - Clickable to view/download attachment
   - Tooltip: "View attachment"

6. **Created By**
   - Creator name from joined `profiles.full_name`
   - Truncate on mobile

7. **Actions** (Dropdown Menu)
   - View Details (Lucide `Eye`)
   - Edit (Lucide `Pencil`)
   - Delete (Lucide `Trash2`)

#### Add Expense Dialog
- **Trigger:** "Add Expense" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Description (required, `Textarea`)
  - Category (required, `Select` dropdown with common categories)
  - Amount (required, `Input` type="number", step="0.01")
  - Expense Date (required, Date picker, default: today)
  - Attachment (optional, File upload or URL input)
  - Residence (required, `Select` - if syndic manages multiple)
- **Actions:** Cancel, Create Expense (primary)
- **File Upload:**
  - Use shadcn/ui file input or drag-and-drop zone
  - Show upload progress
  - Preview uploaded file

#### Edit Expense Dialog
- **Trigger:** Edit action from table row
- **Component:** shadcn/ui `Dialog`
- **Pre-filled:** All current expense data
- **Form Fields:** Same as Add Expense Dialog
- **Actions:** Cancel, Save (primary)

#### Expense Details Dialog
- **Trigger:** View Details action
- **Component:** shadcn/ui `Dialog`
- **Content:**
  - All expense fields displayed in read-only format
  - Attachment preview (if image) or download link
  - Created date and creator information
  - Residence information

### 2.4 Data Visualization
- **Category Breakdown:**
  - Card showing expense totals by category
  - Use shadcn/ui `Card` components
  - Optional: Simple bar chart using a charting library (if needed)

### 2.5 Data Fetching
- Fetch from `dbasakan.expenses` joined with `dbasakan.profiles` and `dbasakan.residences`
- Filter by date range and category
- Calculate totals and averages
- Sort by date (newest first)

### 2.6 Loading & Error States
- **Loading:** Skeleton table
- **Error:** Alert with retry
- **Empty State:** "No expenses recorded. Add your first expense to start tracking."

---

## 3. Incidents Management

### 3.1 Overview
**Page:** `/app/incidents`  
**User Role:** Syndic, Guards (view only), Residents (create/view own)  
**Purpose:** Manage maintenance requests and incident reports, track status, assign to technicians, and resolve issues.

### 3.2 User Stories
1. As a Resident, I want to report incidents with photos so I can get maintenance help quickly.
2. As a Syndic, I want to view all incidents in a kanban board or list so I can prioritize work.
3. As a Syndic, I want to assign incidents to technicians/guards so work gets distributed properly.
4. As a Syndic, I want to update incident status so residents can track progress.
5. As a Resident, I want to see the status of my reported incidents so I know when issues will be resolved.

### 3.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Incidents" (h1)
  - Status filter: Tabs or dropdown (All, Open, In Progress, Resolved, Closed)
  - Priority filter (if implemented): High, Medium, Low
  - "Report Incident" button: Primary button (visible to residents and syndics)

- **View Toggle:**
  - List View / Kanban View toggle (optional, start with list view)
  - Use shadcn/ui `ToggleGroup` component

#### Incidents Table (List View)
**Columns:**
1. **ID** (sortable)
   - Incident ID
   - Format: "#INC-{id}"
   - Monospace font

2. **Title** (sortable)
   - Incident title
   - Clickable to view details
   - Font weight: `font-medium`

3. **Reporter**
   - Resident name from joined `profiles.full_name`
   - Apartment number in parentheses

4. **Status** (Badge)
   - Status from `incidents.status`
   - Badge colors:
     - Open: `bg-yellow-500 text-white` (or warning color)
     - In Progress: `bg-blue-500 text-white` (or primary)
     - Resolved: `bg-green-500 text-white` (or success)
     - Closed: `bg-muted text-muted-foreground`

5. **Assigned To**
   - Assigned user name (if assigned)
   - "Unassigned" badge if null
   - Clickable to assign/reassign

6. **Created Date** (sortable)
   - Format: "MMM DD, YYYY"
   - Relative time tooltip (e.g., "2 days ago")

7. **Photo**
   - Photo icon if `incidents.photo_url` exists
   - Clickable to view full-size image

8. **Actions** (Dropdown Menu)
   - View Details (Lucide `Eye`)
   - Edit Status (Lucide `Edit`)
   - Assign (Lucide `UserCheck`)
   - Delete (Lucide `Trash2`) - Syndic only

#### Report Incident Dialog
- **Trigger:** "Report Incident" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Title (required, `Input`)
  - Description (required, `Textarea`)
  - Photo Upload (optional, File input with preview)
  - Residence (auto-selected based on user's residence)
- **Actions:** Cancel, Submit Report (primary)
- **Photo Upload:**
  - Drag-and-drop zone or file picker
  - Image preview before upload
  - Max file size indicator

#### Incident Details Dialog
- **Trigger:** View Details action or click on title
- **Component:** shadcn/ui `Dialog` (large size)
- **Content Sections:**
  1. **Header:**
     - Incident ID and title
     - Status badge
     - Created date and reporter info
  
  2. **Description:**
     - Full description text
     - Photo gallery (if multiple photos)
  
  3. **Assignment:**
     - Current assignee (if any)
     - Assign/Reassign button (dropdown with user list)
  
  4. **Status:**
     - Current status badge
     - Status update dropdown (for syndics)
     - Status change history (optional)
  
  5. **Comments/Updates:**
     - Timeline of status changes
     - Optional: Comments section for updates

#### Assign Incident Dialog
- **Trigger:** Assign action
- **Component:** shadcn/ui `Dialog`
- **Content:**
  - User search/select dropdown
  - List of available technicians/guards
  - Current assignee highlighted
- **Actions:** Cancel, Assign (primary)

### 3.4 Kanban Board View (Optional, Future Enhancement)
- Columns: Open, In Progress, Resolved, Closed
- Drag-and-drop cards between columns
- Card shows: Title, Reporter, Assigned To, Photo thumbnail
- Click card to open details dialog

### 3.5 Data Fetching
- Fetch from `dbasakan.incidents` joined with `dbasakan.profiles` and `dbasakan.residences`
- Filter by status and date
- For residents: Only show their own incidents
- For syndics: Show all incidents for their residences
- Sort by created date (newest first) or status

### 3.6 Loading & Error States
- **Loading:** Skeleton table or cards
- **Error:** Alert with retry
- **Empty State:** "No incidents reported. Report an incident to get started."

---

## 4. Announcements

### 4.1 Overview
**Page:** `/app/announcements`  
**User Role:** Syndic (create/edit/delete), Residents (view only)  
**Purpose:** Post building-wide announcements and notices to keep residents informed.

### 4.2 User Stories
1. As a Syndic, I want to post announcements so I can communicate important information to all residents.
2. As a Resident, I want to see recent announcements so I can stay informed about building matters.
3. As a Syndic, I want to attach documents to announcements so I can share official notices.
4. As a Resident, I want announcements sorted by date so I can see the latest information first.

### 4.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Announcements" (h1)
  - "New Announcement" button: Primary button (visible to syndics only)
  - Filter: By residence (if syndic manages multiple)

- **View Options:**
  - List View (default)
  - Card View toggle (optional)

#### Announcements List/Cards
**Card/List Item Components:**
- **Title:** Large, bold heading
- **Content:** Full text or truncated with "Read more" link
- **Metadata:**
  - Created date (relative time: "2 days ago")
  - Created by (syndic name)
  - Residence name
- **Attachment:**
  - Attachment icon if `announcements.attachment_url` exists
  - Download link
- **Actions (Syndic only):**
  - Edit (Lucide `Pencil`)
  - Delete (Lucide `Trash2`)

#### New Announcement Dialog
- **Trigger:** "New Announcement" button
- **Component:** shadcn/ui `Dialog` (large size)
- **Form Fields:**
  - Title (required, `Input`)
  - Content (required, `Textarea` with rich text support optional)
  - Attachment (optional, File upload or URL)
  - Residence (required, `Select` - if multiple)
  - Publish immediately checkbox (default: checked)
- **Actions:** Cancel, Publish (primary)

#### Edit Announcement Dialog
- **Trigger:** Edit action
- **Component:** shadcn/ui `Dialog`
- **Pre-filled:** All current announcement data
- **Form Fields:** Same as New Announcement
- **Actions:** Cancel, Save (primary)

#### Announcement Details View
- **Trigger:** Click on announcement title or "Read more"
- **Component:** Full-page view or large dialog
- **Content:**
  - Full title and content
  - Formatted date and author
  - Attachment download/view
  - Back button to list

### 4.4 Data Fetching
- Fetch from `dbasakan.announcements` joined with `dbasakan.profiles` and `dbasakan.residences`
- Sort by `created_at` DESC (newest first)
- Filter by residence (if applicable)

### 4.5 Loading & Error States
- **Loading:** Skeleton cards
- **Error:** Alert with retry
- **Empty State:** "No announcements yet. Create your first announcement to keep residents informed."

---

## 5. Polls & Voting

### 5.1 Overview
**Page:** `/app/polls`  
**User Role:** Syndic (create/manage), Residents (vote/view results)  
**Purpose:** Create polls for resident voting on building decisions and track voting results.

### 5.2 User Stories
1. As a Syndic, I want to create polls with multiple options so residents can vote on building decisions.
2. As a Resident, I want to vote on polls so I can participate in building governance.
3. As a Resident, I want to see poll results so I can understand the community's preferences.
4. As a Syndic, I want to see who voted and how so I can track participation.

### 5.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Polls" (h1)
  - Status filter: All, Active, Closed
  - "Create Poll" button: Primary button (syndics only)

#### Polls List
**Card Components:**
- **Question:** Large, bold heading
- **Status Badge:**
  - Active: `bg-green-500 text-white`
  - Closed: `bg-muted text-muted-foreground`
- **Metadata:**
  - Created date
  - Created by (syndic name)
  - Total votes count
  - "Ends on" date (if applicable)
- **Actions:**
  - View/Vote button (primary)
  - Edit (syndics only)
  - Delete (syndics only)
  - View Results (if closed or user voted)

#### Create Poll Dialog
- **Trigger:** "Create Poll" button
- **Component:** shadcn/ui `Dialog` (large size)
- **Form Fields:**
  - Question (required, `Input`)
  - Options (required, dynamic list):
    - Add option button
    - Remove option button per option
    - Minimum 2 options
  - Residence (required, `Select`)
  - Active status (checkbox, default: checked)
- **Actions:** Cancel, Create Poll (primary)

#### Poll Voting View
- **Trigger:** View/Vote button on active poll
- **Component:** Full-page view or large dialog
- **Content:**
  - Poll question (large, centered)
  - Voting options:
    - Radio buttons for single choice
    - Each option shows current vote count (if user already voted)
  - "Submit Vote" button (primary)
  - "View Results" link (if already voted)
- **Voting Logic:**
  - One vote per user per poll (enforced by unique constraint)
  - Show message if user already voted
  - Disable voting if poll is closed

#### Poll Results View
- **Trigger:** View Results button
- **Component:** Full-page view or dialog
- **Content:**
  - Poll question
  - Results visualization:
    - Progress bars for each option showing percentage
    - Vote counts per option
    - Total votes
  - Voter list (optional, syndics only):
    - Who voted for which option
  - Export results button (CSV, syndics only)

### 5.4 Data Visualization
- **Results Chart:**
  - Horizontal progress bars for each option
  - Percentage and vote count displayed
  - Color-coded bars

### 5.5 Data Fetching
- Fetch from `dbasakan.polls` joined with `dbasakan.poll_options` and `dbasakan.poll_votes`
- Calculate vote counts per option
- Check if current user has voted
- Filter by active status

### 5.6 Loading & Error States
- **Loading:** Skeleton cards
- **Error:** Alert with retry
- **Empty State:** "No polls created. Create your first poll to gather resident feedback."

---

## 6. Access Control (QR Code Visitor Access)

### 6.1 Overview
**Page:** `/app/access-control`  
**User Role:** Residents (generate QR codes), Guards (scan QR codes), Syndics (view all logs)  
**Purpose:** Generate QR codes for visitor access and track entry/exit logs.

### 6.2 User Stories
1. As a Resident, I want to generate QR codes for visitors so they can access the building.
2. As a Guard, I want to scan QR codes to verify visitor access so I can maintain security.
3. As a Resident, I want to see my visitor access logs so I can track who has visited.
4. As a Syndic, I want to see all access logs so I can monitor building security.

### 6.3 UI/UX Requirements

#### Page Layout (Resident View)
- **Header Section:**
  - Page title: "Visitor Access" (h1)
  - "Generate QR Code" button: Primary button

- **Tabs:**
  - Active QR Codes
  - Access Logs

#### Generate QR Code Dialog
- **Trigger:** "Generate QR Code" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Visitor Name (required, `Input`)
  - Valid From (required, Date and time picker, default: now)
  - Valid To (required, Date and time picker)
  - Residence (auto-selected)
- **Actions:** Cancel, Generate (primary)
- **After Generation:**
  - Display QR code image (large, centered)
  - Download QR code button (PNG/PDF)
  - Share button (copy link or email)
  - QR code details (visitor name, validity period)

#### Active QR Codes List
**Card Components:**
- **Visitor Name:** Bold heading
- **QR Code:** Thumbnail image
- **Validity Period:** "Valid from [date] to [date]"
- **Status Badge:**
  - Active: `bg-green-500 text-white`
  - Expired: `bg-muted text-muted-foreground`
  - Used: `bg-blue-500 text-white` (if scanned)
- **Actions:**
  - View/Download QR code
  - Revoke (if not yet scanned)

#### Access Logs Table
**Columns:**
1. **Visitor Name**
2. **Generated By** (resident name)
3. **Valid From/To**
4. **Scanned At** (if scanned)
5. **Scanned By** (guard name, if scanned)
6. **Status:**
   - Pending (not scanned)
   - Used (scanned)
   - Expired (not scanned, past valid_to)

#### Guard Scanning Interface (Mobile-Optimized)
- **Page:** `/app/access-control/scan` (or modal)
- **UI:**
  - Large camera viewfinder area
  - "Scan QR Code" button
  - Manual entry option (for QR code data)
  - Success/Error feedback
  - Recent scans list

### 6.4 QR Code Generation
- Use a QR code library (e.g., `qrcode` npm package)
- Generate QR code with unique data (hash or UUID)
- Store QR code data in `dbasakan.access_logs`
- QR code contains: visitor name, validity period, unique identifier

### 6.5 Data Fetching
- Fetch from `dbasakan.access_logs` joined with `dbasakan.profiles`
- Filter by residence and user (for residents)
- Sort by `valid_to` DESC (newest first)

### 6.6 Loading & Error States
- **Loading:** Skeleton cards
- **Error:** Alert with retry
- **Empty State:** "No QR codes generated. Generate your first visitor QR code."

---

## 7. Deliveries Management

### 7.1 Overview
**Page:** `/app/deliveries`  
**User Role:** Guards (log deliveries), Residents (view own deliveries), Syndics (view all)  
**Purpose:** Track package deliveries and notify residents when packages arrive.

### 7.2 User Stories
1. As a Guard, I want to log incoming deliveries so residents know their packages have arrived.
2. As a Resident, I want to see my pending deliveries so I can pick them up.
3. As a Resident, I want to mark deliveries as picked up so guards know packages are collected.
4. As a Syndic, I want to see all delivery logs so I can monitor package traffic.

### 7.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Deliveries" (h1)
  - Status filter: All, Pending, Picked Up
  - "Log Delivery" button: Primary button (guards only)

#### Deliveries Table
**Columns:**
1. **Date/Time**
   - Created timestamp
   - Format: "MMM DD, YYYY HH:MM"

2. **Recipient**
   - Resident name from joined `profiles.full_name`
   - Apartment number

3. **Description**
   - Delivery description
   - Truncate with tooltip

4. **Logged By**
   - Guard name who logged the delivery

5. **Status** (Badge)
   - Pending: `bg-yellow-500 text-white`
   - Picked Up: `bg-green-500 text-white`
   - Shows picked up timestamp if collected

6. **Actions**
   - Mark as Picked Up (residents, if pending)
   - Edit (guards/syndics)
   - Delete (guards/syndics)

#### Log Delivery Dialog
- **Trigger:** "Log Delivery" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Recipient (required, `Select` dropdown - searchable resident list)
  - Description (required, `Textarea`)
  - Residence (auto-selected or required)
- **Actions:** Cancel, Log Delivery (primary)

#### Mark as Picked Up
- **Trigger:** "Mark as Picked Up" action
- **Component:** Confirmation dialog or inline action
- **Content:**
  - Confirmation message
  - Update `picked_up_at` timestamp
- **Feedback:** Toast notification on success

### 7.4 Data Fetching
- Fetch from `dbasakan.deliveries` joined with `dbasakan.profiles` and `dbasakan.residences`
- Filter by status and date
- For residents: Only show their own deliveries
- Sort by `created_at` DESC (newest first)

### 7.5 Loading & Error States
- **Loading:** Skeleton table
- **Error:** Alert with retry
- **Empty State:** "No deliveries logged. Log your first delivery."

---

## 8. Transaction History & Export

### 8.1 Overview
**Page:** `/app/transactions`  
**User Role:** Syndic (Admin)  
**Purpose:** View unified transaction history (payments and expenses), filter, search, and export to CSV.

### 8.2 User Stories
1. As a Syndic, I want to see all financial transactions in one place so I can review cash flow.
2. As a Syndic, I want to filter transactions by type, date, and method so I can find specific records.
3. As a Syndic, I want to export transactions to CSV so I can use them in accounting software.
4. As a Syndic, I want to see transaction totals and summaries so I can understand financial trends.

### 8.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Transaction History" (h1)
  - Date range picker: Start and end dates
  - "Export CSV" button: Secondary button (top right)

- **Summary Cards:**
  - Total Income (payments)
  - Total Expenses
  - Net Balance
  - Transaction Count

#### Transaction Table
**Tabs:**
- All Transactions (default)
- Payments Only
- Expenses Only

**Columns:**
1. **Date** (sortable)
   - Transaction date
   - Format: "MMM DD, YYYY"

2. **Type** (Badge)
   - Payment: `bg-green-500 text-white` (or success color)
   - Expense: `bg-red-500 text-white` (or destructive color)
   - Icon: Lucide `ArrowDown` (income) or `ArrowUp` (expense)

3. **Description**
   - Payment: Fee title or "Payment"
   - Expense: Expense description
   - Truncate with tooltip

4. **Resident/Payee**
   - Payment: Resident name
   - Expense: Payee or category

5. **Amount** (sortable)
   - Formatted currency
   - Right-aligned
   - Color: Green for income, red for expenses

6. **Method**
   - Payment method badge (Cash, Bank Transfer, Online, Check)
   - Expense: "N/A" or category

7. **Status** (Badge)
   - Payment status (Pending, Completed, Rejected)
   - Expense: Always "Completed"

8. **Actions**
   - View Details (opens details dialog)

#### Filters
- **Search:** By resident name, description, or amount
- **Type:** Payment/Expense/All (tabs)
- **Method:** Dropdown (Cash, Bank Transfer, Online, Check)
- **Status:** Dropdown (Pending, Completed, Rejected)
- **Date Range:** Start and end date pickers

#### Transaction Details Dialog
- **Trigger:** View Details action
- **Component:** shadcn/ui `Dialog` (large size)
- **Content:**
  - All transaction fields
  - Related fee information (if payment linked to fee)
  - Receipt/attachment download (if available)
  - Created/updated timestamps

#### Export CSV
- **Trigger:** "Export CSV" button
- **Functionality:**
  - Export currently filtered transactions
  - Include all visible columns
  - Filename: `transactions_YYYY-MM-DD.csv`
  - Download automatically
  - Toast notification on success

### 8.4 Data Fetching
- Fetch from `dbasakan.payments` and `dbasakan.expenses`
- Join with `dbasakan.profiles` and `dbasakan.residences`
- Combine into unified array with `type` field
- Calculate totals and summaries
- Apply filters and search

### 8.5 Loading & Error States
- **Loading:** Skeleton table
- **Error:** Alert with retry
- **Empty State:** "No transactions found. Transactions will appear here as payments and expenses are recorded."

---

## 9. Balance Snapshots

### 9.1 Overview
**Page:** `/app/balance-snapshots`  
**User Role:** Syndic (Admin)  
**Purpose:** Create and view historical balance snapshots for financial reconciliation and reporting.

### 9.2 User Stories
1. As a Syndic, I want to create balance snapshots at specific dates so I can track financial history.
2. As a Syndic, I want to view past balance snapshots so I can compare financial states over time.
3. As a Syndic, I want to see cash and bank balances at snapshot dates so I can reconcile accounts.

### 9.3 UI/UX Requirements

#### Page Layout
- **Header Section:**
  - Page title: "Balance Snapshots" (h1)
  - "Create Snapshot" button: Primary button

#### Snapshots Table
**Columns:**
1. **Snapshot Date** (sortable)
   - Date when snapshot was created
   - Format: "MMM DD, YYYY"

2. **Cash Balance**
   - Cash balance at snapshot date
   - Formatted currency
   - Right-aligned

3. **Bank Balance**
   - Bank balance at snapshot date
   - Formatted currency
   - Right-aligned

4. **Total Balance**
   - Sum of cash and bank
   - Formatted currency, bold
   - Right-aligned

5. **Created By**
   - Creator name

6. **Actions**
   - View Details
   - Delete (with confirmation)

#### Create Snapshot Dialog
- **Trigger:** "Create Snapshot" button
- **Component:** shadcn/ui `Dialog`
- **Form Fields:**
  - Snapshot Date (required, Date picker, default: today)
  - Residence (required, `Select` - if multiple)
  - Notes (optional, `Textarea`)
- **Actions:** Cancel, Create Snapshot (primary)
- **Calculation:**
  - Automatically calculate cash and bank balances up to snapshot date
  - Display calculated values before confirmation

#### Snapshot Details View
- **Trigger:** View Details action
- **Component:** Full-page view or large dialog
- **Content:**
  - Snapshot date and metadata
  - Cash balance breakdown
  - Bank balance breakdown
  - Notes (if any)
  - Comparison with previous snapshot (optional)

### 9.4 Data Fetching
- Fetch from `dbasakan.balance_snapshots` joined with `dbasakan.profiles` and `dbasakan.residences`
- Calculate balances from payments and expenses up to snapshot date
- Sort by `snapshot_date` DESC (newest first)

### 9.5 Loading & Error States
- **Loading:** Skeleton table
- **Error:** Alert with retry
- **Empty State:** "No balance snapshots created. Create your first snapshot to start tracking financial history."

---

## 10. Navigation & Sidebar Updates

### 10.1 Sidebar Navigation
Update the existing sidebar (`components/app/Sidebar.tsx`) to include all new pages:

**Navigation Items:**
1. Dashboard (existing)
2. Residents (new)
3. Payments (existing)
4. Expenses (new)
5. Incidents (new)
6. Announcements (new)
7. Polls (new)
8. Access Control (new)
9. Deliveries (new)
10. Transactions (new)
11. Balance Snapshots (new)
12. Notes (existing)
13. Profile (existing)
14. Billing (existing)

**Icons (Lucide React):**
- Dashboard: `LayoutDashboard`
- Residents: `Users`
- Payments: `CreditCard`
- Expenses: `Receipt`
- Incidents: `AlertTriangle`
- Announcements: `Megaphone`
- Polls: `Vote`
- Access Control: `QrCode`
- Deliveries: `Package`
- Transactions: `FileText`
- Balance Snapshots: `Camera`
- Notes: `StickyNote`
- Profile: `UserCircle`
- Billing: `CreditCard`

### 10.2 Active Route Highlighting
- Highlight active navigation item with `bg-primary text-primary-foreground`
- Use Next.js `usePathname()` hook to detect current route

### 10.3 Mobile Responsiveness
- Collapsible sidebar on mobile
- Use shadcn/ui `Sheet` component for mobile menu
- Hamburger menu button in header

---

## 11. Common UI Patterns

### 11.1 Data Tables
- Use shadcn/ui `Table` component
- Sticky header on scroll
- Horizontal scroll on mobile
- Sortable columns (where applicable)
- Row hover effects
- Alternating row colors (optional)

### 11.2 Forms
- Use shadcn/ui `Form` components
- Real-time validation
- Error messages below fields
- Required field indicators (*)
- Loading state on submit
- Success/error toast notifications

### 11.3 Dialogs/Modals
- Use shadcn/ui `Dialog` component
- Full-screen on mobile
- Close on backdrop click
- Escape key to close
- Focus trap for accessibility

### 11.4 Badges
- Use shadcn/ui `Badge` component
- Consistent color coding across features
- Status badges: Green (success), Yellow (warning), Red (error), Gray (neutral)

### 11.5 Loading States
- Use shadcn/ui `Skeleton` components
- Match the structure of loaded content
- Show loading spinner for async operations

### 11.6 Empty States
- Friendly illustration or icon
- Clear message explaining the empty state
- Call-to-action button (if applicable)

### 11.7 Error States
- Use shadcn/ui `Alert` component
- Clear error message
- Retry button (if applicable)
- Log errors to console for debugging

### 11.8 Toast Notifications
- Use react-hot-toast
- Success: Green toast
- Error: Red toast
- Info: Blue toast
- Duration: 3-5 seconds

---

## 12. Accessibility Requirements

### 12.1 Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order should be logical
- Enter/Space to activate buttons
- Escape to close dialogs

### 12.2 Screen Readers
- All images must have `alt` text
- All buttons must have `aria-label` or visible text
- Form inputs must have associated labels
- Tables must have proper headers

### 12.3 Color Contrast
- All text must meet WCAG AA contrast requirements
- Use Tailwind variable colors (they meet contrast standards)

### 12.4 Focus Indicators
- Visible focus rings on all interactive elements
- Use Tailwind's default focus styles

---

## 13. Performance Considerations

### 13.1 Data Fetching
- Use server actions for data mutations
- Implement pagination for large datasets (20-50 items per page)
- Use React Suspense for loading states
- Cache data where appropriate

### 13.2 Image Optimization
- Use Next.js `Image` component for all images
- Lazy load images below the fold
- Optimize QR code images

### 13.3 Code Splitting
- Use Next.js automatic code splitting
- Lazy load heavy components if needed (but avoid dynamic imports per project rules)

---

## 14. Debug Logging Requirements

All features must include comprehensive debug logging:

### 14.1 Log Format
```typescript
console.log('[FeatureName] Action description', { data });
console.error('[FeatureName] Error description', error);
```

### 14.2 Required Logs
- Page/component render
- Data fetch start/end
- User actions (clicks, form submissions)
- Success/error states
- Filter/search changes

### 14.3 Example Logs
```typescript
console.log('[Residents] Rendering residents page');
console.log('[Residents] Fetching residents list', { search, filter });
console.log('[Residents] Successfully fetched residents', { count: residents.length });
console.log('[Residents] Adding resident', formData);
console.log('[Residents] Successfully added resident', newResident);
console.error('[Residents] Error adding resident', error);
```

---

## 15. Implementation Priority

### Phase 1 (High Priority)
1. Residents Management
2. Expenses Management
3. Incidents Management

### Phase 2 (Medium Priority)
4. Announcements
5. Transaction History & Export

### Phase 3 (Lower Priority)
6. Polls & Voting
7. Access Control (QR Codes)
8. Deliveries Management
9. Balance Snapshots

---

## 16. Success Criteria

### 16.1 Functional Requirements
- ✅ All features work as specified in user stories
- ✅ All data operations (CRUD) function correctly
- ✅ All filters and search work properly
- ✅ All exports generate correct data

### 16.2 UI/UX Requirements
- ✅ All pages are responsive (mobile, tablet, desktop)
- ✅ All components use shadcn/ui and Tailwind variable colors
- ✅ All interactions provide visual feedback
- ✅ All error states are user-friendly

### 16.3 Technical Requirements
- ✅ All debug logs are present
- ✅ All accessibility requirements are met
- ✅ All performance optimizations are implemented
- ✅ Code follows project structure and conventions

---

## Appendix A: Database Schema Reference

### Key Tables
- `dbasakan.profiles` - User profiles (residents, syndics, guards)
- `dbasakan.residences` - Buildings/residences
- `dbasakan.fees` - Monthly/periodic fees
- `dbasakan.payments` - Payment records
- `dbasakan.expenses` - Building expenses
- `dbasakan.incidents` - Maintenance requests
- `dbasakan.announcements` - Building announcements
- `dbasakan.polls` - Voting polls
- `dbasakan.poll_options` - Poll voting options
- `dbasakan.poll_votes` - Individual votes
- `dbasakan.access_logs` - QR code visitor access logs
- `dbasakan.deliveries` - Package delivery logs
- `dbasakan.transaction_history` - Financial transaction audit trail
- `dbasakan.balance_snapshots` - Historical balance records

### Key Relationships
- Profiles belong to Residences (many-to-one)
- Fees belong to Profiles and Residences (many-to-one each)
- Payments belong to Profiles, Residences, and optionally Fees
- Expenses belong to Residences (many-to-one)
- Incidents belong to Residences and Profiles (reporter)
- All other entities belong to Residences

---

## Appendix B: Component Library Reference

### shadcn/ui Components Used
- `Button` - All buttons
- `Card` - Summary cards, content cards
- `Dialog` - All modals/dialogs
- `AlertDialog` - Confirmation dialogs
- `Table` - All data tables
- `Input` - Text inputs
- `Textarea` - Multi-line inputs
- `Select` - Dropdown selects
- `Badge` - Status badges, labels
- `Tabs` - Tab navigation
- `DropdownMenu` - Action menus
- `Skeleton` - Loading states
- `Alert` - Error messages
- `Form` - Form components
- `DatePicker` - Date selection
- `Sheet` - Mobile sidebar

### Lucide React Icons
- Navigation icons
- Action icons (edit, delete, view)
- Status icons
- Feature-specific icons

---



# SAKAN Project Architecture

## Related Docs
- [Database Schema](./database_schema.md)
- [SOP: Database Migrations](../SOP/database_migrations.md)
- [SOP: Supabase Integration](../SOP/supabase_integration.md)
- [SOP: Adding New Pages](../SOP/adding_new_pages.md)

## Project Overview

### Project Goal
SAKAN (also referred to as MyResidency) is a comprehensive property/residence management SaaS platform designed to help syndics (property managers) efficiently manage residential buildings. The platform enables management of residents, fees, payments, expenses, incidents, announcements, polls, access control, and deliveries.

### Domain
**Property Management / Building Management System**

Key entities:
- **Residences**: Buildings/apartments managed by syndics
- **Residents**: People living in residences
- **Syndics**: Property managers with admin access
- **Guards**: Security personnel with limited access
- **Fees**: Monthly/periodic charges for residents
- **Payments**: Payment records (cash, bank transfer, online)
- **Expenses**: Building maintenance and operational costs
- **Incidents**: Maintenance requests and issues
- **Announcements**: Building-wide communications
- **Polls**: Resident voting on building matters
- **Access Logs**: QR code-based visitor access
- **Deliveries**: Package and delivery tracking

## Technology Stack

### Frontend
- **Framework**: Next.js 15.1.7 (App Router)
- **React**: 19.0.0
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Notifications**: react-hot-toast

### Backend
- **Runtime**: Node.js (Next.js Server)
- **API**: Next.js API Routes (App Router)
- **Server Actions**: Next.js Server Actions (`'use server'`)
- **Database**: Supabase (PostgreSQL)
- **ORM/Query**: Supabase JS Client

### Authentication & Authorization
- **Auth Library**: NextAuth 5.0.0-beta.25
- **Providers**: 
  - Google OAuth
  - Email (Nodemailer/Resend)
- **Adapter**: Custom Supabase Adapter
- **Session Management**: NextAuth sessions with Supabase JWT
- **Schema**: `dbasakan` schema in Supabase

### Payment Processing
- **Provider**: Stripe
- **Integration**: Stripe Checkout, Billing Portal, Webhooks
- **Plans**: Free, Basic, Pro (monthly/yearly)

### Email
- **Provider**: Nodemailer (configurable to Resend)
- **Templates**: React Email
- **SMTP**: Configurable (Gmail default)

### Analytics & Monitoring
- **Google Analytics**: Google Tag Manager integration
- **OpenPanel**: User analytics

### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Build Tool**: Next.js (Turbopack in dev)

## Project Structure

```
SAKAN/
├── app/                          # Next.js App Router
│   ├── actions/                  # Server actions
│   │   ├── auth.ts              # Authentication actions
│   │   └── stripe.ts            # Stripe payment actions
│   ├── api/                      # API routes
│   │   ├── (payment)/           # Payment-related routes
│   │   │   ├── checkout/       # Stripe checkout
│   │   │   └── refund/         # Refund handling
│   │   ├── auth/                # NextAuth routes
│   │   ├── webhook/stripe/     # Stripe webhooks
│   │   ├── profile/            # User profile API
│   │   └── account/delete/     # Account deletion
│   ├── app/                     # Authenticated app routes
│   │   ├── layout.tsx          # App layout (Header)
│   │   ├── page.tsx            # Dashboard home
│   │   ├── notes/              # Notes feature
│   │   ├── profile/            # User profile
│   │   └── billing/            # Billing management
│   ├── layout.tsx              # Root layout
│   ├── page.tsx               # Landing page
│   └── globals.css            # Global styles
├── components/                  # React components
│   ├── app/                    # App-specific components
│   │   ├── Header.tsx         # App header
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── billing/           # Billing components
│   │   ├── notes/             # Notes components
│   │   └── profile/           # Profile components
│   ├── ui/                     # shadcn/ui components
│   ├── stripe/                 # Stripe-specific components
│   ├── email/                  # Email templates
│   └── user/                   # User-related components
├── lib/                         # Core libraries
│   ├── auth.ts                 # NextAuth configuration
│   ├── auth.config.ts         # Auth config
│   ├── custom-supabase-adapter.ts  # NextAuth Supabase adapter
│   ├── authSendRequest.ts     # Email verification
│   ├── mail.ts                 # Email utilities
│   └── hooks/                  # Custom React hooks
├── utils/                       # Utility functions
│   ├── supabase/               # Supabase clients
│   │   ├── server.ts          # Server-side Supabase client
│   │   ├── client.ts          # Client-side Supabase client
│   │   ├── front.ts           # Frontend utilities
│   │   └── user.ts            # User utilities
│   └── stripe.ts              # Stripe client
├── types/                       # TypeScript types
│   ├── database.types.ts     # Supabase generated types
│   └── next-auth.d.ts        # NextAuth type extensions
├── supabase/                    # Supabase configuration
│   ├── migrations/             # Database migrations
│   └── config.toml            # Supabase config
├── prompt/                      # Feature implementation guides
├── .cursor/rules/              # Cursor IDE development rules
├── config.ts                   # App configuration
├── middleware.ts               # Next.js middleware
└── package.json               # Dependencies
```

## Authentication Architecture

### Flow Overview
1. User signs in via Google OAuth or Email (magic link)
2. NextAuth handles OAuth flow and creates session
3. Custom Supabase Adapter stores user in `dbasakan.users` (NextAuth)
4. Session includes `supabaseAccessToken` (JWT) for Supabase API calls
5. Middleware protects `/app` routes, redirects unauthenticated users

### Key Components

#### NextAuth Configuration (`lib/auth.config.ts`)
- **Providers**: Google OAuth, Email (Nodemailer/Resend)
- **Adapter**: `CustomSupabaseAdapter` with `dbasakan` schema
- **Session Callback**: Generates Supabase JWT token from session
- **Secret**: `AUTH_SECRET` from environment

#### Supabase Integration
- **Client Creation**: Two patterns
  - **Authenticated Client** (`utils/supabase/server.ts` - `getSupabaseClient`): Uses `supabaseAccessToken` from session
  - **Admin Client** (`createSupabaseAdminClient`): Uses `SUPABASE_SECRET_KEY` to bypass RLS
- **Schema**: All app tables in `dbasakan` schema
- **RLS**: Row Level Security enabled on all tables

#### Custom Supabase Adapter (`lib/custom-supabase-adapter.ts`)
- Implements NextAuth Adapter interface
- Uses `dbasakan` schema (not default `next_auth`)
- Tables: `users`, `accounts`, `sessions`, `verification_tokens`
- Separate from `auth.users` (Supabase Auth) and `dbasakan.profiles` (app data)

### Authentication Tables
- `dbasakan.users`: NextAuth user records
- `dbasakan.accounts`: OAuth provider accounts
- `dbasakan.sessions`: Active user sessions
- `dbasakan.verification_tokens`: Email verification tokens
- `dbasakan.profiles`: Extended user profile (links to `auth.users`)

## Payment Architecture

### Stripe Integration

#### Checkout Flow
1. User clicks checkout button with `priceId` and `productId`
2. Server action creates Stripe Checkout session
3. User redirected to Stripe hosted checkout
4. On success, webhook receives `checkout.session.completed`
5. Webhook updates `stripe_customers` table with subscription info

#### Webhook Events (`app/api/webhook/stripe/route.ts`)
- `checkout.session.completed`: Initial subscription creation
- `customer.subscription.updated`: Plan changes, renewals
- `customer.subscription.deleted`: Subscription cancellation
- `invoice.payment_succeeded`: Successful payment

#### Billing Portal
- Server action creates Stripe Billing Portal session
- Users can manage subscriptions, update payment methods
- Redirects back to `/app` after session

#### Database
- `stripe_customers` table stores:
  - `user_id`: Links to NextAuth user
  - `stripe_customer_id`: Stripe customer ID
  - `subscription_id`: Active subscription ID
  - `plan_active`: Boolean flag
  - `plan_expires`: Timestamp

## API Architecture

### API Routes (App Router)
Located in `app/api/`:

- **`/api/auth/[...nextauth]`**: NextAuth handler (GET/POST)
- **`/api/auth/route`**: Additional auth endpoints
- **`/api/webhook/stripe`**: Stripe webhook handler (POST only)
- **`/api/(payment)/checkout`**: Stripe checkout session creation
- **`/api/(payment)/refund`**: Refund processing
- **`/api/profile`**: User profile data (GET)
- **`/api/account/delete`**: Account deletion

### Server Actions
Located in `app/actions/`:

- **`auth.ts`**: `handleSignIn()`, `handleSignOut()`
- **`stripe.ts`**: `createPortalSession()`, `refund()`
- Feature-specific actions in `app/[feature]/actions.ts`

### Data Fetching Patterns

#### Server Components
```typescript
// Direct Supabase query in server component
const supabase = await getSupabaseClient();
const { data, error } = await supabase.from('table').select();
```

#### Server Actions
```typescript
'use server';
export async function actionName() {
  const supabase = await getSupabaseClient();
  // Perform mutation
}
```

#### Client Components
- Use server actions via form actions or onClick handlers
- No direct Supabase queries in client (uses server actions)

## Frontend Architecture

### Component Organization
- **`components/app/`**: App-specific components (Header, Sidebar, feature components)
- **`components/ui/`**: shadcn/ui reusable components
- **`components/stripe/`**: Stripe-specific UI components
- **`components/email/`**: React Email templates

### Styling Approach
- **Tailwind CSS**: Utility-first styling
- **CSS Variables**: Theme colors defined in `globals.css`
  - `--primary`, `--primary-hover`
  - `--background`, `--foreground`
  - `--border`, `--border-hover`
- **shadcn/ui**: Pre-built accessible components
- **Responsive**: Mobile-first design

### State Management
- **Server State**: Supabase queries in server components/actions
- **Client State**: React hooks (`useState`, `useEffect`)
- **Forms**: Server actions with form actions
- **No global state library**: Uses React built-in state

### Routing
- **App Router**: Next.js 15 App Router
- **Protected Routes**: `/app/*` protected by middleware
- **Public Routes**: `/`, `/api/auth/signin`, `/success`

## Integration Points

### Supabase
- **Database**: PostgreSQL with `dbasakan` schema
- **Auth**: NextAuth (not Supabase Auth for users, but uses Supabase for storage)
- **RLS**: Row Level Security on all tables
- **Real-time**: Available but not currently used
- **Storage**: Available for file uploads (receipts, attachments)

### Stripe
- **Checkout**: Hosted checkout pages
- **Billing Portal**: Customer self-service
- **Webhooks**: Server-side event handling
- **API Version**: 2025-01-27.acacia

### Email
- **Nodemailer**: SMTP email sending
- **React Email**: HTML email templates
- **Resend**: Alternative provider (configurable)

### Analytics
- **Google Tag Manager**: Page view tracking
- **OpenPanel**: User behavior analytics

## Environment Configuration

### Required Environment Variables

#### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon/public key
SUPABASE_SECRET_KEY=               # Supabase service_role key (for admin operations)
SUPABASE_JWT_SECRET=               # JWT secret for token signing
```

#### Authentication
```env
AUTH_SECRET=                       # NextAuth secret
AUTH_GOOGLE_ID=                    # Google OAuth client ID
AUTH_GOOGLE_SECRET=                # Google OAuth client secret
AUTH_RESEND_KEY=                   # Resend API key (optional)
```

#### Stripe
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Stripe publishable key
STRIPE_SECRET_KEY=                  # Stripe secret key
STRIPE_WEBHOOK_SECRET=              # Stripe webhook signing secret
```

#### Email
```env
EMAIL_SERVER_HOST=                  # SMTP host (e.g., smtp.gmail.com)
EMAIL_SERVER_PORT=                  # SMTP port (e.g., 465)
EMAIL_SERVER_USER=                   # SMTP username
EMAIL_SERVER_PASSWORD=              # SMTP password
EMAIL_FROM=                         # From email address
```

#### Analytics (Optional)
```env
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=    # Google Analytics ID
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=    # OpenPanel client ID
```

## Development Workflow

### Running the Project
```bash
npm install          # Install dependencies
npm dev              # Start dev server with Turbopack
npm build            # Production build
npm start            # Start production server
npm lint             # Run ESLint
npm lint:ts          # Type check
```

### Database Migrations
1. Create migration file in `supabase/migrations/`
2. Run via Supabase Dashboard SQL Editor or CLI
3. See [database_migrations.md](../SOP/database_migrations.md)

### Adding Components
```bash
npx shadcn@latest add [component-name]
```

## Key Design Decisions

1. **NextAuth over Supabase Auth**: Provides more flexibility with multiple providers and better integration with existing SaaS patterns
2. **Custom Supabase Adapter**: Allows using `dbasakan` schema instead of default
3. **Server Actions over API Routes**: Simpler data mutations, better TypeScript support
4. **App Router**: Modern Next.js routing with server components
5. **shadcn/ui**: Accessible, customizable component library
6. **Separate Auth Tables**: NextAuth tables separate from app `profiles` table for clear separation of concerns

## Security Considerations

- **RLS**: All tables have Row Level Security enabled
- **Service Role**: Only used server-side for admin operations
- **JWT Tokens**: Supabase access tokens generated per session
- **Middleware**: Protects authenticated routes
- **Environment Variables**: Sensitive keys never exposed to client
- **Stripe Webhooks**: Signature verification on all webhook events

## Performance Optimizations

- **Server Components**: Default rendering on server
- **Suspense**: Used for loading states
- **Turbopack**: Faster dev builds
- **Image Optimization**: Next.js Image component
- **Database Indexes**: On foreign keys and frequently queried columns



**End of PRD**

This document should be updated as features are implemented and requirements evolve.

