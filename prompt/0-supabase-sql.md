
-- 1. DEFINING ENUMS (To ensure data consistency)
create type dbasakan.user_role as enum ('syndic', 'resident', 'guard');
create type dbasakan.payment_method as enum ('cash', 'bank_transfer', 'online_card', 'check');
create type dbasakan.payment_status as enum ('pending', 'completed', 'rejected');
create type dbasakan.incident_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- 2. RESIDENCES TABLE
create table dbasakan.residences (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now(),
  name text not null,
  address text not null,
  city text not null,
  bank_account_rib text, -- Keeping it text to handle dashes/spaces
  syndic_user_id uuid references auth.users(id) -- The main admin for this building
);

-- 3. PROFILES (Extends auth.users)
-- This replaces your 'dbasakan.user' table. It creates a 1-to-1 link with Supabase Auth.
create table dbasakan.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  created_at timestamp with time zone default now(),
  residence_id bigint references dbasakan.residences(id) on delete set null,
  full_name text not null,
  apartment_number text,
  phone_number text,
  role user_role not null default 'resident'
);
comment on table dbasakan.profiles is 'Extended user data linking to Supabase Auth. Stores name, role, and apartment info.';

-- 4. FEES (Appels de fonds)
create table dbasakan.fees (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null,
  title text not null, -- e.g. "Frais de Mars 2024"
  amount numeric(10,2) not null,
  due_date date not null,
  status text not null default 'unpaid', -- could make this an enum too
  created_at timestamp with time zone default now()
);

-- 5. PAYMENTS
create table dbasakan.payments (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null,
  fee_id bigint references dbasakan.fees(id), -- Optional: link payment to a specific fee
  amount numeric(10,2) not null,
  method payment_method not null, -- cash, bank_transfer, etc.
  status payment_status not null default 'pending', 
  proof_url text, -- Receipt image URL
  paid_at timestamp with time zone default now(),
  verified_by uuid references dbasakan.profiles(id) -- ID of Syndic who clicked "Confirm" for cash
);

-- 6. EXPENSES (Depenses)
create table dbasakan.expenses (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  description text not null,
  category text not null, -- e.g. 'Electricity', 'Cleaning'
  amount numeric(10,2) not null,
  attachment_url text, -- Invoice image
  expense_date date not null,
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

-- 7. INCIDENTS
create table dbasakan.incidents (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  user_id uuid references dbasakan.profiles(id) not null, -- Who reported it
  title text not null,
  description text not null,
  photo_url text,
  status incident_status not null default 'open',
  assigned_to uuid references dbasakan.profiles(id), -- Technician or Guard
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 8. ANNOUNCEMENTS
create table dbasakan.announcements (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  title text not null,
  content text not null,
  attachment_url text,
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

-- 9. POLLS & VOTES
create table dbasakan.polls (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  question text not null,
  is_active boolean default true,
  created_by uuid references dbasakan.profiles(id) default auth.uid(),
  created_at timestamp with time zone default now()
);

create table dbasakan.poll_options (
  id bigint generated always as identity primary key,
  poll_id bigint references dbasakan.polls(id) on delete cascade not null,
  option_text text not null
);

create table dbasakan.poll_votes (
  id bigint generated always as identity primary key,
  poll_id bigint references dbasakan.polls(id) on delete cascade not null,
  option_id bigint references dbasakan.poll_options(id) on delete cascade not null,
  user_id uuid references dbasakan.profiles(id) not null,
  created_at timestamp with time zone default now(),
  unique (poll_id, user_id) -- Ensures a user can only vote once per poll
);

-- 10. ACCESS (QR Codes)
create table dbasakan.access_logs (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  generated_by uuid references dbasakan.profiles(id) not null, -- Resident
  visitor_name text not null,
  qr_code_data text not null, -- The secret hash in the QR
  valid_from timestamp with time zone not null,
  valid_to timestamp with time zone not null,
  scanned_at timestamp with time zone, -- Null until used
  scanned_by uuid references dbasakan.profiles(id) -- Guard who scanned it
);

-- 11. DELIVERIES
create table dbasakan.deliveries (
  id bigint generated always as identity primary key,
  residence_id bigint references dbasakan.residences(id) not null,
  recipient_id uuid references dbasakan.profiles(id) not null, -- Resident
  logged_by uuid references dbasakan.profiles(id) not null, -- Guard
  description text not null, -- "Amazon Package", "Food"
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone default now()
);



-- Enable RLS on all tables
alter table dbasakan.profiles enable row level security;
alter table dbasakan.payments enable row level security;
alter table dbasakan.incidents enable row level security;
-- (Repeat for all tables)

-- Example Policy: Residents can see their own profile
create policy "Users can view own profile"
on dbasakan.profiles for select
using ( auth.uid() = id );

-- Example Policy: Syndic can view all payments in their residence
create policy "Syndics view all payments"
on dbasakan.payments for select
using (
  exists (
    select 1 from dbasakan.profiles
    where id = auth.uid() 
    and role = 'syndic' 
    and residence_id = payments.residence_id
  )
);
