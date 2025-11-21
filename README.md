# Next.js SaaS Starter Kit

A modern SaaS starter kit built with Next.js, featuring authentication, payments, and email functionality.

## Features

- 🔐 Authentication with Google OAuth
- 💳 Stripe Integration for Payments
- 📧 Email Support
- 🗃️ Supabase Database
- 📊 Google Analytics Integration

## Environment Setup

1. Clone the repository
2. Install dependencies:
```bash
pnpm install
```

3.  cp  .env.example  to .env.local ,
    set up your environment variables in .env.local

### Required Environment Variables

#### Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SECRET_KEY=your_secret_key
```

#### Stripe Configuration
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_publishable_key
STRIPE_SECRET_KEY=your_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
```

#### Email Configuration
```env
EMAIL_SERVER_USER=your_email
EMAIL_SERVER_PASSWORD=your_password
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=465
EMAIL_FROM=your_from_email
```

#### Authentication
```env
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_secret
AUTH_SECRET=your_auth_secret
```

## Getting Started

1. Set up all environment variables as described above
2. Run the development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Configuration

The project configuration is managed in `config.ts`. Here's a detailed breakdown of each configuration field:

### Metadata Configuration
```typescript
metadata: {
    title: String          // Website title for SEO and browser tab
    description: String    // Site description for SEO and social sharing
    keywords: String[]     // Keywords for SEO optimization
}
```

### Stripe Plan Configuration
Each plan (free, basic, pro) contains:
```typescript
stripe: {
    [planName]: {
        priceId: String      // Stripe price ID for the subscription
        productId: String    // Stripe product ID
        name: String         // Display name of the plan
        description: String  // Plan description shown to users
    }
}
```

Current available plans:
- Free Plan: Basic access with limited features
- Basic Plan (price_1QrDN5LftJls1Qmt6yKw9Jc1): Standard features
- Pro Plan (price_1QuociLftJls1QmtLkO3yTap): Full access to all features

### Analytics and Integration
```typescript
googleAnalyticsId: String    // Google Analytics tracking ID (from environment variables)
openPanelClientId: String    // Open Panel integration client ID
emailProvider: String        // Email service provider (currently "nodemailer")
```

## Support

For any questions or issues, please open an issue in the repository.
