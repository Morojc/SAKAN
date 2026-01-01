import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPaymentReminderEmail(
  to: string,
  userName: string,
  residenceName: string,
  amount: number,
  dueDate: Date,
  feeTitle: string,
  apartmentNumber: string,
  residenceRIB?: string
) {
  const fromEmail = process.env.EMAIL_FROM || 'reminders@resend.dev';
  const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  let subject = '';
  let messageType = '';
  
  if (daysUntilDue > 0) {
    subject = `Rappel: Paiement dû dans ${daysUntilDue} jour${daysUntilDue > 1 ? 's' : ''} - ${residenceName}`;
    messageType = `Votre paiement est dû dans <strong>${daysUntilDue} jour${daysUntilDue > 1 ? 's' : ''}</strong>.`;
  } else if (daysUntilDue === 0) {
    subject = `URGENT: Paiement dû aujourd'hui - ${residenceName}`;
    messageType = `Votre paiement est <strong>dû aujourd'hui</strong>.`;
  } else {
    subject = `URGENT: Paiement en retard - ${residenceName}`;
    messageType = `Votre paiement est <strong>en retard de ${Math.abs(daysUntilDue)} jour${Math.abs(daysUntilDue) > 1 ? 's' : ''}</strong>.`;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin-top: 0;">Rappel de Paiement</h2>
            
            <p style="color: #4b5563; font-size: 16px;">Bonjour ${userName},</p>
            
            <p style="color: #4b5563; font-size: 16px;">${messageType}</p>
            
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #1e40af;"><strong>Frais:</strong> ${feeTitle}</p>
              <p style="margin: 5px 0; color: #1e40af;"><strong>Montant:</strong> ${amount} MAD</p>
              <p style="margin: 5px 0; color: #1e40af;"><strong>Date d'échéance:</strong> ${dueDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p style="margin: 5px 0; color: #1e40af;"><strong>Appartement:</strong> ${apartmentNumber}</p>
            </div>

            <h3 style="color: #1f2937; margin-top: 25px;">Modes de Paiement</h3>
            
            <div style="background-color: #f3f4f6; border-radius: 6px; padding: 15px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #374151;">💳 Paiement en Ligne</h4>
              <p style="color: #6b7280; margin: 5px 0;">Connectez-vous à votre espace résident pour payer en ligne.</p>
            </div>

            <div style="background-color: #f3f4f6; border-radius: 6px; padding: 15px; margin: 15px 0;">
              <h4 style="margin-top: 0; color: #374151;">💰 Paiement en Espèces</h4>
              <p style="color: #6b7280; margin: 5px 0;">Remettez le montant au syndic avec un reçu signé.</p>
            </div>

            ${residenceRIB ? `
            <div style="background-color: #ecfdf5; border-radius: 6px; padding: 15px; margin: 15px 0; border: 1px solid #10b981;">
              <h4 style="margin-top: 0; color: #047857;">🏦 Virement Bancaire</h4>
              <p style="color: #065f46; margin: 5px 0;">RIB de la résidence:</p>
              <p style="background-color: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 14px; color: #047857; margin: 10px 0;">
                ${residenceRIB}
              </p>
              <p style="color: #065f46; font-size: 13px; margin: 5px 0;">
                <em>⚠️ N'oubliez pas d'indiquer votre numéro d'appartement (${apartmentNumber}) dans le motif du virement.</em>
              </p>
            </div>
            ` : ''}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                Pour toute question, veuillez contacter le syndic de ${residenceName}.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0;">
                Ceci est un message automatique, merci de ne pas y répondre directement.
              </p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[Email] Payment reminder sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Error sending reminder:', error);
    return { success: false, error };
  }
}

