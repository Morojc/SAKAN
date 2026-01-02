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
    // Get all active contribution plans with reminders enabled
    const { data: plans } = await supabase
      .from('contribution_plans')
      .select('*')
      .eq('is_active', true)
      .eq('reminder_enabled', true);

    if (!plans || plans.length === 0) {
      return NextResponse.json({ message: 'No active contribution plans with reminders' });
    }

    let remindersSent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const plan of plans) {
      // Get unpaid contributions for this plan
      const { data: contributions } = await supabase
        .from('contributions')
        .select(`
          *,
          profile_residences!inner(
            apartment_number,
            profiles(full_name, email)
          )
        `)
        .eq('contribution_plan_id', plan.id)
        .in('status', ['pending', 'partial', 'overdue']);

      if (!contributions || contributions.length === 0) continue;

      // Get residence RIB
      const { data: residence } = await supabase
        .from('residences')
        .select('name, bank_rib')
        .eq('id', plan.residence_id)
        .single();

      for (const contribution of contributions) {
        const dueDate = new Date(contribution.due_date);
        dueDate.setHours(0, 0, 0, 0);
        
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Check if we should send reminder
        const shouldSendReminder = 
          daysUntilDue === plan.reminder_days_before || // X days before
          daysUntilDue === 0 || // On due date
          (daysUntilDue < 0 && daysUntilDue % 3 === 0); // Every 3 days after due

        if (!shouldSendReminder) continue;

        // Check if reminder already sent today (using contribution_id if available, otherwise fee_id)
        const { data: existingReminder } = await supabase
          .from('email_reminders')
          .select('id')
          .eq('fee_id', contribution.id) // Note: email_reminders still uses fee_id column
          .gte('sent_at', today.toISOString())
          .single();

        if (existingReminder) continue; // Already sent today

        // Get resident email from profile_residences join
        const profileResidence = contribution.profile_residences;
        const residentEmail = (profileResidence as any)?.profiles?.email;
        const residentName = (profileResidence as any)?.profiles?.full_name;
        const profileId = (profileResidence as any)?.profile_id;

        // Send reminder email
        if (residentEmail) {
          const outstandingAmount = contribution.amount_due - (contribution.amount_paid || 0);
          const result = await sendPaymentReminderEmail(
            residentEmail,
            residentName || 'Resident',
            residence?.name || 'Votre résidence',
            outstandingAmount,
            dueDate,
            `${plan.plan_name} - ${contribution.period_start} to ${contribution.period_end}`,
            (profileResidence as any)?.apartment_number || 'N/A',
            residence?.bank_rib
          );

          if (result.success) {
            // Log reminder (using contribution id as fee_id for now - email_reminders table may need update)
            await supabase.from('email_reminders').insert({
              fee_id: contribution.id, // Note: This column name is misleading but kept for compatibility
              user_id: profileId || '',
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

