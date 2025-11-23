import { createSupabaseAdminClient } from '@/utils/supabase/server';

export async function transferSyndicData(fromUserId: string, toUserId: string) {
  const supabase = createSupabaseAdminClient();
  
  try {
    console.log(`[Transfer] Starting data transfer from ${fromUserId} to ${toUserId}`);
    
    // 1. Transfer residence ownership (syndic_user_id)
    // First get the residence where the user is syndic
    const { data: residence, error: resError } = await supabase
      .from('residences')
      .select('id')
      .eq('syndic_user_id', fromUserId)
      .maybeSingle();
      
    if (resError) {
      console.error('[Transfer] Error fetching residence:', resError);
    }
    
    if (residence) {
      const { error: updateResError } = await supabase
        .from('residences')
        .update({ syndic_user_id: toUserId })
        .eq('id', residence.id);
        
      if (updateResError) {
        console.error('[Transfer] Error transferring residence ownership:', updateResError);
        throw new Error('Failed to transfer residence ownership');
      }
      console.log('[Transfer] Residence ownership transferred');
    }
    
    // 2. Transfer Fees
    const { error: feesError } = await supabase
      .from('fees')
      .update({ user_id: toUserId })
      .eq('user_id', fromUserId);
      
    if (feesError) {
      console.error('[Transfer] Error transferring fees:', feesError);
    } else {
      console.log('[Transfer] Fees transferred');
    }
    
    // 3. Transfer Payments (as payer)
    const { error: paymentsError } = await supabase
      .from('payments')
      .update({ user_id: toUserId })
      .eq('user_id', fromUserId);
      
    if (paymentsError) {
      console.error('[Transfer] Error transferring payments:', paymentsError);
    } else {
      console.log('[Transfer] Payments transferred');
    }
    
    // 4. Transfer Payments (as verifier) - Update verified_by
    const { error: verifiedPaymentsError } = await supabase
      .from('payments')
      .update({ verified_by: toUserId })
      .eq('verified_by', fromUserId);
      
    if (verifiedPaymentsError) {
      console.error('[Transfer] Error transferring verified payments:', verifiedPaymentsError);
    }
    
    // 5. Transfer Incidents (as creator)
    const { error: incidentsError } = await supabase
      .from('incidents')
      .update({ user_id: toUserId })
      .eq('user_id', fromUserId);
      
    if (incidentsError) {
      console.error('[Transfer] Error transferring incidents (creator):', incidentsError);
    }
    
    // 6. Transfer Incidents (as assignee)
    const { error: assignedIncidentsError } = await supabase
      .from('incidents')
      .update({ assigned_to: toUserId })
      .eq('assigned_to', fromUserId);
      
    if (assignedIncidentsError) {
      console.error('[Transfer] Error transferring incidents (assignee):', assignedIncidentsError);
    }
    
    // 7. Transfer Announcements (as creator)
    const { error: announcementsError } = await supabase
      .from('announcements')
      .update({ created_by: toUserId })
      .eq('created_by', fromUserId);
      
    if (announcementsError) {
      console.error('[Transfer] Error transferring announcements:', announcementsError);
    }
    
    // 8. Transfer Expenses (as creator)
    const { error: expensesError } = await supabase
      .from('expenses')
      .update({ created_by: toUserId })
      .eq('created_by', fromUserId);
      
    if (expensesError) {
      console.error('[Transfer] Error transferring expenses:', expensesError);
    }
    
    // 9. Transfer Polls (as creator)
    const { error: pollsError } = await supabase
      .from('polls')
      .update({ created_by: toUserId })
      .eq('created_by', fromUserId);
      
    if (pollsError) {
      console.error('[Transfer] Error transferring polls:', pollsError);
    }
    
    // 10. Transfer Poll Votes
    const { error: votesError } = await supabase
      .from('poll_votes')
      .update({ user_id: toUserId })
      .eq('user_id', fromUserId);
      
    if (votesError) {
      console.error('[Transfer] Error transferring poll votes:', votesError);
    }
    
    // 11. Transfer Access Logs (generated_by)
    const { error: logsError } = await supabase
      .from('access_logs')
      .update({ generated_by: toUserId })
      .eq('generated_by', fromUserId);
      
    if (logsError) {
      console.error('[Transfer] Error transferring access logs (generator):', logsError);
    }
    
    // 12. Transfer Access Logs (scanned_by)
    const { error: scannedLogsError } = await supabase
      .from('access_logs')
      .update({ scanned_by: toUserId })
      .eq('scanned_by', fromUserId);
      
    if (scannedLogsError) {
      console.error('[Transfer] Error transferring access logs (scanner):', scannedLogsError);
    }
    
    // 13. Transfer Deliveries (recipient)
    const { error: deliveriesError } = await supabase
      .from('deliveries')
      .update({ recipient_id: toUserId })
      .eq('recipient_id', fromUserId);
      
    if (deliveriesError) {
      console.error('[Transfer] Error transferring deliveries (recipient):', deliveriesError);
    }
    
    // 14. Transfer Deliveries (logged_by)
    const { error: loggedDeliveriesError } = await supabase
      .from('deliveries')
      .update({ logged_by: toUserId })
      .eq('logged_by', fromUserId);
      
    if (loggedDeliveriesError) {
      console.error('[Transfer] Error transferring deliveries (logger):', loggedDeliveriesError);
    }
    
    // 15. Update replacement user's role to syndic
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: 'syndic' })
      .eq('id', toUserId);
      
    if (roleError) {
      console.error('[Transfer] Error updating replacement role:', roleError);
      throw new Error('Failed to update replacement user role');
    }
    
    console.log('[Transfer] Data transfer completed successfully');
    return true;
    
  } catch (error) {
    console.error('[Transfer] Fatal error during data transfer:', error);
    throw error;
  }
}

