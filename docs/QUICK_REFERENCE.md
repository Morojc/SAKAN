# QR Code Registration - Quick Reference

## 🚀 Quick Start Guide

### For Developers

#### Deploy in 5 Steps:
1. **Run Migration**
   ```sql
   -- Execute in Supabase SQL Editor:
   supabase/safearea/20250130000000_add_qr_code_resident_registration.sql
   ```

2. **Create Storage Bucket**
   - Supabase Dashboard → Storage → Create Bucket
   - Name: `resident-id-documents`
   - Type: Private
   - Apply policies from `docs/STORAGE_SETUP.md`

3. **Verify Environment**
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   RESEND_API_KEY=re_xxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

4. **Test Locally**
   ```bash
   npm run dev
   # Visit: http://localhost:3000/app/qr-code
   ```

5. **Deploy**
   ```bash
   git add .
   git commit -m "feat: QR code resident registration"
   git push origin main
   ```

---

### For Syndics

#### Generate QR Code:
1. Login → **QR Code Registration** (sidebar)
2. View/Download QR code (PNG or PDF)
3. Share with residents

#### Review Requests:
1. Login → **Registration Requests** (sidebar)
2. Click **"View"** on any request
3. Review details and ID document
4. **Approve** or **Reject** with reason

---

### For Residents

#### Register:
1. **Scan QR Code** (or visit URL)
2. Fill form + Upload ID
3. **Submit**
4. Check email for confirmation
5. Wait for approval (24-48hrs)
6. **Receive 6-digit code** via email
7. Use code in SAKAN mobile app

---

## 📊 Key URLs

| Page | URL | Access |
|------|-----|--------|
| QR Code Management | `/app/qr-code` | Syndic Only |
| Registration Requests | `/app/registration-requests` | Syndic Only |
| Public Registration | `/register/{code}` | Public |

---

## 🔧 Common Tasks

### Regenerate QR Code
```
/app/qr-code → Click "Regenerate" button
```

### Check Request Status
```
/app/registration-requests → Filter by status
```

### Resend Onboarding Code
```
/app/residents → Find resident → "Resend Code"
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| QR code not working | Check `NEXT_PUBLIC_APP_URL` in .env |
| Upload fails | Verify storage bucket exists + policies |
| No emails | Check Resend API key + domain verification |
| Approval fails | Check for duplicate email/apartment |

---

## 📞 Support

- **Documentation:** `docs/QR_CODE_FEATURE.md`
- **Storage Setup:** `docs/STORAGE_SETUP.md`
- **Deployment:** `docs/DEPLOYMENT_CHECKLIST.md`
- **Full Summary:** `docs/IMPLEMENTATION_SUMMARY.md`

---

## ✅ Pre-Launch Checklist

- [ ] Database migration executed
- [ ] Storage bucket created
- [ ] Test QR code generates
- [ ] Test registration submits
- [ ] Verify emails arrive
- [ ] Test approval flow
- [ ] Test mobile app integration
- [ ] Train syndics

**Ready to Launch!** 🎉

