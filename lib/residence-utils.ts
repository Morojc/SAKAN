export async function getUserResidenceId(supabase: any, userId: string, role?: string) {
    if (!userId) return null;

    // If role is not provided, fetch it
    if (!role) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
        
        if (!profile) return null;
        role = profile.role;
    }

    if (role === 'syndic') {
        const { data: res } = await supabase
            .from('residences')
            .select('id')
            .eq('syndic_user_id', userId)
            .maybeSingle();
        return res?.id || null;
    } else if (role === 'guard') {
        const { data: res } = await supabase
            .from('residences')
            .select('id')
            .eq('guard_user_id', userId)
            .maybeSingle();
        return res?.id || null;
    } else {
        // Resident
        // For now, return the first residence found.
        // In the future, if we support multiple residences, this logic will need to change
        // or accept a context/residenceId to validate against.
        const { data: pr } = await supabase
            .from('profile_residences')
            .select('residence_id')
            .eq('profile_id', userId)
            .limit(1)
            .maybeSingle();
        return pr?.residence_id || null;
    }
}

