# Ngrok Setup for Stripe Webhooks

This guide explains how to configure ngrok to expose your local development server to Stripe webhooks.

## Prerequisites

1. Install ngrok: https://ngrok.com/download
2. Sign up for a free ngrok account: https://dashboard.ngrok.com/signup
3. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

## Setup Steps

### 1. Install and Configure Ngrok

```bash
# Install ngrok (if not already installed)
# Windows: Download from https://ngrok.com/download
# Mac: brew install ngrok
# Linux: Download from https://ngrok.com/download

# Authenticate ngrok with your authtoken
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 2. Start Your Next.js Development Server

```bash
npm run dev
# Server will start on http://localhost:3000
```

### 3. Start Ngrok in a Separate Terminal

```bash
# Expose localhost:3000 through ngrok
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### 4. Configure Stripe Webhook

#### Option A: Using Stripe CLI (Recommended for Development)

```bash
# Replace YOUR_NGROK_URL with your actual ngrok URL
stripe listen --forward-to https://YOUR_NGROK_URL.ngrok-free.app/api/webhook/stripe
```

The CLI will output a webhook signing secret like:
```
> Ready! Your webhook signing secret is whsec_xxxxx
```

#### Option B: Using Stripe Dashboard (For Testing)

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter endpoint URL: `https://YOUR_NGROK_URL.ngrok-free.app/api/webhook/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the "Signing secret" (starts with `whsec_`)

### 5. Update Environment Variables

Update your `.env.local` file:

```env
# Get this from: stripe listen --print-secret
# Or from Stripe Dashboard -> Webhooks -> Your endpoint -> Signing secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 6. Update Checkout Success URL (Optional)

If you want the Stripe checkout to redirect back through ngrok, you can update the checkout route to use the ngrok URL:

Update `app/api/(payment)/checkout/route.ts`:
```typescript
// Optionally set a specific origin for ngrok
const origin = process.env.NGROK_URL || request.headers.get('origin') || 'http://localhost:3000';
```

Add to `.env.local`:
```env
NGROK_URL=https://YOUR_NGROK_URL.ngrok-free.app
```

## Quick Start Scripts

### Manual Approach (Recommended)

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
ngrok http 3000
```

**Terminal 3:**
```bash
# Copy the ngrok URL from Terminal 2 and use it here
stripe listen --forward-to https://YOUR_NGROK_URL.ngrok-free.app/api/webhook/stripe
```

### Using npm scripts (if you install concurrently)

Install concurrently:
```bash
npm install --save-dev concurrently
```

Then update `package.json`:
```json
"dev:ngrok": "concurrently \"npm run dev\" \"ngrok http 3000\""
```

Run:
```bash
npm run dev:ngrok
```

## Important Notes

1. **Ngrok URL Changes**: Free ngrok URLs change every time you restart ngrok. You'll need to update the Stripe webhook URL each time.

2. **Ngrok Pro**: For a stable URL, consider ngrok Pro which provides reserved domains.

3. **Webhook Secret**: Update `STRIPE_WEBHOOK_SECRET` in `.env.local` whenever you restart `stripe listen`.

4. **Testing**: Use `stripe trigger checkout.session.completed` to test webhooks.

5. **Security**: Never commit your ngrok authtoken or webhook secrets to version control.

## Troubleshooting

### Webhook not receiving events?
- Verify ngrok is running: Check the ngrok dashboard at http://127.0.0.1:4040
- Check the webhook URL in Stripe CLI matches your ngrok URL
- Verify `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
- Check server logs for `[Webhook]` messages

### Ngrok connection refused?
- Make sure Next.js dev server is running on port 3000
- Verify ngrok is forwarding to the correct port: `ngrok http 3000`

### Stripe signature verification failed?
- Ensure `STRIPE_WEBHOOK_SECRET` is correct
- Restart `stripe listen` and update the secret
- Check that you're using the HTTPS ngrok URL, not HTTP

## Alternative: ngrok with Reserved Domain (Pro)

If you have ngrok Pro, you can use a reserved domain:

```bash
ngrok http 3000 --domain=your-reserved-domain.ngrok.app
```

This gives you a stable URL that doesn't change.

