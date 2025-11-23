import config from "@/config";

interface SendAccessCodeEmailParams {
  to: string;
  code: string;
  actionType: 'delete_account' | 'change_role';
}

/**
 * Send access code email for syndic role transfer
 * Uses the centralized Resend utility from @/app/app/providers/resender
 * 
 * Testing: Set USE_RESEND_TEST_EMAILS=true in .env.local to use Resend test emails
 * Test modes: 'delivered' | 'bounced' | 'complained'
 * Examples:
 *   - delivered+user1@resend.dev (successful delivery)
 *   - bounced+user1@resend.dev (simulate bounce)
 *   - complained+user1@resend.dev (simulate spam complaint)
 * 
 * See: https://resend.com/docs/dashboard/emails/send-test-emails
 */
export async function sendAccessCodeEmail({ to, code, actionType }: SendAccessCodeEmailParams) {
  // Log the code being sent to verify it matches database
  console.log(`[Email] Preparing to send access code email to: ${to}`);
  console.log(`[Email] Code to be sent in email: "${code}"`);
  console.log(`[Email] Code length: ${code.length}, Code type: ${typeof code}`);
  
  const { sendEmail } = await import('@/app/app/providers/resender');
  const host = process.env.NEXT_PUBLIC_APP_URL || 'https://sakan.app';
  const signInUrl = `${host}/auth/signin`;

  const actionText = actionType === 'delete_account' 
    ? 'permanently delete the syndic account' 
    : 'change the syndic role to resident';

  const html = `
    <body style="background: #f9f9f9;">
      <table width="100%" border="0" cellspacing="20" cellpadding="0"
        style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center"
            style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
            Syndic Role Transfer Request
          </td>
        </tr>
        <tr>
          <td align="left"
            style="padding: 10px 20px; font-size: 16px; line-height: 24px; font-family: Helvetica, Arial, sans-serif; color: #444;">
            <p>Hello,</p>
            <p>You have been selected to become the new syndic for your residence.</p>
            <p>To claim this role and transfer all residence data to your account, please follow these steps:</p>
            <ol>
              <li>Go to the Sign In page.</li>
              <li>Enter the Access Code below in the "Access Code" field.</li>
              <li>Sign in with your Google account associated with this email (${to}).</li>
            </ol>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 2px; border-radius: 8px; display: inline-block;">
              ${code}
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="#346df1"><a href="${signInUrl}"
                    target="_blank"
                    style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #fff; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid #346df1; display: inline-block; font-weight: bold;">
                    Go to Sign In
                  </a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="left"
            style="padding: 0px 0px 10px 0px; font-size: 14px; line-height: 20px; font-family: Helvetica, Arial, sans-serif; color: #666;">
            <p><strong>Note:</strong> This code expires in 7 days.</p>
            <p>If you were not expecting this email, please contact the current syndic or ignore this message.</p>
          </td>
        </tr>
      </table>
    </body>
  `;

  const result = await sendEmail({
    to,
    subject: `Syndic Role Transfer - ${config.metadata.title}`,
    html,
  });

  if (!result.success) {
    console.error('[Email] Failed to send access code email:', result.error);
    // Don't throw - we'll show the code in UI anyway
  } else {
    console.log(`[Email] Access code email sent successfully to: ${to}`);
    console.log(`[Email] Code sent in email: "${code}"`);
    console.log(`[Email] Message ID: ${result.messageId}`);
  }

  return result;
}
