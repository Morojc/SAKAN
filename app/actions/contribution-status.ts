'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

export interface ContributionStatusRow {
  apartmentNumber: string;
  residentName: string;
  residentId: string;
  outstandingMonths: number;
  months: {
    [monthKey: string]: 'paid' | 'unpaid' | 'none'; // 'none' means no fee for that month
  };
}

/**
 * Get contribution status for all apartments in a residence for a specific year
 */
export async function getContributionStatus(
  residenceId: number,
  year: number
): Promise<{ data?: ContributionStatusRow[]; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: 'Unauthorized' };
  }

  const supabase = await createSupabaseAdminClient();

  // Get all residents
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
    .eq('residence_id', residenceId)
    .eq('verified', true)
    .order('apartment_number');

  if (residentsError) {
    return { error: 'Failed to fetch residents' };
  }

  // Get all fees for the year
  const { data: fees, error: feesError } = await supabase
    .from('fees')
    .select('user_id, contribution_month, contribution_year, status')
    .eq('residence_id', residenceId)
    .eq('contribution_year', year)
    .not('contribution_month', 'is', null);

  if (feesError) {
    return { error: 'Failed to fetch fees' };
  }

  // Build status rows
  const statusRows: ContributionStatusRow[] = [];
  const monthNames = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

  for (const resident of residents || []) {
    const months: { [key: string]: 'paid' | 'unpaid' | 'none' } = {};
    let outstandingCount = 0;

    // Initialize all months
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${monthNames[i - 1]}-${year.toString().slice(-2)}`;
      months[monthKey] = 'none';
    }

    // Fill in fee statuses
    const residentFees = fees?.filter((f) => f.user_id === resident.profile_id) || [];
    
    for (const fee of residentFees) {
      if (fee.contribution_month) {
        const monthKey = `${monthNames[fee.contribution_month - 1]}-${year.toString().slice(-2)}`;
        months[monthKey] = fee.status === 'paid' ? 'paid' : 'unpaid';
        
        if (fee.status !== 'paid') {
          outstandingCount++;
        }
      }
    }

    statusRows.push({
      apartmentNumber: resident.apartment_number,
      residentName: (resident.profiles as any)?.full_name || 'Unknown',
      residentId: resident.profile_id,
      outstandingMonths: outstandingCount,
      months,
    });
  }

  return { data: statusRows };
}

