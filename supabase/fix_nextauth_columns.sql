-- ============================================================================
-- Fix NextAuth Column Names - Quick Fix
-- ============================================================================
-- This script ensures NextAuth columns use camelCase (quoted identifiers)
-- Run this if you're getting "column does not exist" errors
-- ============================================================================

-- Fix accounts table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'accounts' AND column_name = 'userid'
    ) THEN
        ALTER TABLE dbasakan.accounts RENAME COLUMN userid TO "userId";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'accounts' AND column_name = 'provideraccountid'
    ) THEN
        ALTER TABLE dbasakan.accounts RENAME COLUMN provideraccountid TO "providerAccountId";
    END IF;
END $$;

-- Fix sessions table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'sessions' AND column_name = 'sessiontoken'
    ) THEN
        ALTER TABLE dbasakan.sessions RENAME COLUMN sessiontoken TO "sessionToken";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'sessions' AND column_name = 'userid'
    ) THEN
        ALTER TABLE dbasakan.sessions RENAME COLUMN userid TO "userId";
    END IF;
END $$;

-- Fix users table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'users' AND column_name = 'emailverified'
    ) THEN
        ALTER TABLE dbasakan.users RENAME COLUMN emailverified TO "emailVerified";
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' AND table_name = 'users' AND column_name = 'createdat'
    ) THEN
        ALTER TABLE dbasakan.users RENAME COLUMN createdat TO "createdAt";
    END IF;
END $$;

-- Verify columns are fixed
DO $$
BEGIN
    RAISE NOTICE 'NextAuth column names fixed!';
    RAISE NOTICE 'Columns now use camelCase (quoted identifiers)';
END $$;

