import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvoiceEmail(
  to: string,
  userName: string,
  residenceName: string,
  attachment: Buffer | Uint8Array,
  filename: string
) {
  const fromEmail = process.env.EMAIL_FROM || 'invoices@resend.dev';

  try {
    await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: `Reçu de paiement - ${residenceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Paiement Reçu</h2>
          <p>Bonjour ${userName},</p>
          <p>Nous confirmons la réception de votre paiement pour les frais de syndic de ${residenceName}.</p>
          <p>Vous trouverez ci-joint votre reçu de paiement.</p>
          <p>Cordialement,<br>Le Syndic</p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(attachment),
        },
      ],
    });
    console.log(`[Email] Invoice sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending invoice:', error);
    return { success: false, error };
  }
}

