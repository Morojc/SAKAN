# QR Code Resident Registration - Deployment Checklist

## Pre-Deployment Checklist

### 1. Database Setup ✅
- [ ] Execute migration: `20250130000000_add_qr_code_resident_registration.sql`
- [ ] Verify tables created:
  - [ ] `resident_registration_requests` table exists
  - [ ] `residences` table has new columns (onboarding_qr_code, etc.)
- [ ] Verify function created: `validate_qr_code()`
- [ ] Check RLS policies are active
- [ ] Test database function works

### 2. Supabase Storage ✅
- [ ] Create bucket: `resident-id-documents` (private)
- [ ] Set file size limit: 5MB
- [ ] Configure allowed MIME types: PDF, JPG, PNG
- [ ] Apply RLS policies:
  - [ ] Public upload policy
  - [ ] Syndic view policy
  - [ ] Service role full access
- [ ] Test file upload from registration form
- [ ] Test file download from requests page

### 3. Environment Variables ✅
- [ ] `NEXT_PUBLIC_APP_URL` - Set to production URL
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Verified
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Verified
- [ ] `SUPABASE_SECRET_KEY` - Verified (service role)
- [ ] `RESEND_API_KEY` - Configured for emails
- [ ] `EMAIL_FROM` - Verified domain in Resend

### 4. Email Configuration ✅
- [ ] Resend account active
- [ ] Domain verified in Resend dashboard
- [ ] Test emails sending:
  - [ ] Registration confirmation
  - [ ] Syndic notification
  - [ ] Welcome email with code
  - [ ] Rejection email
- [ ] Check spam filters
- [ ] Review email templates in live environment

### 5. Code Deployment ✅
- [ ] All new files committed to git
- [ ] Dependencies installed: `qrcode.react`, `html2canvas`, `jspdf`, `nanoid`
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Build succeeds locally: `npm run build`
- [ ] Environment variables in production

## Deployment Steps

### Step 1: Database Migration
```bash
# In Supabase SQL Editor, run:
supabase/safearea/20250130000000_add_qr_code_resident_registration.sql
```

### Step 2: Storage Bucket Setup
```bash
# Follow docs/STORAGE_SETUP.md
# 1. Create bucket via Supabase dashboard
# 2. Apply SQL policies from docs
```

### Step 3: Code Deployment
```bash
# Commit changes
git add .
git commit -m "feat: Add QR code resident registration system"
git push origin main

# Deploy to production (depends on your hosting)
# Vercel/Netlify will auto-deploy
# Or run: npm run build && npm start
```

### Step 4: Verify Deployment
- [ ] Visit `/app/qr-code` - QR code generates
- [ ] Download QR code as PNG/PDF
- [ ] Scan QR code - opens registration page
- [ ] Submit test registration
- [ ] Check request appears in dashboard
- [ ] Approve test request
- [ ] Verify user created in database
- [ ] Check email received

## Post-Deployment Testing

### Syndic Flow
1. [ ] Login as syndic
2. [ ] Navigate to QR Code Registration page
3. [ ] Generate QR code
4. [ ] Download as PNG (verify quality)
5. [ ] Download as PDF (verify layout)
6. [ ] Copy URL (verify format)
7. [ ] Regenerate code (verify old code invalid)

### Registration Flow
1. [ ] Scan QR code (or visit URL directly)
2. [ ] Verify residence info displays
3. [ ] Fill registration form
4. [ ] Upload ID document (PDF)
5. [ ] Submit form
6. [ ] Verify confirmation email received
7. [ ] Check duplicate detection:
   - [ ] Try same email again (should fail)
   - [ ] Try same apartment again (should fail)

### Approval Flow
1. [ ] Login as syndic
2. [ ] Navigate to Registration Requests
3. [ ] Verify statistics cards show correct counts
4. [ ] View pending request
5. [ ] Check ID document opens
6. [ ] Approve request
7. [ ] Verify welcome email with code sent
8. [ ] Check user account created in database
9. [ ] Verify profile_residences entry created

### Rejection Flow
1. [ ] Submit another test registration
2. [ ] Reject with reason
3. [ ] Verify rejection email sent
4. [ ] Check request status updated

### Mobile App Integration
1. [ ] Open SAKAN mobile app
2. [ ] Select "I'm a Resident"
3. [ ] Enter approved resident's email
4. [ ] Enter 6-digit onboarding code
5. [ ] Verify login successful
6. [ ] Check apartment assigned correctly

## Rollback Plan

If issues occur:

### Quick Rollback
```bash
# Revert git commit
git revert HEAD
git push origin main

# Or rollback to previous version
git reset --hard <previous-commit-hash>
git push origin main --force
```

### Database Rollback
```sql
-- Drop new table
DROP TABLE IF EXISTS dbasakan.resident_registration_requests CASCADE;

-- Remove columns from residences
ALTER TABLE dbasakan.residences 
  DROP COLUMN IF EXISTS onboarding_qr_code,
  DROP COLUMN IF EXISTS qr_code_generated_at,
  DROP COLUMN IF EXISTS qr_brand_color;

-- Drop function
DROP FUNCTION IF EXISTS dbasakan.validate_qr_code(TEXT);
```

### Storage Rollback
```bash
# Delete bucket via Supabase dashboard
# Storage → resident-id-documents → Delete
```

## Monitoring

### Things to Monitor
- [ ] Registration submission rate
- [ ] Approval/rejection rate
- [ ] Email delivery success rate
- [ ] QR code scan analytics (if implemented)
- [ ] Storage bucket usage
- [ ] API error rates

### Key Metrics
- Time to approve requests (target: < 24 hours)
- Registration completion rate
- Email delivery rate (target: > 95%)
- ID document upload success rate

## Support Preparation

### Documentation
- [ ] README updated
- [ ] User guide created for syndics
- [ ] FAQ document prepared
- [ ] Video tutorial (optional)

### Training
- [ ] Demo to syndics
- [ ] Show QR code generation
- [ ] Walkthrough approval process
- [ ] Explain rejection workflow

### Common Issues & Solutions
1. **QR code doesn't work**
   - Check `NEXT_PUBLIC_APP_URL` is correct
   - Regenerate QR code
   - Verify database migration ran

2. **Upload fails**
   - Check storage bucket exists
   - Verify RLS policies
   - Check file size < 5MB

3. **Emails not sending**
   - Verify Resend API key
   - Check domain verification
   - Review Resend logs

4. **Approval fails**
   - Check for duplicate email
   - Verify apartment not occupied
   - Review database constraints

## Success Criteria

Deployment is successful when:
- [ ] QR code generates and displays correctly
- [ ] Registration form submits successfully
- [ ] Emails are delivered reliably
- [ ] Syndic can approve/reject requests
- [ ] Approved residents receive onboarding code
- [ ] Mobile app integration works
- [ ] No critical errors in logs
- [ ] Performance is acceptable (page load < 3s)

## Communication Plan

### Announce to Syndics
```
Subject: New Feature: QR Code Resident Registration

Dear Syndic,

We're excited to announce a new feature that makes resident onboarding easier:
QR Code Registration!

What's new:
✓ Generate a unique QR code for your residence
✓ New residents scan and register themselves
✓ Review and approve requests in your dashboard
✓ Automatic onboarding code delivery

How to use:
1. Go to "QR Code Registration" in your dashboard
2. Download and share the QR code
3. Review requests as they come in

Watch our tutorial: [link]
Read the guide: [link]

Questions? Contact support@masksan.com

Best regards,
The SAKAN Team
```

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** 1.0.0  
**Status:** ⬜ Pending / ⬜ In Progress / ⬜ Completed / ⬜ Rolled Back
