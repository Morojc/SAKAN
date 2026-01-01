'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { generateCashReceiptPDF } from '@/lib/pdf/generator';
import { sendInvoiceEmail } from '@/lib/email/invoice';

export interface RecurringFeeSetting {
  id: number;
  residence_id: number;
  title: string;
  amount: number;
  coverage_period_value: number;
  coverage_period_type: 'week' | 'month' | 'year';
  start_date: string;
  next_due_date: string;
  coverage_end_date?: string;
  is_active: boolean;
  reminder_days_before: number;
  reminder_enabled: boolean;
  last_reminder_sent_at?: string;
}

export async function createRecurringFee(data: {
  title: string;
  amount: number;
  startDate: Date;
  residenceId: number;
  coveragePeriodValue: number;
  coveragePeriodType: 'week' | 'month' | 'year';
  isActive: boolean;
  reminderDaysBefore: number;
  reminderEnabled: boolean;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Note: Removed single active rule constraint to allow multiple rules
  
  const nextDueDate = new Date(data.startDate);
  
  // Calculate coverage end date based on period type
  const coverageEndDate = new Date(data.startDate);
  if (data.coveragePeriodType === 'week') {
    coverageEndDate.setDate(coverageEndDate.getDate() + (data.coveragePeriodValue * 7) - 1);
  } else if (data.coveragePeriodType === 'month') {
    coverageEndDate.setMonth(coverageEndDate.getMonth() + data.coveragePeriodValue);
    coverageEndDate.setDate(coverageEndDate.getDate() - 1);
  } else if (data.coveragePeriodType === 'year') {
    coverageEndDate.setFullYear(coverageEndDate.getFullYear() + data.coveragePeriodValue);
    coverageEndDate.setDate(coverageEndDate.getDate() - 1);
  }
  
  const { error } = await supabase.from('recurring_fee_settings').insert({
    residence_id: data.residenceId,
    title: data.title,
    amount: data.amount,
    coverage_period_value: data.coveragePeriodValue,
    coverage_period_type: data.coveragePeriodType,
    start_date: data.startDate.toISOString(),
    next_due_date: nextDueDate.toISOString(),
    coverage_end_date: coverageEndDate.toISOString(),
    created_by: session.user.id,
    is_active: data.isActive,
    reminder_days_before: data.reminderDaysBefore,
    reminder_enabled: data.reminderEnabled,
  });

  if (error) {
    console.error('Error creating recurring fee:', error);
    return { error: 'Failed to create payment rule' };
  }

  revalidatePath('/app/payments');
  return { success: true };
}

export async function getRecurringFeeSettings(residenceId: number) {
  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('recurring_fee_settings')
    .select('*')
    .eq('residence_id', residenceId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { data: data as RecurringFeeSetting[] };
}

export async function generateFeesForCurrentPeriod(settingId: number) {
  const supabase = await createSupabaseAdminClient();
  
  // 1. Get the setting
  const { data: setting } = await supabase
    .from('recurring_fee_settings')
    .select('*')
    .eq('id', settingId)
    .single();

  if (!setting) return { error: 'Rule not found' };

  // 2. Get all residents in the residence
  const { data: residents } = await supabase
    .from('profile_residences')
    .select('profile_id, apartment_number, verified')
    .eq('residence_id', setting.residence_id);

  if (!residents || residents.length === 0) return { error: 'No residents found' };

  // 3. Create fees for each resident if not already created for this due date
  const feesToInsert = [];
  
  // Calculate the coverage period text
  const coverageStartDate = new Date(setting.next_due_date);
  const coverageEndDate = new Date(setting.coverage_end_date || setting.next_due_date);
  const periodText = setting.coverage_period_value > 1 || setting.coverage_period_type !== 'month'
    ? ` (Covers ${coverageStartDate.toLocaleDateString()} - ${coverageEndDate.toLocaleDateString()})`
    : '';
  
  for (const resident of residents) {
    // Check duplicate
    const { data: existing } = await supabase
      .from('fees')
      .select('id')
      .eq('recurring_setting_id', settingId)
      .eq('user_id', resident.profile_id)
      .eq('due_date', setting.next_due_date)
      .single();

    if (!existing) {
      feesToInsert.push({
        residence_id: setting.residence_id,
        user_id: resident.profile_id,
        title: `${setting.title}${periodText}`,
        amount: setting.amount,
        due_date: setting.next_due_date,
        status: 'unpaid',
        recurring_setting_id: settingId,
      });
    }
  }

  if (feesToInsert.length > 0) {
    const { error: insertError } = await supabase.from('fees').insert(feesToInsert);
    if (insertError) {
      console.error('Error generating fees:', insertError);
      return { error: 'Failed to generate fees' };
    }
  }

  // 4. Update next_due_date and coverage_end_date for the next period
  const nextDueDate = new Date(setting.next_due_date);
  if (setting.coverage_period_type === 'week') {
    nextDueDate.setDate(nextDueDate.getDate() + (setting.coverage_period_value * 7));
  } else if (setting.coverage_period_type === 'month') {
    nextDueDate.setMonth(nextDueDate.getMonth() + setting.coverage_period_value);
  } else if (setting.coverage_period_type === 'year') {
    nextDueDate.setFullYear(nextDueDate.getFullYear() + setting.coverage_period_value);
  }
  
  const nextCoverageEndDate = new Date(nextDueDate);
  if (setting.coverage_period_type === 'week') {
    nextCoverageEndDate.setDate(nextCoverageEndDate.getDate() + (setting.coverage_period_value * 7) - 1);
  } else if (setting.coverage_period_type === 'month') {
    nextCoverageEndDate.setMonth(nextCoverageEndDate.getMonth() + setting.coverage_period_value);
    nextCoverageEndDate.setDate(nextCoverageEndDate.getDate() - 1);
  } else if (setting.coverage_period_type === 'year') {
    nextCoverageEndDate.setFullYear(nextCoverageEndDate.getFullYear() + setting.coverage_period_value);
    nextCoverageEndDate.setDate(nextCoverageEndDate.getDate() - 1);
  }
  
  await supabase
    .from('recurring_fee_settings')
    .update({
      next_due_date: nextDueDate.toISOString(),
      coverage_end_date: nextCoverageEndDate.toISOString(),
    })
    .eq('id', settingId);
  
  revalidatePath('/app/payments');
  return { success: true, count: feesToInsert.length };
}

export async function getFeesForRule(settingId: number) {
  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('fees')
    .select(`
      *,
      profiles:user_id (full_name, email, phone_number),
      payments:payments (id, amount, paid_at, status)
    `)
    .eq('recurring_setting_id', settingId)
    .order('due_date', { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

export async function markRecurringFeePaid(feeId: number, paymentMethod: 'cash' | 'check' | 'transfer') {
  const session = await auth();
  if (!session?.user) return { error: 'Unauthorized' };

  const supabase = await createSupabaseAdminClient();

  // 1. Get Fee Details
  const { data: fee } = await supabase
    .from('fees')
    .select(`
      *,
      profiles:user_id (full_name, email),
      residences:residence_id (name, address)
    `)
    .eq('id', feeId)
    .single();

  if (!fee) return { error: 'Fee not found' };
  if (fee.status === 'paid') return { error: 'Fee already paid' };

  // 2. Create Payment Record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      residence_id: fee.residence_id,
      user_id: fee.user_id,
      fee_id: fee.id,
      amount: fee.amount,
      method: paymentMethod,
      status: 'verified', // Syndic marking as paid is verified
      verified_by: session.user.id,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (paymentError) {
    console.error('Error creating payment:', paymentError);
    return { error: 'Failed to record payment' };
  }

  // 3. Update Fee Status
  await supabase
    .from('fees')
    .update({ status: 'paid' })
    .eq('id', feeId);

  // 4. Generate Invoice PDF
  try {
    // Get apartment number
    const { data: profileResidence } = await supabase
      .from('profile_residences')
      .select('apartment_number')
      .eq('profile_id', fee.user_id)
      .eq('residence_id', fee.residence_id)
      .single();

    const pdfBytes = await generateCashReceiptPDF({
      paymentId: payment.id,
      residentName: fee.profiles.full_name,
      apartmentNumber: profileResidence?.apartment_number || 'N/A',
      amount: Number(fee.amount),
      paymentDate: new Date(),
      receiptNumber: `PAY-${payment.id}`,
      residenceName: fee.residences.name,
      residenceAddress: fee.residences.address,
      syndicName: session.user.name || 'Syndic', // Or fetch from profile
    });

    // 5. Send Email
    if (fee.profiles.email) {
      await sendInvoiceEmail(
        fee.profiles.email,
        fee.profiles.full_name,
        fee.residences.name,
        Buffer.from(pdfBytes),
        `Recu-Paiement-${payment.id}.pdf`
      );
    }
  } catch (err) {
    console.error('Error generating/sending invoice:', err);
    // Don't fail the whole operation if email fails, but log it
  }

  revalidatePath('/app/payments');
  return { success: true };
}

/**
 * Get unpaid fees for a specific resident across all recurring rules
 */
export async function getUnpaidFeesForResident(residentId: string) {
  const session = await auth();
  if (!session?.user) return { error: 'Unauthorized' };

  const supabase = await createSupabaseAdminClient();

  // Get the residence where the current user is the syndic
  const { data: residence, error: residenceError } = await supabase
    .from('residences')
    .select('id')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (residenceError || !residence) {
    return { error: 'Syndic residence not found' };
  }

  // Verify the resident belongs to the same residence
  const { data: residentProfile } = await supabase
    .from('profile_residences')
    .select('residence_id')
    .eq('profile_id', residentId)
    .eq('residence_id', residence.id)
    .single();

  if (!residentProfile) {
    return { error: 'Resident not found in your residence' };
  }

  const { data, error } = await supabase
    .from('fees')
    .select(`
      id,
      title,
      amount,
      due_date,
      status,
      recurring_setting_id
    `)
    .eq('user_id', residentId)
    .eq('residence_id', residence.id)
    .eq('status', 'unpaid')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Error fetching unpaid fees:', error);
    return { error: error.message };
  }

  return { data };
}

/**
 * Mark multiple fees as paid in a single transaction
 */
export async function markMultipleFeesPaid(data: {
  feeIds: number[];
  paymentMethod: 'cash' | 'check' | 'transfer';
}) {
  const session = await auth();
  if (!session?.user) return { error: 'Unauthorized' };

  const supabase = await createSupabaseAdminClient();

  try {
    // Get all fees details
    const { data: fees, error: feesError } = await supabase
      .from('fees')
      .select(`
        *,
        profiles:user_id!inner (full_name, email),
        residences:residence_id!inner (name, address)
      `)
      .in('id', data.feeIds);

    if (feesError) {
      console.error('Error fetching fees:', feesError);
      console.error('Fee IDs attempted:', data.feeIds);
      return { error: `Failed to fetch fees: ${feesError.message}` };
    }

    if (!fees || fees.length === 0) {
      console.error('No fees found for IDs:', data.feeIds);
      return { error: 'No fees found' };
    }

    // Check if any fee is already paid
    const alreadyPaid = fees.filter((fee) => fee.status === 'paid');
    if (alreadyPaid.length > 0) {
      return { error: `${alreadyPaid.length} fee(s) already paid` };
    }

    // Get apartment number for the resident
    const { data: profileResidence } = await supabase
      .from('profile_residences')
      .select('apartment_number')
      .eq('profile_id', fees[0].user_id)
      .eq('residence_id', fees[0].residence_id)
      .single();

    // Create payment records and update fees
    const paymentPromises = fees.map(async (fee) => {
      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          residence_id: fee.residence_id,
          user_id: fee.user_id,
          fee_id: fee.id,
          amount: fee.amount,
          method: data.paymentMethod,
          status: 'verified',
          verified_by: session.user.id,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Error creating payment:', paymentError);
        throw paymentError;
      }

      // Update fee status
      await supabase
        .from('fees')
        .update({ status: 'paid' })
        .eq('id', fee.id);

      // Generate and send invoice
      try {
        const pdfBytes = await generateCashReceiptPDF({
          paymentId: payment.id,
          residentName: fee.profiles.full_name,
          apartmentNumber: profileResidence?.apartment_number || 'N/A',
          amount: Number(fee.amount),
          paymentDate: new Date(),
          receiptNumber: `PAY-${payment.id}`,
          residenceName: fee.residences.name,
          residenceAddress: fee.residences.address,
          syndicName: session.user.name || 'Syndic',
        });

        if (fee.profiles?.email) {
          await sendInvoiceEmail(
            fee.profiles.email,
            fee.profiles.full_name,
            fee.residences.name,
            Buffer.from(pdfBytes),
            `Recu-Paiement-${payment.id}.pdf`
          );
        }
      } catch (err) {
        console.error('Error generating/sending invoice:', err);
        // Don't block the process
      }

      return payment;
    });

    await Promise.all(paymentPromises);

    revalidatePath('/app/payments');
    return { success: true };
  } catch (error) {
    console.error('Error marking fees as paid:', error);
    return { error: 'Failed to process payments' };
  }
}

export async function updateRecurringFee(data: {
  id: number;
  title: string;
  amount: number;
  nextDueDate: Date;
  coveragePeriodValue: number;
  coveragePeriodType: 'week' | 'month' | 'year';
  isActive: boolean;
  reminderDaysBefore: number;
  reminderEnabled: boolean;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Calculate coverage end date based on period type
  const coverageEndDate = new Date(data.nextDueDate);
  if (data.coveragePeriodType === 'week') {
    coverageEndDate.setDate(coverageEndDate.getDate() + (data.coveragePeriodValue * 7) - 1);
  } else if (data.coveragePeriodType === 'month') {
    coverageEndDate.setMonth(coverageEndDate.getMonth() + data.coveragePeriodValue);
    coverageEndDate.setDate(coverageEndDate.getDate() - 1);
  } else if (data.coveragePeriodType === 'year') {
    coverageEndDate.setFullYear(coverageEndDate.getFullYear() + data.coveragePeriodValue);
    coverageEndDate.setDate(coverageEndDate.getDate() - 1);
  }

  const { error } = await supabase
    .from('recurring_fee_settings')
    .update({
      title: data.title,
      amount: data.amount,
      coverage_period_value: data.coveragePeriodValue,
      coverage_period_type: data.coveragePeriodType,
      next_due_date: data.nextDueDate.toISOString(),
      coverage_end_date: coverageEndDate.toISOString(),
      is_active: data.isActive,
      reminder_days_before: data.reminderDaysBefore,
      reminder_enabled: data.reminderEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id);

  if (error) {
    console.error('Error updating recurring fee:', error);
    return { error: 'Failed to update payment rule' };
  }

  revalidatePath('/app/payments');
  return { success: true };
}

export async function deleteRecurringFee(id: number) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Check if there are any fees associated with this setting
  const { data: fees } = await supabase
    .from('fees')
    .select('id')
    .eq('recurring_setting_id', id)
    .limit(1);

  if (fees && fees.length > 0) {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('recurring_fee_settings')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating recurring fee:', error);
      return { error: 'Failed to deactivate payment rule' };
    }
  } else {
    // Hard delete if no fees exist
    const { error } = await supabase
      .from('recurring_fee_settings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting recurring fee:', error);
      return { error: 'Failed to delete payment rule' };
    }
  }

  revalidatePath('/app/payments');
  return { success: true };
}
