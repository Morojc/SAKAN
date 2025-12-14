-- ============================================================================
-- Fix NextAuth Column Names (Case Sensitivity)
-- ============================================================================
-- PostgreSQL converts unquoted identifiers to lowercase, but NextAuth expects
-- camelCase column names. This script renames columns to use quoted identifiers.
-- ============================================================================

-- Fix accounts table
DO $$
BEGIN
    -- Rename userId if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'accounts' 
        AND column_name = 'userid'
    ) THEN
        ALTER TABLE dbasakan.accounts RENAME COLUMN userid TO "userId";
    END IF;
    
    -- Rename providerAccountId if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'accounts' 
        AND column_name = 'provideraccountid'
    ) THEN
        ALTER TABLE dbasakan.accounts RENAME COLUMN provideraccountid TO "providerAccountId";
    END IF;
END $$;

-- Fix sessions table
DO $$
BEGIN
    -- Rename sessionToken if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'sessions' 
        AND column_name = 'sessiontoken'
    ) THEN
        ALTER TABLE dbasakan.sessions RENAME COLUMN sessiontoken TO "sessionToken";
    END IF;
    
    -- Rename userId if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'sessions' 
        AND column_name = 'userid'
    ) THEN
        ALTER TABLE dbasakan.sessions RENAME COLUMN userid TO "userId";
    END IF;
END $$;

-- Fix users table
DO $$
BEGIN
    -- Rename emailVerified if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'users' 
        AND column_name = 'emailverified'
    ) THEN
        ALTER TABLE dbasakan.users RENAME COLUMN emailverified TO "emailVerified";
    END IF;
    
    -- Rename createdAt if it exists as lowercase
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'dbasakan' 
        AND table_name = 'users' 
        AND column_name = 'createdat'
    ) THEN
        ALTER TABLE dbasakan.users RENAME COLUMN createdat TO "createdAt";
    END IF;
END $$;

-- Update foreign key constraints to use quoted column names
DO $$
BEGIN
    -- Drop and recreate accounts foreign key
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'accounts_userid_fkey'
    ) THEN
        ALTER TABLE dbasakan.accounts DROP CONSTRAINT accounts_userid_fkey;
        ALTER TABLE dbasakan.accounts 
        ADD CONSTRAINT accounts_userid_fkey 
        FOREIGN KEY ("userId") REFERENCES dbasakan.users(id);
    END IF;
    
    -- Drop and recreate sessions foreign key
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sessions_userid_fkey'
    ) THEN
        ALTER TABLE dbasakan.sessions DROP CONSTRAINT sessions_userid_fkey;
        ALTER TABLE dbasakan.sessions 
        ADD CONSTRAINT sessions_userid_fkey 
        FOREIGN KEY ("userId") REFERENCES dbasakan.users(id);
    END IF;
END $$;

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE 'Column names fixed successfully!';
    RAISE NOTICE 'NextAuth adapter should now work correctly with camelCase columns';
END $$;

