'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendPaymentReminderEmail } from '@/lib/email/reminder';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify the request is from a cron job (optional: add auth token)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createSupabaseAdminClient();
  
  try {
    // Get all active recurring fee settings with reminders enabled
    const { data: settings } = await supabase
      .from('recurring_fee_settings')
      .select('*')
      .eq('is_active', true)
      .eq('reminder_enabled', true);

    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: 'No active rules with reminders' });
    }

    let remindersSent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const setting of settings) {
      // Get unpaid fees for this setting
      const { data: fees } = await supabase
        .from('fees')
        .select(`
          *,
          profiles:user_id (full_name, email),
          profile_residences!inner(apartment_number)
        `)
        .eq('recurring_setting_id', setting.id)
        .eq('status', 'unpaid');

      if (!fees || fees.length === 0) continue;

      // Get residence RIB
      const { data: residence } = await supabase
        .from('residences')
        .select('name, bank_rib')
        .eq('id', setting.residence_id)
        .single();

      for (const fee of fees) {
        const dueDate = new Date(fee.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should send reminder
        const shouldSendReminder = 
          daysUntilDue === setting.reminder_days_before || // X days before
          daysUntilDue === 0 || // On due date
          (daysUntilDue < 0 && daysUntilDue % 3 === 0); // Every 3 days after due

        if (!shouldSendReminder) continue;

        // Check if reminder already sent today
        const { data: existingReminder } = await supabase
          .from('email_reminders')
          .select('id')
          .eq('fee_id', fee.id)
          .gte('sent_at', today.toISOString())
          .single();

        if (existingReminder) continue; // Already sent today

        // Send reminder email
        if (fee.profiles?.email) {
          const result = await sendPaymentReminderEmail(
            fee.profiles.email,
            fee.profiles.full_name,
            residence?.name || 'Votre résidence',
            Number(fee.amount),
            dueDate,
            fee.title,
            fee.profile_residences?.apartment_number || 'N/A',
            residence?.bank_rib
          );

          if (result.success) {
            // Log reminder
            await supabase.from('email_reminders').insert({
              fee_id: fee.id,
              user_id: fee.user_id,
              reminder_type: daysUntilDue > 0 ? 'before_due' : (daysUntilDue === 0 ? 'on_due' : 'overdue'),
              days_before: daysUntilDue,
            });

            remindersSent++;
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      remindersSent,
      message: `Sent ${remindersSent} payment reminders` 
    });

  } catch (error) {
    console.error('[Cron] Error sending reminders:', error);
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
  }
}

