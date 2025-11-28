# Resend Test Emails Configuration

This project uses [Resend](https://resend.com) for sending emails and supports Resend's test email addresses for safe development and testing.

## Overview

Resend provides test email addresses that simulate different email events without damaging your domain reputation. See the [official documentation](https://resend.com/docs/dashboard/emails/send-test-emails) for more details.

## Test Email Addresses

### Delivered Emails
Test successful email delivery:
```
delivered@resend.dev
delivered+label1@resend.dev
delivered+label2@resend.dev
```

### Bounced Emails
Test email bounces (SMTP 550 5.1.1 "Unknown User"):
```
bounced@resend.dev
bounced+label1@resend.dev
```

### Spam Complaints
Test emails marked as spam:
```
complained@resend.dev
complained+label1@resend.dev
```

## Configuration

### Enable Test Mode

Add to your `.env.local`:

```bash
# Enable Resend test emails (automatically enabled in development)
USE_RESEND_TEST_EMAILS=true

# Optional: Set test mode type (default: 'delivered')
# Options: 'delivered' | 'bounced' | 'complained'
RESEND_TEST_MODE=delivered
```

### Automatic Test Mode

Test emails are **automatically enabled** when:
- `NODE_ENV=development` (development mode)
- OR `USE_RESEND_TEST_EMAILS=true` is set

### How It Works

When test mode is enabled:
1. All emails are automatically redirected to Resend test addresses
2. The original recipient email is preserved in logs
3. Labels are automatically generated from the original email address
4. Test mode indicator is shown in email content

**Example:**
- Original: `user@example.com`
- Test mode: `delivered+user@resend.dev`

## Usage Examples

### Testing Successful Delivery
```bash
# .env.local
USE_RESEND_TEST_EMAILS=true
RESEND_TEST_MODE=delivered
```

### Testing Email Bounces
```bash
# .env.local
USE_RESEND_TEST_EMAILS=true
RESEND_TEST_MODE=bounced
```

### Testing Spam Complaints
```bash
# .env.local
USE_RESEND_TEST_EMAILS=true
RESEND_TEST_MODE=complained
```

### Production Mode
```bash
# .env.local
USE_RESEND_TEST_EMAILS=false
# or simply don't set it (defaults to false in production)
```

## Labeling Support

Labels (the part after `+`) help you:
- Track different email flows
- Match webhook responses to specific scenarios
- Differentiate between multiple test runs
- Test different user scenarios

**Examples:**
- `delivered+signup@resend.dev` - Test signup flow
- `delivered+password-reset@resend.dev` - Test password reset
- `delivered+user123@resend.dev` - Test specific user

## Benefits

✅ **Safe Testing** - No risk of damaging domain reputation  
✅ **No Fake Emails** - Use real test addresses instead of fake ones  
✅ **Webhook Testing** - Test webhook responses for different scenarios  
✅ **Easy Tracking** - Labels help track and differentiate test scenarios  

## Important Notes

⚠️ **Never send to fake email addresses** - Always use Resend test addresses  
⚠️ **Don't use fake SMTP servers** - Use Resend's test addresses instead  
⚠️ **Test mode is automatic in development** - No configuration needed for local dev  

## References

- [Resend Test Emails Documentation](https://resend.com/docs/dashboard/emails/send-test-emails)
- [Resend Dashboard](https://resend.com/dashboard)
- [Resend Webhooks](https://resend.com/docs/dashboard/webhooks/introduction)

