-- =====================================================
-- ADD ADMIN ACCESS HASH
-- =====================================================
-- Add unique access hash for each admin
-- Admins can only login via their unique URL: /admin/{access_hash}
-- =====================================================

-- Add access_hash column to admins table
ALTER TABLE dbasakan.admins
ADD COLUMN IF NOT EXISTS access_hash text UNIQUE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_admins_access_hash ON dbasakan.admins(access_hash);

-- Add comment
COMMENT ON COLUMN dbasakan.admins.access_hash IS 'Unique hash for admin login URL (/admin/{access_hash})';

-- Function to generate random hash
CREATE OR REPLACE FUNCTION dbasakan.generate_admin_hash()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Function to create admin with access hash
CREATE OR REPLACE FUNCTION dbasakan.create_admin_with_hash(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS TABLE(
  admin_id text,
  access_hash text,
  login_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
  v_access_hash text;
  v_base_url text;
BEGIN
  -- Hash password
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Generate unique access hash
  LOOP
    v_access_hash := dbasakan.generate_admin_hash();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM dbasakan.admins WHERE access_hash = v_access_hash
    );
  END LOOP;
  
  -- Insert admin
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active, access_hash)
  VALUES (p_email, v_password_hash, p_full_name, true, v_access_hash)
  RETURNING id INTO v_admin_id;
  
  -- Get base URL from settings or use default
  v_base_url := COALESCE(
    current_setting('app.base_url', true),
    'http://localhost:3000'
  );
  
  RETURN QUERY
  SELECT 
    v_admin_id,
    v_access_hash,
    v_base_url || '/admin/' || v_access_hash as login_url;
END;
$$;

-- Update existing create_admin function to include hash
DROP FUNCTION IF EXISTS dbasakan.create_admin(text, text, text);

CREATE OR REPLACE FUNCTION dbasakan.create_admin(
  p_email text,
  p_password text,
  p_full_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id text;
  v_password_hash text;
  v_access_hash text;
BEGIN
  -- Hash password
  v_password_hash := crypt(p_password, gen_salt('bf', 10));
  
  -- Generate unique access hash
  LOOP
    v_access_hash := dbasakan.generate_admin_hash();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM dbasakan.admins WHERE access_hash = v_access_hash
    );
  END LOOP;
  
  -- Insert admin
  INSERT INTO dbasakan.admins (email, password_hash, full_name, is_active, access_hash)
  VALUES (p_email, v_password_hash, p_full_name, true, v_access_hash)
  RETURNING id INTO v_admin_id;
  
  RETURN v_admin_id;
END;
$$;

-- Function to regenerate admin access hash
CREATE OR REPLACE FUNCTION dbasakan.regenerate_admin_hash(
  p_admin_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_hash text;
BEGIN
  -- Generate unique access hash
  LOOP
    v_new_hash := dbasakan.generate_admin_hash();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM dbasakan.admins WHERE access_hash = v_new_hash
    );
  END LOOP;
  
  -- Update admin
  UPDATE dbasakan.admins
  SET access_hash = v_new_hash
  WHERE id = p_admin_id;
  
  RETURN v_new_hash;
END;
$$;

-- Backfill existing admins with access hashes
DO $$
DECLARE
  admin_record RECORD;
  v_hash text;
BEGIN
  FOR admin_record IN SELECT id FROM dbasakan.admins WHERE access_hash IS NULL
  LOOP
    -- Generate unique hash
    LOOP
      v_hash := dbasakan.generate_admin_hash();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM dbasakan.admins WHERE access_hash = v_hash
      );
    END LOOP;
    
    -- Update admin
    UPDATE dbasakan.admins
    SET access_hash = v_hash
    WHERE id = admin_record.id;
  END LOOP;
END $$;

-- Make access_hash NOT NULL after backfill
ALTER TABLE dbasakan.admins
ALTER COLUMN access_hash SET NOT NULL;

-- =====================================================
-- EXAMPLES
-- =====================================================

-- Create admin and get access URL:
-- SELECT * FROM dbasakan.create_admin_with_hash(
--   'admin@example.com',
--   'SecurePassword123!',
--   'Admin Name'
-- );
-- Returns: admin_id, access_hash, and full login_url

-- List all admins with their access URLs:
-- SELECT 
--   id,
--   email,
--   full_name,
--   access_hash,
--   'http://localhost:3000/admin/' || access_hash as login_url
-- FROM dbasakan.admins;

-- Regenerate access hash for an admin:
-- SELECT dbasakan.regenerate_admin_hash('admin-id-here');
-- =====================================================

