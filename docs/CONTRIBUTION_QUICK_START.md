# Contribution Management - Quick Start Guide

## 🎯 What Was Built

A complete contribution management system that supports:
1. **Historical data import** - Import existing contribution records from Excel
2. **Fresh start mode** - Begin tracking from scratch with automatic fee generation
3. **Status table view** - Visual table matching your image format showing paid/unpaid status

## 📁 Files Created

### Database
- `supabase/migrations/20250102000000_add_contribution_tracking.sql` - Database schema

### Server Actions
- `app/actions/contributions.ts` - Import & detection logic
- `app/actions/contribution-status.ts` - Status table data fetching

### Pages
- `app/app/contributions/setup/page.tsx` - Mode selection
- `app/app/contributions/import/page.tsx` - Historical import wizard
- `app/app/contributions/setup-fresh/page.tsx` - Fresh start configuration
- `app/app/contributions/page.tsx` - Main status table view

### Documentation
- `docs/CONTRIBUTION_MANAGEMENT.md` - Full implementation documentation

## 🚀 How to Use

### First Time Setup

1. **Run the migration:**
   ```bash
   # Apply the new database migration
   npx supabase db push
   ```

2. **Access the system:**
   - Navigate to `/app/contributions/setup`
   - Choose your setup mode:
     - **Import Historical Data** if you have existing records
     - **Start Fresh** if you're beginning from scratch

### Historical Data Import

1. **Prepare your Excel file** with this format:
   ```
   | APPT | Report    | janv-25 | févr-25 | mars-25 | ... | déc-25 |
   |------|-----------|---------|---------|---------|-----|--------|
   | 1    |           | X       | X       |         | ... | X      |
   | 2    | 02 Mois   | X       | X       | X       | ... |        |
   ```
   - **APPT**: Apartment number
   - **Report**: Outstanding months (optional)
   - **Month columns**: Use French names (janv, févr, mars, etc.) with year suffix
   - **X**: Marks paid months
   - **Empty**: Unpaid months

2. **Import process:**
   - Upload your Excel/CSV file
   - Set the year and monthly amount
   - Preview and validate the data
   - Confirm import

### Fresh Start Mode

1. **Configure settings:**
   - Set monthly contribution amount
   - Choose start month/year
   - Enable/configure email reminders

2. **System will:**
   - Generate fees for all residents automatically
   - Send payment reminders (if enabled)
   - Track payment status

### Viewing Status

Access `/app/contributions` to see:
- **Status table** matching your image format
- **Statistics**: Total apartments, fully paid, outstanding
- **Search & filters**: By apartment, resident, or year
- **Report column**: Shows outstanding months per apartment

## 🎨 Features

### Status Table
- ✅ 'X' marks for paid contributions
- ❌ Red cells for unpaid contributions
- 📊 Report column showing "XX Mois" for outstanding
- 🔍 Search by apartment or resident name
- 📅 Filter by year
- 📱 Responsive design with horizontal scroll

### Import Wizard
- 📂 Excel/CSV file upload
- 📥 Download template button
- 👀 Preview before import
- ✔️ Apartment-resident validation
- ⚠️ Unmatched apartment warnings
- 📊 Import statistics

### Fresh Start
- 💰 Monthly amount configuration
- 📆 Start date selection
- 📧 Email reminder setup
- 🔄 Automatic fee generation

## ⚙️ Configuration

### Getting Residence ID

Currently, `residenceId` is hardcoded as `1` in several places. You need to update these files to get it from the user session:

```typescript
// Replace this pattern:
const residenceId = 1;

// With something like:
const { data: profile } = await supabase
  .from('profiles')
  .select('residence_id')
  .eq('id', session.user.id)
  .single();
const residenceId = profile?.residence_id;
```

**Files to update:**
- `app/app/contributions/setup/page.tsx` (line ~26)
- `app/app/contributions/import/page.tsx` (lines ~133, ~162)
- `app/app/contributions/setup-fresh/page.tsx` (line ~30)
- `app/app/contributions/page.tsx` (line ~29)

## 📊 Database Schema

### New Fields in `fees` table:
- `contribution_month` - Month number (1-12)
- `contribution_year` - Year (2020-2100)
- `is_historical` - True if imported, false if generated
- `imported_at` - Timestamp of import

### New Fields in `residences` table:
- `contribution_setup_mode` - 'fresh', 'historical', or 'mixed'
- `historical_data_imported_at` - When historical data was imported
- `monthly_contribution_amount` - Default monthly amount

## 🔗 Navigation

Add these links to your sidebar/menu:
- `/app/contributions` - Main contribution status page
- `/app/contributions/setup` - Initial setup (only shown if no data)

## 🧪 Testing

### Test Historical Import:
1. Use the download template button
2. Modify the template with sample data
3. Upload and verify the import
4. Check the status table

### Test Fresh Start:
1. Set amount (e.g., 150 MAD)
2. Choose current month as start
3. Enable reminders
4. Complete setup
5. Verify fees are generated

### Test Status Table:
1. View the table
2. Search for apartments
3. Change year
4. Verify paid/unpaid colors
5. Check outstanding month calculations

## 📝 Next Steps (Optional Enhancements)

### High Priority:
- [ ] Get residence ID from session instead of hardcoding
- [ ] Payment recording dialog for unpaid months
- [ ] Export to PDF/Excel functionality

### Medium Priority:
- [ ] Bulk payment recording
- [ ] Import additional years
- [ ] Detailed error reporting for failed imports

### Low Priority:
- [ ] Period reports with charts
- [ ] Mobile-optimized view
- [ ] Drag-and-drop file upload

## 🐛 Troubleshooting

### Import fails with "Failed to parse file"
- Ensure Excel file follows the template format
- Check that month columns use French names
- Verify apartment numbers match your residents

### "No residents found" error
- Verify residents exist in the residence
- Check that residents are marked as `verified: true`
- Ensure apartment numbers match exactly

### Status table shows no data
- Run the migration first (`npx supabase db push`)
- Check that contribution_month and contribution_year are set
- Verify the selected year has data

## 📚 Additional Resources

- See `docs/CONTRIBUTION_MANAGEMENT.md` for full technical documentation
- User stories document for complete feature list
- Database migration file for schema details

---

**Version:** 1.0.0  
**Date:** January 2, 2026  
**Status:** ✅ Ready for testing

