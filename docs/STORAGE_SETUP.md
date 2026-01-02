# Supabase Storage Configuration for QR Code Registration

## Storage Bucket Setup

### 1. Create the `resident-id-documents` Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create Bucket"
3. Name: `resident-id-documents`
4. **Public bucket**: NO (keep private)
5. File size limit: 5MB
6. Allowed MIME types: `image/jpeg`, `image/jpg`, `image/png`, `application/pdf`

### 2. Set Up Storage Policies

Run the following SQL in the Supabase SQL Editor:

```sql
-- Enable RLS on the storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public uploads to resident-id-documents bucket
-- (Needed for public registration form)
CREATE POLICY "Allow public uploads to resident-id-documents"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'resident-id-documents'
);

-- Policy: Syndics can view documents in their residence
CREATE POLICY "Syndics can view resident documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-id-documents'
  AND (storage.foldername(name))[1]::bigint IN (
    SELECT id::bigint FROM dbasakan.residences WHERE syndic_user_id = auth.uid()::text
  )
);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to resident documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'resident-id-documents')
WITH CHECK (bucket_id = 'resident-id-documents');
```

### 3. Verify Bucket Configuration

After creating the bucket and policies, verify:

1. **Bucket exists**: Navigate to Storage in Supabase Dashboard
2. **Policies are active**: Check the Policies tab
3. **Test upload**: Try uploading a test file from the registration form

## File Upload Structure

Files are organized by residence:

```
resident-id-documents/
├── {residence_id}/
│   ├── {timestamp}_{filename}.pdf
│   ├── {timestamp}_{filename}.jpg
│   └── ...
```

Example: `resident-id-documents/123/1706543210000_passport.pdf`

## Security Notes

- **Private bucket**: Files are not publicly accessible
- **Signed URLs**: Use `createSignedUrl()` when you need to display documents
- **RLS**: Only syndics can view documents from their residence
- **File validation**: Always validate file type and size on server-side

## Testing Checklist

- [ ] Bucket created and configured as private
- [ ] Upload policy allows anon users to upload
- [ ] Syndic can view documents from their residence only
- [ ] File size limit enforced (5MB)
- [ ] Only allowed file types can be uploaded
- [ ] Files are organized by residence_id

## Troubleshooting

**Error: "Bucket not found"**
- Ensure bucket name is exactly `resident-id-documents`
- Check that bucket is created in the correct Supabase project

**Error: "Policy violation" on upload**
- Verify the upload policy is created
- Check bucket permissions in Storage settings

**Error: "File too large"**
- Default limit is 50MB, but we recommend 5MB
- Update bucket settings if needed

## Alternative: Using API Route for Upload

If you prefer more control, you can create a server-side API route:

```typescript
// app/api/upload-id-document/route.ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const residenceId = formData.get('residenceId');
  
  // Validate file
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }
  
  // Upload to Supabase
  const supabase = await createSupabaseAdminClient();
  const fileName = `${residenceId}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('resident-id-documents')
    .upload(fileName, file);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ path: data.path });
}
```

