-- Migration script to populate profile_residences and fix syndic assignment
-- Run this in your Supabase SQL Editor

-- 1. Link Syndics to Residences (populate syndic_user_id)
-- We try to recover this from profiles.residence_id if it still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'dbasakan' AND table_name = 'profiles' AND column_name = 'residence_id') THEN
        UPDATE dbasakan.residences r
        SET syndic_user_id = p.id
        FROM dbasakan.profiles p
        WHERE p.residence_id = r.id AND p.role = 'syndic' AND r.syndic_user_id IS NULL;
        
        RAISE NOTICE 'Updated syndic_user_id from profiles';
    ELSE
        RAISE NOTICE 'Column residence_id does not exist on profiles, skipping syndic link recovery';
    END IF;
END $$;

-- 2. Populate profile_residences for all users (Residents, Syndics, Guards)
-- This ensures the new M:N relationship table is populated from the old 1:1 column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'dbasakan' AND table_name = 'profiles' AND column_name = 'residence_id') THEN
        -- Insert missing relationships
        INSERT INTO dbasakan.profile_residences (profile_id, residence_id, apartment_number, verified, created_at)
        SELECT 
            p.id, 
            p.residence_id, 
            p.apartment_number, -- Assuming apartment_number might still exist or we take what we can
            COALESCE(p.verified, false), 
            COALESCE(p.created_at, now())
        FROM dbasakan.profiles p
        WHERE p.residence_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM dbasakan.profile_residences pr 
            WHERE pr.profile_id = p.id AND pr.residence_id = p.residence_id
        );
        
        RAISE NOTICE 'Populated profile_residences from profiles';
    ELSE
        RAISE NOTICE 'Column residence_id does not exist on profiles, skipping profile_residences population';
    END IF;
END $$;

-- 3. Ensure all Syndics are also in profile_residences (so they can be listed/managed if needed, though usually they manage)
-- This connects the syndic to their residence in the M:N table too
INSERT INTO dbasakan.profile_residences (profile_id, residence_id, verified, created_at)
SELECT 
    r.syndic_user_id, 
    r.id, 
    true, 
    now()
FROM dbasakan.residences r
WHERE r.syndic_user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM dbasakan.profile_residences pr 
    WHERE pr.profile_id = r.syndic_user_id AND pr.residence_id = r.id
);

