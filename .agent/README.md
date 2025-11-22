# SAKAN Documentation Index

Welcome to the SAKAN (MyResidency) documentation. This index provides a comprehensive guide to all documentation available in the `.agent` folder, helping engineers quickly find the information they need.

## 📋 Overview

SAKAN is a property/residence management SaaS platform built for syndics (property managers) to manage residential buildings, residents, fees, payments, expenses, incidents, announcements, and more.

## 🏗️ Complete Project Architecture

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.1.7 (App Router)
- **React**: 19.0.0
- **TypeScript**: 5.x
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React 0.475.0
- **Animations**: Framer Motion 12.4.7
- **Notifications**: react-hot-toast 2.5.2
- **Forms**: React Hook Form (implicit via shadcn/ui)

#### Backend
- **Runtime**: Node.js (Next.js Server)
- **API Framework**: Next.js API Routes (App Router)
- **Server Actions**: Next.js Server Actions (`'use server'`)
- **Database**: Supabase (PostgreSQL)
- **Query Client**: Supabase JS Client 2.48.1
- **Schema**: Custom `dbasakan` schema (not `public`)

#### Authentication & Authorization
- **Auth Library**: NextAuth 5.0.0-beta.25
- **Providers**: 
  - Google OAuth (via `next-auth/providers/google`)
  - Email Magic Link (via Nodemailer or Resend)
- **Adapter**: Custom Supabase Adapter (`lib/custom-supabase-adapter.ts`)
- **Session Management**: NextAuth sessions with Supabase JWT tokens
- **Middleware**: Route protection (`middleware.ts`)

#### Payment Processing
- **Provider**: Stripe 17.6.0
- **Integration**: 
  - Stripe Checkout (hosted checkout pages)
  - Stripe Billing Portal (customer self-service)
  - Stripe Webhooks (event handling)
- **SDK**: `@stripe/stripe-js` 5.6.0
- **API Version**: 2025-01-27.acacia
- **Plans**: Free, Basic (15.80$/mo or 160.50$/yr), Pro (20.00$/mo or 180.00$/yr)

#### Email Services
- **Provider**: Nodemailer 6.10.0 (configurable to Resend)
- **Templates**: React Email 3.0.7 (`@react-email/components`, `@react-email/render`)
- **SMTP**: Configurable (Gmail default)

#### Analytics & Monitoring
- **Google Analytics**: Google Tag Manager integration (`@next/third-parties`)
- **OpenPanel**: User analytics (`@openpanel/nextjs` 1.0.7)

#### Development Tools
- **Package Manager**: pnpm 10.23.0
- **Linting**: ESLint 9
- **Type Checking**: TypeScript 5
- **Build Tool**: Next.js with Turbopack (dev mode)
- **PDF Generation**: pdf-lib (via `utils/pdf.ts`)

### Complete Project Structure

```
SAKAN/
├── .agent/                          # Documentation folder
│   ├── System/                      # System architecture docs
│   │   ├── project_architecture.md  # Main architecture doc
│   │   └── database_schema.md      # Database schema docs
│   ├── SOP/                         # Standard Operating Procedures
│   │   ├── database_migrations.md   # Migration guide
│   │   ├── adding_new_pages.md     # Page creation guide
│   │   ├── supabase_integration.md # Supabase best practices
│   │   └── server_actions.md       # Server action patterns
│   └── README.md                   # This file
│
├── app/                             # Next.js App Router
│   ├── actions/                     # Server Actions (grouped by feature)
│   │   ├── auth.ts                 # Authentication actions
│   │   ├── dashboard.ts            # Dashboard data fetching
│   │   ├── payments.ts             # Payment operations (cash, balance)
│   │   ├── stripe.ts               # Stripe-specific actions
│   │   └── stripe/                 # Stripe actions subfolder (empty)
│   │
│   ├── api/                         # API Routes
│   │   ├── (payment)/              # Payment route group
│   │   │   ├── checkout/           # POST: Create Stripe checkout session
│   │   │   │   └── route.ts
│   │   │   ├── refund/             # POST: Process refunds
│   │   │   │   └── route.ts
│   │   │   └── subscription/       # Subscription management
│   │   │       └── update/         # POST: Update subscription
│   │   │           └── route.ts
│   │   │
│   │   ├── account/                # Account management
│   │   │   └── delete/             # DELETE: Delete user account
│   │   │       └── route.ts
│   │   │
│   │   ├── auth/                   # Authentication routes
│   │   │   ├── [...nextauth]/      # NextAuth catch-all handler
│   │   │   │   └── route.ts        # GET/POST: Sign in, sign out, callback
│   │   │   └── route.ts            # Additional auth endpoints
│   │   │
│   │   ├── payments/               # Payment API
│   │   │   └── route.ts            # GET: Fetch payments list
│   │   │
│   │   ├── profile/                # User profile API
│   │   │   └── route.ts            # GET/POST: Profile data
│   │   │
│   │   ├── stripe/                 # Stripe API routes (structure exists)
│   │   │   ├── checkout/           # (placeholder)
│   │   │   ├── prices/             # (placeholder)
│   │   │   ├── status/             # (placeholder)
│   │   │   ├── subscriptions/      # Subscription management
│   │   │   │   └── [id]/           # Dynamic subscription routes
│   │   │   │       ├── cancel/     # (placeholder)
│   │   │   │       └── update/     # (placeholder)
│   │   │   └── webhook/            # (placeholder)
│   │   │
│   │   ├── subscription/           # Subscription routes (alternative)
│   │   │   ├── cancel/             # (placeholder)
│   │   │   └── update/             # (placeholder)
│   │   │
│   │   ├── subscription-status/    # (placeholder)
│   │   │
│   │   └── webhook/                # Webhook handlers
│   │       └── stripe/             # Stripe webhook handler
│   │           └── route.ts        # POST: Process Stripe events
│   │
│   ├── app/                         # Authenticated app routes (/app/*)
│   │   ├── layout.tsx              # App layout with Header
│   │   ├── page.tsx                # Dashboard home (overview)
│   │   │
│   │   ├── actions/                # App-specific actions (empty)
│   │   │
│   │   ├── billing/                # Billing & subscription page
│   │   │   └── page.tsx            # Subscription management UI
│   │   │
│   │   ├── notes/                  # Notes feature
│   │   │   ├── page.tsx            # Notes list and creation
│   │   │   └── actions.ts          # Notes server actions
│   │   │
│   │   ├── payments/               # Payments management page
│   │   │   └── page.tsx            # Payments list, balance tracking
│   │   │
│   │   ├── profile/                # User profile page
│   │   │   └── page.tsx            # Profile & billing info
│   │   │
│   │   └── residents/              # Residents management (placeholder)
│   │
│   ├── favicon.ico                  # Site favicon
│   ├── globals.css                  # Global styles & CSS variables
│   ├── layout.tsx                   # Root layout (providers, analytics)
│   ├── page.tsx                     # Public landing page
│   │
│   └── success/                     # Payment success page
│       └── page.tsx                 # Stripe checkout success redirect
│
├── components/                      # React components
│   ├── app/                         # App-specific components
│   │   ├── Header.tsx              # App header with navigation
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   │
│   │   ├── billing/                # Billing components
│   │   │   ├── BillingContent.tsx  # Main billing page content
│   │   │   ├── BillingInfo.tsx     # Subscription info display
│   │   │   └── loading.tsx         # Loading skeleton
│   │   │
│   │   ├── dashboard/              # Dashboard components
│   │   │   ├── DashboardContent.tsx # Main dashboard content
│   │   │   └── OverviewCards.tsx   # Stat cards (residents, balance, etc.)
│   │   │
│   │   ├── notes/                  # Notes components
│   │   │   ├── AddNoteForm.tsx     # Note creation form
│   │   │   └── loading.tsx         # Loading skeleton
│   │   │
│   │   ├── payments/               # Payment components
│   │   │   ├── PaymentsContent.tsx # Main payments page content
│   │   │   ├── PaymentsTable.tsx   # Payments list table
│   │   │   └── AddPaymentDialog.tsx # Cash payment entry dialog
│   │   │
│   │   ├── profile/                # Profile components
│   │   │   ├── ProfileAndBillingContent.tsx # Profile & billing form
│   │   │   ├── DeleteAccountButton.tsx # Account deletion button
│   │   │   └── loading.tsx         # Loading skeleton
│   │   │
│   │   └── residents/              # Residents components (placeholder)
│   │
│   ├── CheckoutButton.tsx           # Stripe checkout button component
│   │
│   ├── email/                       # Email templates (React Email)
│   │   └── VerificationEmail.tsx   # Magic link email template
│   │
│   ├── hoc/                         # Higher-Order Components (empty)
│   │
│   ├── Pricing.tsx                  # Pricing page component
│   │
│   ├── SessionProvider.tsx          # NextAuth session provider wrapper
│   │
│   ├── sign-in.tsx                  # Sign-in button component
│   ├── sign-out.tsx                 # Sign-out button component
│   │
│   ├── stripe/                      # Stripe-specific components
│   │   ├── CanceledSubscriptionAlert.tsx # Cancellation warning alert
│   │   ├── PlanChangeButton.tsx    # Plan upgrade/downgrade button
│   │   ├── PortalButton.tsx        # Stripe Billing Portal button
│   │   ├── RefundButton.tsx        # Refund processing button
│   │   └── SubscriptionStatusCard.tsx # Subscription status display
│   │
│   ├── ui/                          # shadcn/ui components
│   │   ├── alert.tsx               # Alert component
│   │   ├── badge.tsx               # Badge component
│   │   ├── button.tsx              # Button component
│   │   ├── card.tsx                # Card component
│   │   ├── dialog.tsx              # Dialog/Modal component
│   │   ├── Footer.tsx              # Footer component
│   │   ├── FooterWrapper.tsx       # Footer wrapper
│   │   ├── input.tsx               # Input component
│   │   ├── label.tsx               # Label component
│   │   ├── select.tsx              # Select dropdown component
│   │   ├── table.tsx               # Table component
│   │   └── use-toast.ts            # Toast notification hook
│   │
│   └── user/                        # User-related components
│       └── UserMenu.tsx             # User menu dropdown
│
├── lib/                             # Core libraries & utilities
│   ├── auth.config.ts              # NextAuth configuration (providers, adapter)
│   ├── auth.ts                     # NextAuth handler (with Nodemailer)
│   ├── authSendRequest.ts          # Email verification request handler
│   ├── custom-supabase-adapter.ts  # Custom NextAuth Supabase adapter
│   │
│   ├── hooks/                       # Custom React hooks
│   │   └── useAuth.ts              # Auth hook (wraps NextAuth)
│   │
│   ├── mail.ts                      # Email sending utilities
│   │
│   ├── stripe/                      # Stripe service layer
│   │   ├── db/                      # Stripe database utilities (empty)
│   │   │
│   │   ├── services/                # Stripe service modules
│   │   │   ├── billing.service.ts  # Billing operations
│   │   │   ├── customer.service.ts # Customer management (get/create)
│   │   │   ├── payment.service.ts  # Payment operations
│   │   │   ├── subscription.service.ts # Subscription queries (active, canceled)
│   │   │   └── subscription-update.service.ts # Subscription updates
│   │   │
│   │   └── webhooks/                # Webhook handlers
│   │       └── handlers/            # (empty - webhooks in API route)
│   │
│   └── utils.ts                     # General utilities
│
├── utils/                           # Utility functions
│   ├── pdf.ts                       # PDF generation (cash receipts)
│   ├── stripe.ts                    # Stripe client initialization
│   │
│   └── supabase/                    # Supabase client utilities
│       ├── client.ts                # Client-side Supabase client
│       ├── front.ts                 # Frontend utilities
│       ├── server.ts                # Server-side Supabase client (authenticated/admin)
│       └── user.ts                  # User utilities
│
├── types/                           # TypeScript type definitions
│   ├── database.types.ts           # Supabase-generated database types
│   └── next-auth.d.ts              # NextAuth type extensions
│
├── supabase/                        # Supabase configuration
│   ├── config.toml                  # Supabase local config
│   │
│   └── migrations/                  # Database migrations
│       ├── 20241120000000_nextauth_schema.sql    # Initial schema (NextAuth + app tables)
│       ├── 20241121000000_fix_relationships_and_add_billing.sql # Fix FKs, add stripe_customers
│       ├── 20241122000000_create_profile_trigger.sql # Profile auto-creation trigger
│       └── 20241123000000_enhance_stripe_customers_table.sql # Enhanced billing fields
│
├── .cursor/                         # Cursor IDE rules
│   └── rules/                       # Development rules & guidelines
│       ├── create_supabase_table.mdc # Postgres table creation guidelines
│       ├── frontend_mdc.mdc        # Frontend implementation guidelines
│       ├── git.mdc                 # Git conventional commits
│       ├── run_shadcn_cmd_line_mdc.mdc # shadcn CLI usage
│       ├── supabase_types.mdc      # Supabase types guidelines
│       └── supabase_use.mdc        # Supabase auth usage
│
├── docs/                            # Additional documentation
│   ├── CANCELED_SUBSCRIPTION_UI.md # Canceled subscription UI docs
│   └── DEBUGGING_CANCELED_SUBSCRIPTION.md # Debugging guide
│
├── prompt/                          # Feature implementation guides (PRDs)
│   ├── 0-supabase-sql.md           # Initial SQL schema spec
│   ├── Cash Payment Entry & Receipt Generation.md
│   ├── Cash vs. Bank Balance Tracking.md
│   ├── Financial Dashboard Overview.md
│   ├── Implement Overall App Layout & Core UI.md
│   ├── Resident Notification Log.md
│   ├── Residents List & Fee Management.md
│   └── Transaction History & Export.md
│
├── specs/                           # Specifications & contracts
│   ├── 001-core-dashboard/         # Dashboard spec
│   │   ├── checklists/             # Feature checklists
│   │   └── contracts/              # API contracts
│   └── sprint_release_R1/          # Release 1 specs
│
├── public/                          # Static assets
│   ├── default-avatar.png          # Default user avatar
│   ├── file.svg                    # File icon
│   ├── globe.svg                   # Globe icon
│   ├── next.svg                    # Next.js logo
│   ├── vercel.svg                  # Vercel logo
│   └── window.svg                  # Window icon
│
├── config.ts                        # App configuration (metadata, Stripe plans, theme)
├── middleware.ts                    # Next.js middleware (route protection)
├── next.config.ts                   # Next.js configuration
├── next-env.d.ts                    # Next.js type definitions
├── package.json                     # Dependencies & scripts
├── postcss.config.mjs               # PostCSS configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── README.md                        # Root README (setup instructions)
├── SUPABASE_SETUP.md                # Supabase setup guide
└── NGROK_SETUP.md                   # ngrok setup for webhooks
```

### Core Features & Components

#### 1. Authentication System
- **NextAuth Integration**: Custom Supabase adapter for session management
- **Providers**: Google OAuth, Email magic link
- **Session Management**: JWT tokens with Supabase access tokens
- **Protected Routes**: Middleware protects `/app/*` routes
- **Profile Creation**: Automatic profile creation on sign-in

**Key Files**:
- `lib/auth.config.ts` - NextAuth configuration
- `lib/auth.ts` - NextAuth handler with providers
- `lib/custom-supabase-adapter.ts` - Custom adapter implementation
- `middleware.ts` - Route protection

#### 2. Dashboard (Overview)
- **Financial Overview**: Cash on hand, bank balance, outstanding fees
- **Operational Stats**: Total residents, open incidents, recent announcements
- **Real-time Data**: Fetched via server actions from Supabase

**Components**:
- `components/app/dashboard/DashboardContent.tsx` - Main dashboard
- `components/app/dashboard/OverviewCards.tsx` - Stat cards
- `app/actions/dashboard.ts` - Dashboard data fetching

#### 3. Payments Management
- **Cash Payments**: Entry and receipt generation (PDF)
- **Payment Tracking**: List all payments with filters
- **Balance Tracking**: Separate cash and bank balances
- **Payment Methods**: Cash, bank transfer, online card, check

**Components**:
- `components/app/payments/PaymentsContent.tsx` - Main payments page
- `components/app/payments/PaymentsTable.tsx` - Payments list
- `components/app/payments/AddPaymentDialog.tsx` - Cash payment entry
- `app/actions/payments.ts` - Payment operations
- `utils/pdf.ts` - PDF receipt generation

#### 4. Billing & Subscriptions (Stripe)
- **Subscription Management**: View current plan, upgrade/downgrade
- **Billing Portal**: Stripe-hosted customer portal
- **Subscription Status**: Active, canceled (with remaining access), expired
- **Webhook Handling**: Real-time subscription updates

**Components**:
- `components/app/billing/BillingContent.tsx` - Main billing page
- `components/app/billing/BillingInfo.tsx` - Subscription details
- `components/stripe/SubscriptionStatusCard.tsx` - Status display
- `components/stripe/PortalButton.tsx` - Billing portal button
- `components/stripe/PlanChangeButton.tsx` - Plan change button
- `components/stripe/CanceledSubscriptionAlert.tsx` - Cancellation warning

**Services**:
- `lib/stripe/services/subscription.service.ts` - Subscription queries
- `lib/stripe/services/customer.service.ts` - Customer management
- `lib/stripe/services/billing.service.ts` - Billing operations
- `app/api/webhook/stripe/route.ts` - Webhook handler

#### 5. Profile Management
- **User Profile**: Name, email, apartment number, role
- **Residence Assignment**: Link to residence/building
- **Account Deletion**: Full account removal

**Components**:
- `components/app/profile/ProfileAndBillingContent.tsx` - Profile form
- `components/app/profile/DeleteAccountButton.tsx` - Account deletion
- `app/api/profile/route.ts` - Profile API

#### 6. Notes Feature
- **Note Creation**: Add notes with title and content
- **Note List**: Display all user notes
- **Simple CRUD**: Basic note management

**Components**:
- `components/app/notes/AddNoteForm.tsx` - Note creation form
- `app/app/notes/page.tsx` - Notes page
- `app/app/notes/actions.ts` - Notes server actions

### API Routes Overview

#### Authentication Routes
- **`/api/auth/[...nextauth]`**: NextAuth handler (GET/POST)
  - Handles sign in, sign out, OAuth callbacks
- **`/api/auth/route`**: Additional auth endpoints

#### Payment Routes
- **`/api/(payment)/checkout`**: Create Stripe checkout session (POST)
- **`/api/(payment)/refund`**: Process refunds (POST)
- **`/api/(payment)/subscription/update`**: Update subscription (POST)
- **`/api/payments`**: Get payments list (GET)

#### Account Management
- **`/api/profile`**: Get/Update profile (GET/POST)
- **`/api/account/delete`**: Delete account (DELETE)

#### Webhooks
- **`/api/webhook/stripe`**: Stripe webhook handler (POST)
  - Handles: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`, `charge.refunded`

### Server Actions Overview

#### Authentication Actions (`app/actions/auth.ts`)
- `handleSignIn()` - Process sign-in
- `handleSignOut()` - Process sign-out

#### Dashboard Actions (`app/actions/dashboard.ts`)
- `getDashboardStats()` - Fetch all dashboard statistics

#### Payment Actions (`app/actions/payments.ts`)
- `getBalances()` - Calculate cash and bank balances
- `createCashPayment()` - Create cash payment record
- `getResidents()` - Get all residents for a residence

#### Stripe Actions (`app/actions/stripe.ts`)
- `createPortalSession()` - Create Stripe Billing Portal session
- `refund()` - Process refund

### Database Schema Overview

**Schema Name**: `dbasakan` (custom schema, not `public`)

#### Core Tables

1. **NextAuth Tables** (authentication):
   - `users` - NextAuth user records
   - `accounts` - OAuth provider accounts
   - `sessions` - Active sessions
   - `verification_tokens` - Email verification tokens

2. **Application Tables**:
   - `profiles` - Extended user profiles (1:1 with `users`)
   - `residences` - Buildings/residences
   - `fees` - Monthly charges for residents
   - `payments` - Payment records
   - `expenses` - Building maintenance costs
   - `incidents` - Maintenance requests/issues
   - `announcements` - Building-wide communications
   - `polls` - Resident voting polls
   - `poll_options` - Poll voting options
   - `poll_votes` - Resident votes
   - `access_logs` - Visitor access logs (QR-based)
   - `deliveries` - Package delivery tracking

3. **Billing Tables**:
   - `stripe_customers` - Links NextAuth users to Stripe subscriptions
     - `user_id`, `stripe_customer_id`, `subscription_id`
     - `plan_active`, `plan_expires`, `plan_name`, `price_id`
     - `amount`, `currency`, `interval`, `subscription_status`

4. **Financial Tracking** (via migrations):
   - `transaction_history` - Complete payment audit trail
   - `balance_snapshots` - Historical balance tracking

#### Key Relationships

```
residences (1) ──< (many) profiles
residences (1) ──< (many) fees
residences (1) ──< (many) payments
residences (1) ──< (many) expenses
residences (1) ──< (many) incidents
residences (1) ──< (many) announcements
residences (1) ──< (many) polls

profiles (1) ──< (many) fees
profiles (1) ──< (many) payments
profiles (1) ──< (many) poll_votes

users (NextAuth) (1) ──< (1) profiles
users (NextAuth) (1) ──< (1) stripe_customers

fees (1) ──< (many) payments (optional link)
polls (1) ──< (many) poll_options
polls (1) ──< (many) poll_votes
poll_options (1) ──< (many) poll_votes
```

### Authentication Flow

1. **User Sign-In**:
   - User clicks sign-in → NextAuth provider flow
   - Google OAuth redirect OR email magic link
   - NextAuth creates session → stores in `dbasakan.sessions`
   - Profile auto-created in `dbasakan.profiles` (if missing)

2. **Session Management**:
   - NextAuth generates session with `supabaseAccessToken` (JWT)
   - JWT signed with `SUPABASE_JWT_SECRET`
   - Token includes: `aud`, `exp`, `sub` (user ID), `email`, `role`

3. **API Access**:
   - Server components use `getSupabaseClient()` → uses session token
   - Admin operations use `createSupabaseAdminClient()` → uses service role key

4. **Route Protection**:
   - Middleware (`middleware.ts`) protects `/app/*` routes
   - Redirects unauthenticated users to `/api/auth/signin`

### Payment Integration (Stripe)

#### Checkout Flow
1. User selects plan → clicks checkout button
2. Server action creates Stripe Checkout session
3. User redirected to Stripe hosted checkout
4. On success → webhook `checkout.session.completed` fires
5. Webhook updates `stripe_customers` table

#### Webhook Events Handled
- `checkout.session.completed` - Initial subscription creation
- `customer.subscription.created` - Subscription created
- `customer.subscription.updated` - Plan changes, renewals, cancellations
- `customer.subscription.deleted` - Subscription ended
- `invoice.payment_succeeded` - Successful recurring payment
- `invoice.payment_failed` - Failed payment (retry logic)
- `invoice.paid` - Invoice confirmed paid
- `charge.refunded` - Refund processed

#### Subscription States
- **Active**: Subscription active, user has access
- **Canceled (with access)**: `cancel_at_period_end = true`, access until period end
- **Expired**: Subscription ended, no access
- **Trialing**: In trial period

### Services & Utilities

#### Stripe Services (`lib/stripe/services/`)
- **`subscription.service.ts`**: Query active/canceled subscriptions
- **`customer.service.ts`**: Get/create Stripe customers
- **`billing.service.ts`**: Billing operations
- **`payment.service.ts`**: Payment operations
- **`subscription-update.service.ts`**: Update subscriptions

#### Supabase Utilities (`utils/supabase/`)
- **`server.ts`**: 
  - `getSupabaseClient()` - Authenticated client (uses session JWT)
  - `createSupabaseAdminClient()` - Admin client (bypasses RLS)
- **`client.ts`**: Client-side Supabase client
- **`front.ts`**: Frontend utilities
- **`user.ts`**: User utilities

#### Other Utilities
- **`utils/stripe.ts`**: Stripe client initialization
- **`utils/pdf.ts`**: PDF receipt generation for cash payments
- **`lib/mail.ts`**: Email sending utilities
- **`lib/utils.ts`**: General utilities

### Configuration

#### App Configuration (`config.ts`)
- **Metadata**: Title, description, keywords
- **Theme**: Primary colors, border colors
- **Stripe Plans**: Free, Basic, Pro (monthly/yearly price IDs)
- **Social Links**: GitHub, Twitter, LinkedIn
- **Email Provider**: "nodemailer" or "resend"

#### Environment Variables

**Required**:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_JWT_SECRET=

# Authentication
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=
```

**Optional**:
```env
AUTH_RESEND_KEY=          # If using Resend instead of Nodemailer
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=
```

### Development Scripts

```bash
pnpm dev              # Start dev server (Turbopack)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:ts          # Type check
pnpm email            # Email dev server
pnpm stripe:listen    # Stripe webhook listener (localhost)
pnpm stripe:listen:ngrok  # Stripe webhook listener (ngrok)
```

## 📁 Documentation Structure

### System Documentation (`/System`)
Core system architecture and technical documentation.

- **[project_architecture.md](./System/project_architecture.md)** - Comprehensive project architecture including:
  - Project goals and domain
  - Technology stack
  - Project structure
  - Authentication flow
  - Payment integration
  - API architecture
  - Frontend architecture
  - Integration points
  - Environment configuration

- **[database_schema.md](./System/database_schema.md)** - Complete database documentation including:
  - Schema overview (`dbasakan`)
  - Table definitions and relationships
  - Enums and types
  - Row Level Security (RLS) policies
  - Indexes and performance considerations
  - Migration strategy

### Standard Operating Procedures (`/SOP`)
Best practices and step-by-step guides for common development tasks.

- **[database_migrations.md](./SOP/database_migrations.md)** - How to create and run database migrations
- **[adding_new_pages.md](./SOP/adding_new_pages.md)** - Guide for adding new page routes
- **[supabase_integration.md](./SOP/supabase_integration.md)** - Best practices for Supabase integration
- **[server_actions.md](./SOP/server_actions.md)** - Patterns for creating server actions

### Tasks Documentation (`/Tasks`)
Feature requirements and implementation plans.

- Feature PRDs and implementation plans are stored here as they are developed
- Reference the `prompt/` folder in the root for detailed feature specifications

### Planning & Maintenance
Documentation planning and update tracking.

- **[PLAN.md](./PLAN.md)** - Comprehensive documentation update plan including:
  - Current documentation status
  - Identified gaps and missing documentation
  - Prioritized update tasks
  - Implementation timeline
  - Documentation standards and maintenance guidelines

## 🚀 Quick Start Guide

### For New Engineers

1. **Start here**: Read [project_architecture.md](./System/project_architecture.md) to understand the overall system
2. **Database**: Review [database_schema.md](./System/database_schema.md) to understand data models
3. **Development**: Check [SOP](./SOP/) folder for task-specific guides
4. **Features**: Review `prompt/` folder for feature requirements

### Common Tasks

- **Adding a new database table**: See [database_migrations.md](./SOP/database_migrations.md)
- **Creating a new page**: See [adding_new_pages.md](./SOP/adding_new_pages.md)
- **Working with Supabase**: See [supabase_integration.md](./SOP/supabase_integration.md)
- **Creating server actions**: See [server_actions.md](./SOP/server_actions.md)

## 🔗 Related Documentation

- **Root README.md**: Basic setup and environment configuration
- **SUPABASE_SETUP.md**: Supabase-specific setup instructions
- **NGROK_SETUP.md**: ngrok setup for Stripe webhook testing
- **.cursor/rules/**: Cursor IDE rules for development standards
- **prompt/**: Feature implementation guides and PRDs
- **docs/**: Additional debugging and feature documentation

## 📝 Documentation Maintenance

This documentation is maintained in the `.agent` folder and should be updated when:
- New features are added
- Architecture changes occur
- Database schema is modified
- New patterns or best practices are established

When updating documentation:
1. Update the relevant file in `.agent/System` or `.agent/SOP`
2. Update this README.md index if new files are added
3. Ensure no overlap between documentation files
4. Include "Related Docs" sections in new documentation

## 🏗️ Project Context

**Project Name**: SAKAN / MyResidency  
**Type**: Property/Residence Management SaaS  
**Primary Users**: Syndics (Property Managers), Residents, Guards  
**Tech Stack**: Next.js 15, React 19, TypeScript, Supabase, NextAuth, Stripe  
**Database**: PostgreSQL (Supabase) with `dbasakan` schema  
**Deployment**: Vercel-ready (Next.js production build)

---

*Last Updated: Comprehensive architecture documentation update*
