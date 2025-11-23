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

---

*This architecture document should be updated when significant changes are made to the system structure, tech stack, or integration patterns.*

