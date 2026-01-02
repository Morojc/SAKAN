import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send welcome email to approved resident with onboarding code
 */
export async function sendResidentWelcomeEmail(
  to: string,
  fullName: string,
  residenceName: string,
  apartmentNumber: string,
  onboardingCode: string,
  expiresAt: Date
) {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@masksan.com';
  
  const formattedExpiry = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const daysRemaining = Math.ceil(
    (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  try {
    await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: `Welcome to ${residenceName} - Your Access Code Inside`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
            <div style="text-center; margin-bottom: 30px;">
              <h1 style="color: #1e40af; margin: 0;">Welcome to ${residenceName}!</h1>
              <p style="color: #6b7280; margin-top: 10px;">Your registration has been approved</p>
            </div>
            
            <div style="background: #eff6ff; border-left: 4px solid #1e40af; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Your Onboarding Code:</p>
              <p style="font-size: 42px; font-weight: bold; color: #1e40af; margin: 10px 0; letter-spacing: 8px;">${onboardingCode}</p>
              <p style="margin: 0; font-size: 12px; color: #ef4444;">⏰ Expires: ${formattedExpiry} (${daysRemaining} days remaining)</p>
            </div>
            
            <div style="margin: 30px 0;">
              <h3 style="color: #111827;">Next Steps:</h3>
              <ol style="color: #4b5563; line-height: 1.8;">
                <li>Download the SAKAN mobile app from the App Store or Google Play</li>
                <li>Select "I'm a Resident"</li>
                <li>Enter your email: <strong>${to}</strong></li>
                <li>Enter the code above: <strong>${onboardingCode}</strong></li>
                <li>Complete your profile setup</li>
              </ol>
            </div>
            
            <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <p style="margin: 0; font-size: 14px; color: #4b5563;">
                <strong>Your Details:</strong><br>
                Residence: ${residenceName}<br>
                Apartment: ${apartmentNumber}
              </p>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>Need help? Contact your residence syndic</p>
              <p>© ${new Date().getFullYear()} SAKAN. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log(`[Email] Welcome email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
    return { success: false, error };
  }
}

/**
 * Send rejection email to applicant
 */
export async function sendResidentRejectionEmail(
  to: string,
  fullName: string,
  residenceName: string,
  rejectionReason: string,
  syndicEmail?: string
) {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@masksan.com';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: `Registration Update - ${residenceName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
            <div style="text-center; margin-bottom: 30px;">
              <h1 style="color: #111827; margin: 0;">Registration Update</h1>
              <p style="color: #6b7280; margin-top: 10px;">${residenceName}</p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Hello ${fullName},
            </p>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Thank you for your interest in ${residenceName}. Unfortunately, we cannot approve your registration at this time.
            </p>
            
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: bold;">Reason:</p>
              <p style="margin: 10px 0 0 0; color: #7f1d1d;">${rejectionReason}</p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              If you believe this is an error or would like more information, please contact the residence management:
            </p>
            
            ${syndicEmail ? `
            <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #4b5563;">
                <strong>Contact:</strong><br>
                Email: <a href="mailto:${syndicEmail}" style="color: #1e40af;">${syndicEmail}</a>
              </p>
            </div>
            ` : ''}
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SAKAN. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log(`[Email] Rejection email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending rejection email:', error);
    return { success: false, error };
  }
}

/**
 * Send notification to syndic about new registration request
 */
export async function sendSyndicNewRequestNotification(
  syndicEmail: string,
  syndicName: string,
  residenceName: string,
  applicantName: string,
  apartmentNumber: string
) {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@masksan.com';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://masksan.com';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: syndicEmail,
      subject: `New Resident Registration - Apt ${apartmentNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
            <div style="text-center; margin-bottom: 30px;">
              <h1 style="color: #1e40af; margin: 0;">New Registration Request</h1>
              <p style="color: #6b7280; margin-top: 10px;">${residenceName}</p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Hello ${syndicName},
            </p>
            
            <p style="color: #4b5563; line-height: 1.6;">
              A new resident has submitted a registration request for your residence.
            </p>
            
            <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; font-size: 16px; color: #1e40af; font-weight: bold;">
                ${applicantName}
              </p>
              <p style="margin: 0; font-size: 14px; color: #4b5563;">
                Apartment: <strong>${apartmentNumber}</strong>
              </p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Please review the request and approve or reject it in your dashboard.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/app/registration-requests" 
                 style="display: inline-block; background: #1e40af; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold;">
                Review Request
              </a>
            </div>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SAKAN. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log(`[Email] Syndic notification sent to ${syndicEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending syndic notification:', error);
    return { success: false, error };
  }
}

/**
 * Send confirmation email to applicant after submission
 */
export async function sendRegistrationConfirmationEmail(
  to: string,
  fullName: string,
  residenceName: string,
  apartmentNumber: string
) {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@masksan.com';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: `Registration Received - ${residenceName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px;">
            <div style="text-center; margin-bottom: 30px;">
              <h1 style="color: #10b981; margin: 0;">✓ Registration Received!</h1>
              <p style="color: #6b7280; margin-top: 10px;">${residenceName}</p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Hello ${fullName},
            </p>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Thank you for submitting your registration for <strong>${residenceName}</strong>, Apartment <strong>${apartmentNumber}</strong>.
            </p>
            
            <div style="background: #ecfdf5; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #065f46;">
                ✓ Your request is pending syndic approval<br>
                ✓ You will receive an email when your request is reviewed<br>
                ✓ Typically reviewed within 24-48 hours
              </p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6;">
              Once approved, you will receive another email with a 6-digit code to complete your registration in the SAKAN mobile app.
            </p>
            
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>© ${new Date().getFullYear()} SAKAN. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    
    console.log(`[Email] Confirmation email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending confirmation email:', error);
    return { success: false, error };
  }
}

