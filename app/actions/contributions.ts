'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export interface ContributionDataStatus {
  hasData: boolean;
  hasHistoricalData: boolean;
  setupMode: 'fresh' | 'historical' | 'mixed';
  importedAt?: string;
  monthlyAmount?: number;
  totalFees?: number;
  totalHistoricalFees?: number;
}

/**
 * Check the contribution data status for a residence
 * Determines if historical data exists, setup mode, and statistics
 */
export async function checkContributionDataStatus(
  residenceId: number
): Promise<{ data?: ContributionDataStatus; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get total fees count
  const { count: totalFees } = await supabase
    .from('fees')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residenceId);

  // Get historical fees count
  const { count: totalHistoricalFees } = await supabase
    .from('fees')
    .select('*', { count: 'exact', head: true })
    .eq('residence_id', residenceId)
    .eq('is_historical', true);

  // Get residence settings
  const { data: residence, error: residenceError } = await supabase
    .from('residences')
    .select('contribution_setup_mode, historical_data_imported_at, monthly_contribution_amount')
    .eq('id', residenceId)
    .single();

  if (residenceError) {
    return { error: 'Failed to fetch residence data' };
  }

  return {
    data: {
      hasData: (totalFees || 0) > 0,
      hasHistoricalData: (totalHistoricalFees || 0) > 0,
      setupMode: residence?.contribution_setup_mode || 'fresh',
      importedAt: residence?.historical_data_imported_at,
      monthlyAmount: residence?.monthly_contribution_amount,
      totalFees: totalFees || 0,
      totalHistoricalFees: totalHistoricalFees || 0,
    },
  };
}

export interface ContributionImportRow {
  apartmentNumber: string;
  report?: string; // e.g., "02 Mois", "31 Mois"
  months: {
    [monthKey: string]: 'paid' | 'unpaid'; // e.g., 'janv-25': 'paid'
  };
}

export interface ContributionImportPreview {
  apartmentNumber: string;
  residentName?: string;
  residentId?: string;
  matched: boolean;
  paidMonths: number;
  unpaidMonths: number;
  totalAmount: number;
}

/**
 * Parse and validate contribution import data
 * Returns preview data for user review before import
 */
export async function validateContributionImportData(
  residenceId: number,
  year: number,
  monthlyAmount: number,
  data: ContributionImportRow[]
): Promise<{ data?: ContributionImportPreview[]; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get all residents by apartment number
  const { data: residents, error: residentsError } = await supabase
    .from('profile_residences')
    .select(`
      profile_id,
      apartment_number,
      verified,
      profiles:profile_id(
        id,
        full_name
      )
    `)
    .eq('residence_id', residenceId);

  if (residentsError) {
    return { error: 'Failed to fetch residents' };
  }

  const residentsByApartment = new Map(
    residents
      ?.filter((r) => r.verified)
      .map((r) => [
        r.apartment_number,
        {
          id: r.profile_id,
          name: (r.profiles as any)?.full_name || 'Unknown',
        },
      ]) || []
  );

  const preview: ContributionImportPreview[] = [];

  for (const row of data) {
    const resident = residentsByApartment.get(row.apartmentNumber);
    const monthCount = Object.keys(row.months).length;
    const paidMonths = Object.values(row.months).filter((s) => s === 'paid').length;
    const unpaidMonths = monthCount - paidMonths;

    preview.push({
      apartmentNumber: row.apartmentNumber,
      residentName: resident?.name,
      residentId: resident?.id,
      matched: !!resident,
      paidMonths,
      unpaidMonths,
      totalAmount: monthCount * monthlyAmount,
    });
  }

  return { data: preview };
}

/**
 * Import historical contribution data
 * Creates fee and payment records for all imported data
 */
export async function importHistoricalContributions(
  residenceId: number,
  year: number,
  monthlyAmount: number,
  data: ContributionImportRow[]
): Promise<{ success?: boolean; feesImported?: number; paymentsImported?: number; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  try {
    // Get all residents by apartment number
    const { data: residents } = await supabase
      .from('profile_residences')
      .select('profile_id, apartment_number, verified')
      .eq('residence_id', residenceId);

    const residentsByApartment = new Map(
      residents?.filter((r) => r.verified).map((r) => [r.apartment_number, r.profile_id]) || []
    );

    // Month mapping (French to English)
    const monthMap: Record<string, number> = {
      janv: 1,
      févr: 2,
      mars: 3,
      avr: 4,
      mai: 5,
      juin: 6,
      juil: 7,
      août: 8,
      sept: 9,
      oct: 10,
      nov: 11,
      déc: 12,
    };

    const feesToInsert = [];
    const paymentsData = [];

    // Process each apartment
    for (const row of data) {
      const profileId = residentsByApartment.get(row.apartmentNumber);
      if (!profileId) continue; // Skip if resident not found

      // Process each month
      for (const [monthKey, status] of Object.entries(row.months)) {
        const [monthName, yearStr] = monthKey.split('-');
        const month = monthMap[monthName];
        const contributionYear = parseInt('20' + yearStr);

        if (month && contributionYear === year) {
          const dueDate = new Date(contributionYear, month - 1, 1);

          // Create fee record
          feesToInsert.push({
            residence_id: residenceId,
            user_id: profileId,
            title: `Contribution ${monthName}-${yearStr}`,
            amount: monthlyAmount,
            due_date: dueDate.toISOString().split('T')[0],
            status: status === 'paid' ? 'paid' : 'unpaid',
            contribution_month: month,
            contribution_year: contributionYear,
            is_historical: true,
            imported_at: new Date().toISOString(),
          });

          // If paid, prepare payment data
          if (status === 'paid') {
            paymentsData.push({
              profileId,
              apartmentNumber: row.apartmentNumber,
              amount: monthlyAmount,
              dueDate: dueDate.toISOString(),
            });
          }
        }
      }
    }

    // Insert fees
    const { data: insertedFees, error: feesError } = await supabase
      .from('fees')
      .insert(feesToInsert)
      .select('id, user_id, due_date');

    if (feesError) {
      console.error('Error inserting fees:', feesError);
      return { error: 'Failed to import fees: ' + feesError.message };
    }

    // Create payments and link to fees
    if (paymentsData.length > 0 && insertedFees) {
      const feeMap = new Map(insertedFees?.map((f) => [`${f.user_id}-${f.due_date}`, f.id]) || []);

      const paymentsToInsert = paymentsData.map((payment) => {
        const feeId = feeMap.get(`${payment.profileId}-${payment.dueDate.split('T')[0]}`);
        return {
          residence_id: residenceId,
          user_id: payment.profileId,
          apartment_number: payment.apartmentNumber,
          fee_id: feeId || null,
          amount: payment.amount,
          method: 'cash', // Default, can be updated later
          status: 'verified',
          paid_at: payment.dueDate,
        };
      });

      const { error: paymentsError } = await supabase.from('payments').insert(paymentsToInsert);

      if (paymentsError) {
        console.error('Error inserting payments:', paymentsError);
        return { error: 'Failed to import payments: ' + paymentsError.message };
      }
    }

    // Update residence setup mode
    const { error: updateError } = await supabase
      .from('residences')
      .update({
        contribution_setup_mode: 'historical',
        historical_data_imported_at: new Date().toISOString(),
        monthly_contribution_amount: monthlyAmount,
      })
      .eq('id', residenceId);

    if (updateError) {
      console.error('Error updating residence:', updateError);
    }

    return {
      success: true,
      feesImported: feesToInsert.length,
      paymentsImported: paymentsData.length,
    };
  } catch (error: any) {
    console.error('Import error:', error);
    return { error: error.message || 'Failed to import contributions' };
  }
}

