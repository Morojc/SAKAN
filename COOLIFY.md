# Coolify Deployment Guide

This project includes a `docker-compose.yml` file optimized for Coolify deployment.

## Prerequisites

- Coolify instance running
- Docker and Docker Compose installed on the Coolify server
- All required environment variables configured

## Required Environment Variables

Set these in Coolify's environment variables section:

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SECRET_KEY` - Supabase service role key
- `AUTH_SECRET` - NextAuth secret (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your application URL (e.g., `https://yourdomain.com`)

### Optional but Recommended
- `ADMIN_JWT_SECRET` - Admin JWT secret (generate with: `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for emails
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `STRIPE_SECRET_KEY` - Stripe secret key (if using payments)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

### Optional
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` - Google Analytics ID
- `NEXT_PUBLIC_OPENPANEL_CLIENT_ID` - OpenPanel client ID

## Deployment Steps

1. **Connect Repository**
   - In Coolify, create a new resource
   - Connect your Git repository
   - Select the branch you want to deploy

2. **Configure Build**
   - Coolify will automatically detect the `docker-compose.yml` file
   - The build will use the existing `Dockerfile`

3. **Set Environment Variables**
   - Go to the environment variables section
   - Add all required environment variables listed above
   - Make sure `NEXTAUTH_URL` matches your Coolify domain

4. **Configure Port**
   - The application runs on port 3000
   - Coolify will automatically handle port mapping

5. **Deploy**
   - Click "Deploy" in Coolify
   - Monitor the build logs
   - The application will be available once the build completes

## Health Check

The application includes a health check endpoint at `/api/health` that Coolify will use to verify the container is running correctly.

## Resource Limits

The docker-compose.yml includes resource limits:
- **CPU Limit**: 2 cores
- **Memory Limit**: 2GB
- **CPU Reservation**: 0.5 cores
- **Memory Reservation**: 512MB

You can adjust these in the `docker-compose.yml` file if needed.

## Troubleshooting

### Build Fails
- Check that all required environment variables are set
- Verify the Dockerfile is correct
- Check build logs in Coolify

### Application Won't Start
- Verify `NEXTAUTH_URL` matches your domain
- Check that Supabase credentials are correct
- Review application logs in Coolify

### Health Check Fails
- Ensure the application is fully started (wait 40+ seconds)
- Check that port 3000 is accessible
- Verify the `/api/health` endpoint is working

## Notes

- The application uses Next.js standalone output mode for optimal Docker performance
- All static assets are included in the Docker image
- The container runs as a non-root user (`nextjs`) for security
- Telemetry is disabled by default

