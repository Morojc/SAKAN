-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE dbasakan.access_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  generated_by text NOT NULL,
  visitor_name text NOT NULL,
  qr_code_data text NOT NULL,
  valid_from timestamp with time zone NOT NULL,
  valid_to timestamp with time zone NOT NULL,
  scanned_at timestamp with time zone,
  scanned_by text,
  CONSTRAINT access_logs_pkey PRIMARY KEY (id),
  CONSTRAINT access_logs_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT access_logs_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES dbasakan.profiles(id),
  CONSTRAINT access_logs_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);
CREATE TABLE dbasakan.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  userId text NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  providerAccountId text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_userid_fkey FOREIGN KEY (userId) REFERENCES dbasakan.users(id)
);
CREATE TABLE dbasakan.announcements (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  attachment_url text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.balance_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  snapshot_date date NOT NULL,
  cash_balance numeric NOT NULL DEFAULT 0,
  bank_balance numeric NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT balance_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT balance_snapshots_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT balance_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  recipient_id text NOT NULL,
  logged_by text NOT NULL,
  description text NOT NULL,
  picked_up_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT deliveries_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric NOT NULL,
  attachment_url text,
  expense_date date NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.fees (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'unpaid'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fees_pkey PRIMARY KEY (id),
  CONSTRAINT fees_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT fees_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.incidents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  photo_url text,
  status USER-DEFINED NOT NULL DEFAULT 'open'::dbasakan.incident_status,
  assigned_to text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incidents_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT incidents_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  type USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'unread'::dbasakan.notification_status,
  title text NOT NULL,
  message text NOT NULL,
  action_data jsonb DEFAULT '{}'::jsonb,
  residence_id bigint,
  access_code_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT notifications_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);
CREATE TABLE dbasakan.payments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  user_id text NOT NULL,
  fee_id bigint,
  amount numeric NOT NULL,
  method USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::dbasakan.payment_status,
  proof_url text,
  paid_at timestamp with time zone DEFAULT now(),
  verified_by text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT payments_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES dbasakan.fees(id),
  CONSTRAINT payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.poll_options (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  poll_id bigint NOT NULL,
  option_text text NOT NULL,
  CONSTRAINT poll_options_pkey PRIMARY KEY (id),
  CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES dbasakan.polls(id)
);
CREATE TABLE dbasakan.poll_votes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  poll_id bigint NOT NULL,
  option_id bigint NOT NULL,
  user_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT poll_votes_pkey PRIMARY KEY (id),
  CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES dbasakan.polls(id),
  CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES dbasakan.poll_options(id),
  CONSTRAINT poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.polls (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  question text NOT NULL,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT polls_pkey PRIMARY KEY (id),
  CONSTRAINT polls_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.profile_residences (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  profile_id text NOT NULL,
  residence_id bigint NOT NULL,
  apartment_number text,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_residences_pkey PRIMARY KEY (id),
  CONSTRAINT profile_residences_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES dbasakan.profiles(id),
  CONSTRAINT profile_residences_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);
CREATE TABLE dbasakan.profiles (
  id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  residence_id bigint,
  full_name text NOT NULL,
  apartment_number text,
  phone_number text,
  role USER-DEFINED NOT NULL DEFAULT 'resident'::dbasakan.user_role,
  onboarding_completed boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  verification_token text UNIQUE,
  verification_token_expires_at timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES dbasakan.users(id),
  CONSTRAINT profiles_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id)
);
CREATE TABLE dbasakan.residences (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  bank_account_rib text,
  syndic_user_id text,
  CONSTRAINT residences_pkey PRIMARY KEY (id),
  CONSTRAINT residences_syndic_user_id_fkey FOREIGN KEY (syndic_user_id) REFERENCES dbasakan.users(id)
);
CREATE TABLE dbasakan.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sessionToken text NOT NULL UNIQUE,
  userId text NOT NULL,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_userid_fkey FOREIGN KEY (userId) REFERENCES dbasakan.users(id)
);
CREATE TABLE dbasakan.stripe_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  stripe_customer_id text NOT NULL UNIQUE,
  subscription_id text,
  plan_active boolean NOT NULL DEFAULT false,
  plan_expires bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  plan_name text,
  price_id text,
  amount numeric,
  currency text DEFAULT 'usd'::text,
  interval text,
  subscription_status text,
  days_remaining integer,
  CONSTRAINT stripe_customers_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES dbasakan.users(id)
);
CREATE TABLE dbasakan.transaction_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  residence_id bigint NOT NULL,
  transaction_type text NOT NULL,
  reference_id bigint,
  reference_table text,
  amount numeric NOT NULL,
  balance_after numeric,
  method text,
  description text,
  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transaction_history_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_history_residence_id_fkey FOREIGN KEY (residence_id) REFERENCES dbasakan.residences(id),
  CONSTRAINT transaction_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES dbasakan.profiles(id)
);
CREATE TABLE dbasakan.users (
  id text NOT NULL,
  name text,
  email text UNIQUE,
  emailVerified timestamp with time zone,
  image text,
  createdAt timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE dbasakan.verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL UNIQUE,
  expires timestamp with time zone NOT NULL,
  CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token)
);