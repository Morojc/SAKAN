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
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  custom_interval_days?: number;
  start_date: string;
  next_due_date: string;
  coverage_months: number;
  coverage_end_date?: string;
  is_active: boolean;
}

export async function createRecurringFee(data: {
  title: string;
  amount: number;
  frequency: string;
  startDate: Date;
  residenceId: number;
  coverageMonths: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Validate "only one role" constraint
  const { data: existing } = await supabase
    .from('recurring_fee_settings')
    .select('id')
    .eq('residence_id', data.residenceId)
    .eq('is_active', true)
    .single();

  if (existing) {
    return { error: 'You can only have one active payment rule.' };
  }

  const nextDueDate = new Date(data.startDate);
  
  // Calculate coverage end date (start date + coverage months - 1 day)
  const coverageEndDate = new Date(data.startDate);
  coverageEndDate.setMonth(coverageEndDate.getMonth() + data.coverageMonths);
  coverageEndDate.setDate(coverageEndDate.getDate() - 1); // End is inclusive
  
  const { error } = await supabase.from('recurring_fee_settings').insert({
    residence_id: data.residenceId,
    title: data.title,
    amount: data.amount,
    frequency: data.frequency,
    coverage_months: data.coverageMonths,
    start_date: data.startDate.toISOString(),
    next_due_date: nextDueDate.toISOString(),
    coverage_end_date: coverageEndDate.toISOString(),
    created_by: session.user.id,
    is_active: true,
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
  const coverageText = setting.coverage_months > 1 
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
        title: `${setting.title}${coverageText}`,
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
  // The next due date should be coverage_months after the current next_due_date
  const nextDueDate = new Date(setting.next_due_date);
  nextDueDate.setMonth(nextDueDate.getMonth() + setting.coverage_months);
  
  const nextCoverageEndDate = new Date(nextDueDate);
  nextCoverageEndDate.setMonth(nextCoverageEndDate.getMonth() + setting.coverage_months);
  nextCoverageEndDate.setDate(nextCoverageEndDate.getDate() - 1);
  
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

export async function updateRecurringFee(data: {
  id: number;
  title: string;
  amount: number;
  frequency: string;
  nextDueDate: Date;
  coverageMonths: number;
}) {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Calculate coverage end date
  const coverageEndDate = new Date(data.nextDueDate);
  coverageEndDate.setMonth(coverageEndDate.getMonth() + data.coverageMonths);
  coverageEndDate.setDate(coverageEndDate.getDate() - 1);

  const { error } = await supabase
    .from('recurring_fee_settings')
    .update({
      title: data.title,
      amount: data.amount,
      frequency: data.frequency,
      coverage_months: data.coverageMonths,
      next_due_date: data.nextDueDate.toISOString(),
      coverage_end_date: coverageEndDate.toISOString(),
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
