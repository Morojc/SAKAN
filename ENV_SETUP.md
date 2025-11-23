# Environment Variables Setup

## Application Domain Configuration

The application uses `NEXT_PUBLIC_APP_URL` to generate links in emails and for various redirects.

### Setting Up the Domain

1. **For Local Development:**
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **For ngrok (Development with External Access):**
   ```env
   NEXT_PUBLIC_APP_URL=https://unspiral-crusily-katerine.ngrok-free.dev
   ```
   > **Note:** Make sure to include the protocol (`https://`) and remove any trailing slash

3. **For Production:**
   ```env
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

### Where It's Used

- **Email Links**: Verification links, access code emails, resident invitation emails
- **Payment Redirects**: Stripe checkout success/cancel URLs
- **OAuth Callbacks**: NextAuth redirect URLs

### Important Notes

- The variable name starts with `NEXT_PUBLIC_` which means it's exposed to the browser
- Always use the full URL including the protocol (`http://` or `https://`)
- Don't include a trailing slash (`/`) at the end
- After changing this variable, restart your development server

### Example `.env.local` File

```env
# Application Domain
NEXT_PUBLIC_APP_URL=https://unspiral-crusily-katerine.ngrok-free.dev

# Other environment variables...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# ... etc
```

