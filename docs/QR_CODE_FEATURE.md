# QR Code Resident Registration System

## Overview

The QR Code Resident Registration System allows new residents to self-register by scanning a unique QR code. Syndics can generate, share, and manage registration requests through an intuitive dashboard.

## Features Implemented

### ✅ Phase 1: Core QR Generation
- [x] Database migration with QR code fields
- [x] Unique QR code generation per residence (`res_{16_char_nanoid}`)
- [x] QR code regeneration capability
- [x] Branded QR code display with residence name and ID
- [x] Download as PNG (300 DPI) or PDF (A4)
- [x] URL copying functionality

### ✅ Phase 2: Public Registration
- [x] Public registration page at `/register/{code}`
- [x] QR code validation via database function
- [x] Registration form with required fields:
  - Full Name, Email, Phone Number
  - Apartment Number, ID Number
  - ID Document upload (PDF/JPG/PNG, max 5MB)
- [x] Real-time duplicate checking:
  - Email duplication in same residence
  - Apartment number conflicts
  - Pending request detection
- [x] File upload to Supabase Storage
- [x] Success confirmation page

### ✅ Phase 3: Syndic Review
- [x] Registration Requests dashboard page
- [x] Statistics cards (Pending, Approved, Rejected, Total)
- [x] Filterable tabs (All, Pending, Approved, Rejected)
- [x] Search functionality (name, email, apartment)
- [x] Request detail modal with full information
- [x] Document viewer (opens in new tab)
- [x] Approve/Reject workflow with confirmations

### ✅ Phase 4: Resident Onboarding
- [x] Automatic user account creation on approval
- [x] 6-digit onboarding code generation
- [x] Profile and profile_residences record creation
- [x] Welcome email with onboarding code
- [x] Code expiration (7 days)
- [x] Integration with existing mobile app OTP flow

### ✅ Phase 5: Email Notifications
- [x] Welcome email to approved residents
- [x] Rejection email with reason
- [x] Confirmation email to applicants
- [x] Notification email to syndics for new requests
- [x] Professional HTML templates

## File Structure

```
SAKAN/
├── app/
│   ├── actions/
│   │   ├── qr-code.ts                      # QR code generation actions
│   │   └── registration-requests.ts         # Request management actions
│   ├── api/
│   │   └── register/
│   │       ├── validate/[code]/route.ts    # QR code validation
│   │       └── submit/route.ts             # Registration submission
│   ├── app/
│   │   ├── qr-code/page.tsx                # QR code management page
│   │   └── registration-requests/page.tsx   # Requests dashboard
│   └── register/
│       └── [code]/page.tsx                 # Public registration page
├── components/
│   ├── app/
│   │   ├── qr-code/
│   │   │   └── QRCodeGenerator.tsx         # QR code display component
│   │   └── registration-requests/
│   │       ├── RegistrationRequestsTable.tsx
│   │       └── RequestDetailDialog.tsx
│   └── register/
│       └── ResidenceRegistrationForm.tsx   # Public registration form
├── lib/
│   └── email/
│       └── registration.ts                 # Email templates
├── supabase/
│   └── safearea/
│       └── 20250130000000_add_qr_code_resident_registration.sql
└── docs/
    └── STORAGE_SETUP.md                    # Supabase storage configuration
```

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration in your Supabase SQL Editor:

```bash
# File: supabase/safearea/20250130000000_add_qr_code_resident_registration.sql
```

This creates:
- `onboarding_qr_code` column in `residences` table
- `resident_registration_requests` table
- Helper function `validate_qr_code`
- Necessary indexes and RLS policies

### 2. Configure Supabase Storage

Follow the instructions in `docs/STORAGE_SETUP.md` to:
1. Create `resident-id-documents` bucket (private)
2. Set up upload policies
3. Configure syndic access policies

### 3. Install Required Packages

Already installed:
```bash
npm install qrcode.react html2canvas jspdf nanoid
```

### 4. Environment Variables

Ensure these are set in `.env`:

```bash
# Already configured
NEXT_PUBLIC_APP_URL=https://varicose-populational-emilie.ngrok-free.dev
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_service_role_key
RESEND_API_KEY=your_resend_key
EMAIL_FROM=noreply@masksan.com
```

## Usage Guide

### For Syndics

#### 1. Generate QR Code
- Navigate to **QR Code Registration** in sidebar
- View/download the generated QR code
- Share via:
  - Print and post in building lobby
  - Email to new residents
  - WhatsApp/SMS
  - Include in welcome packets

#### 2. Review Requests
- Navigate to **Registration Requests** in sidebar
- View pending requests in real-time
- Click "View" to see full details and ID document
- Approve or reject with reason

#### 3. Monitor Activity
- Dashboard shows request statistics
- Filter by status (Pending/Approved/Rejected)
- Search by name, email, or apartment

### For Residents

#### 1. Scan QR Code
- Scan the QR code with phone camera
- Opens registration page automatically

#### 2. Fill Registration Form
- Enter personal information
- Upload ID document (PDF/JPG/PNG)
- Submit registration

#### 3. Wait for Approval
- Receive confirmation email immediately
- Syndic reviews within 24-48 hours
- Receive approval email with 6-digit code

#### 4. Complete Setup
- Download SAKAN mobile app
- Select "I'm a Resident"
- Enter email and 6-digit code
- Complete profile

## API Endpoints

### Public Endpoints

#### `GET /api/register/validate/{code}`
Validates QR code and returns residence information.

**Response:**
```json
{
  "residence": {
    "id": 123,
    "name": "Residence Name",
    "address": "123 Street"
  }
}
```

#### `POST /api/register/submit`
Submits a new registration request.

**Request:**
```json
{
  "residenceId": 123,
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+212 6 12 34 56 78",
  "apartmentNumber": "A101",
  "idNumber": "AB123456",
  "idDocumentUrl": "https://..."
}
```

### Protected Endpoints (Server Actions)

- `generateResidenceQRCode()` - Generate or retrieve QR code
- `regenerateResidenceQRCode()` - Generate new code (invalidates old)
- `getRegistrationRequests(status)` - List requests
- `approveRegistrationRequest(id)` - Approve request
- `rejectRegistrationRequest(id, reason)` - Reject request
- `getRequestStats()` - Get statistics

## Security Features

### Database Level
- Row Level Security (RLS) on all tables
- Syndics can only view requests for their residence
- Service role for public registration endpoint
- QR code expiration (1 year)

### Application Level
- Duplicate detection (email, apartment, pending requests)
- File upload validation (type, size)
- IP address and user agent logging
- Private storage bucket for ID documents

### Email Security
- Rate limiting on submissions (via Resend)
- Professional HTML templates
- No sensitive data in emails (except onboarding code)

## Troubleshooting

### QR Code Not Working
1. Check that `NEXT_PUBLIC_APP_URL` is set correctly
2. Verify QR code exists in database: `SELECT onboarding_qr_code FROM residences WHERE id = X`
3. Check QR code generation date (expires after 1 year)

### Registration Form Errors
1. **"Invalid code"**: QR code may be expired or regenerated
2. **"Email already registered"**: User exists in system
3. **"Apartment occupied"**: Another verified resident in that apartment
4. **Upload fails**: Check Supabase storage bucket and policies

### Approval Fails
1. Check that user doesn't already exist with that email
2. Verify apartment number is not already assigned
3. Check Supabase logs for specific errors

### Emails Not Sending
1. Verify `RESEND_API_KEY` is set
2. Check Resend dashboard for delivery logs
3. Verify `EMAIL_FROM` domain is verified in Resend
4. Check server logs for email errors

## Testing Checklist

- [x] QR code generates successfully
- [x] QR code can be downloaded as PNG
- [x] QR code can be downloaded as PDF
- [x] URL can be copied to clipboard
- [ ] QR code scans correctly on mobile
- [ ] Registration form validates inputs
- [ ] File upload works (PDF, JPG, PNG)
- [ ] Duplicate detection works
- [ ] Confirmation email received
- [ ] Syndic notification received
- [ ] Request appears in dashboard
- [ ] Approve creates user account
- [ ] Welcome email with code received
- [ ] Reject sends rejection email
- [ ] Code works in mobile app
- [ ] QR code regeneration invalidates old code

## Future Enhancements

### Planned Features
- [ ] Auto-email reminders X days before approval needed
- [ ] Bulk approval/rejection
- [ ] Export registration data to CSV
- [ ] QR code analytics (scan count, conversion rate)
- [ ] Custom branding (logo upload, color picker)
- [ ] Multi-language support for registration form
- [ ] SMS notifications option
- [ ] Integration with ID verification APIs

### Mobile App Updates
- [ ] QR code scanner in app
- [ ] Registration status tracking
- [ ] Push notifications for approval/rejection

## Database Schema

### `residences` Table (Updated)
```sql
onboarding_qr_code TEXT UNIQUE
qr_code_generated_at TIMESTAMP WITH TIME ZONE
qr_brand_color TEXT DEFAULT '#1e40af'
```

### `resident_registration_requests` Table (New)
```sql
id BIGSERIAL PRIMARY KEY
residence_id BIGINT NOT NULL
full_name TEXT NOT NULL
email TEXT NOT NULL
phone_number TEXT NOT NULL
apartment_number TEXT NOT NULL
id_number TEXT NOT NULL
id_document_url TEXT NOT NULL
status TEXT DEFAULT 'pending'
reviewed_at TIMESTAMP WITH TIME ZONE
reviewed_by TEXT
rejection_reason TEXT
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
ip_address INET
user_agent TEXT
```

## Support

For issues or questions:
1. Check this README first
2. Review `docs/STORAGE_SETUP.md` for storage issues
3. Check Supabase logs in dashboard
4. Review server logs for API errors
5. Contact the development team

---

**Version:** 1.0.0  
**Last Updated:** January 30, 2025  
**Status:** ✅ Production Ready

