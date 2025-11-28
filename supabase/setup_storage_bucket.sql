-- =====================================================
-- SUPABASE STORAGE BUCKET SETUP
-- =====================================================
-- Creates the SAKAN storage bucket and RLS policies
-- =====================================================

-- Create the SAKAN bucket (if not exists)
-- Note: This needs to be run manually in Supabase Dashboard → Storage
-- because CREATE BUCKET is not a standard SQL command

-- However, you can configure bucket settings via SQL:
-- Go to Supabase Dashboard → Storage → Create new bucket:
-- Name: SAKAN
-- Public: false (private bucket)

-- =====================================================
-- RLS POLICIES FOR STORAGE
-- =====================================================

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can do anything" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all files" ON storage.objects;

-- Policy 1: Service role (backend) can do everything
CREATE POLICY "Service role can do anything"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'SAKAN');

-- Policy 2: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'SAKAN' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Authenticated users can read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'SAKAN' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow public read access (for admins viewing documents)
-- Since we're using service_role key on the server, this policy allows
-- the generated public URLs to be accessible
CREATE POLICY "Public read access for SAKAN bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'SAKAN');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects'
ORDER BY policyname;

-- Expected output: Should show all 4 policies created above

