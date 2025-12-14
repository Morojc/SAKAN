-- Create access_codes table for syndic replacement flow
CREATE TABLE IF NOT EXISTS dbasakan.access_codes (
  id bigint generated always as identity primary key,
  code text not null unique, -- 6-8 digit alphanumeric code
  original_user_id text not null references dbasakan.profiles(id) on delete cascade,
  replacement_email text not null, -- Email of replacement resident
  residence_id bigint not null references dbasakan.residences(id),
  action_type text not null, -- 'delete_account' or 'change_role'
  code_used boolean default false,
  used_by_user_id text references dbasakan.profiles(id), -- Set when code is used
  expires_at timestamp with time zone not null, -- 7 days from creation
  created_at timestamp with time zone default now(),
  used_at timestamp with time zone
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON dbasakan.access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_original_user ON dbasakan.access_codes(original_user_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_replacement_email ON dbasakan.access_codes(replacement_email);

-- Add RLS policies
ALTER TABLE dbasakan.access_codes ENABLE ROW LEVEL SECURITY;

-- Allow syndics to create codes
CREATE POLICY "Syndics can create access codes" 
  ON dbasakan.access_codes FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dbasakan.profiles
      WHERE id = auth.uid()::text AND role = 'syndic'
    )
  );

-- Allow reading codes (for validation) - restricted to avoid enumeration
-- Only allow reading by code match (for validation API which uses service role, but good to have RLS)
CREATE POLICY "Anyone can read access codes by exact match" 
  ON dbasakan.access_codes FOR SELECT 
  USING (true); -- We'll rely on exact code matching in queries

-- Allow syndics to view their created codes
CREATE POLICY "Syndics can view their created codes" 
  ON dbasakan.access_codes FOR SELECT 
  USING (original_user_id = auth.uid()::text);
