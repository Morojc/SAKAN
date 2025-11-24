# Supabase Storage Bucket Setup

## Overview

The SAKAN application requires a Supabase Storage bucket named "SAKAN" to store syndic document submissions (procès verbal documents).

## Setup Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** or **"Create bucket"**
4. Configure the bucket:
   - **Name**: `SAKAN` (must be exact, case-sensitive)
   - **Public bucket**: `No` (private bucket)
   - **File size limit**: `50MB` (or as needed)
   - **Allowed MIME types**: 
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/jpg`

5. Click **"Create bucket"**

### Option 2: Via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Create the bucket (requires manual SQL or dashboard)
# Storage buckets cannot be created via SQL migrations directly
# Use the dashboard method above
```

## Row Level Security (RLS) Policies

After creating the bucket, you need to set up RLS policies. Run these SQL commands in your Supabase SQL Editor:

```sql
-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'SAKAN' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'SAKAN' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can read all files
-- Note: Adjust this based on your admin role system
CREATE POLICY "Admins can read all files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'SAKAN' AND
  EXISTS (
    SELECT 1 FROM dbasakan.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin' -- Adjust based on your admin role system
  )
);

-- Policy: Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'SAKAN')
WITH CHECK (bucket_id = 'SAKAN');
```

## File Structure

Files are stored in the following structure:
```
SAKAN/
  └── syndic-documents/
      └── {user_id}/
          └── {timestamp}-{random}.{ext}
```

Example:
```
SAKAN/syndic-documents/abc123/1701234567890-xyz789.pdf
```

## Verification

To verify the bucket is set up correctly:

1. Go to Supabase Dashboard → Storage
2. Confirm the "SAKAN" bucket exists
3. Check that RLS policies are active
4. Test file upload via the application

## Troubleshooting

### Error: "Bucket not found"
- Ensure the bucket name is exactly "SAKAN" (case-sensitive)
- Check that the bucket exists in your Supabase project

### Error: "Permission denied"
- Verify RLS policies are correctly configured
- Check that the authenticated user has the correct permissions
- Ensure the file path follows the `syndic-documents/{user_id}/` structure

### Error: "File size too large"
- Check the bucket's file size limit
- Verify the file being uploaded is under the limit (default: 10MB in code, 50MB in bucket)

## Notes

- The bucket should be **private** (not public) for security
- Files are organized by user ID to ensure proper access control
- Old files can be cleaned up periodically if needed
- Consider implementing a file retention policy for rejected submissions

