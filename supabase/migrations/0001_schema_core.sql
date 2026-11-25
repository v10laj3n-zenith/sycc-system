-- ============================================================================
-- SYCC Youth Growth & Discipleship Monitoring System
-- Migration 0001: Extensions, Domain Enums, Core Schema & Indexes
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 1. Domain Enums
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM (
      'member',
      'cell_leader',
      'registrar',
      'treasurer',
      'pastor',
      'system_admin'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discipleship_tier' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.discipleship_tier AS ENUM (
      'new_invite',
      'invite',
      'disciple',
      'cell_leader',
      'alumni'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_method' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.attendance_method AS ENUM (
      'qr_scan',
      'manual_search',
      'walk_in'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'giving_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.giving_type AS ENUM (
      'tithe',
      'offering',
      'missions',
      'special'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.payment_method AS ENUM (
      'cash',
      'gcash_ewallet'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ministry_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.ministry_status AS ENUM (
      'active',
      'resting',
      'inactive'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rsvp_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.rsvp_status AS ENUM (
      'going',
      'maybe',
      'not_going'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Profiles (Dual Hierarchy + Observable Milestones)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  nickname TEXT,
  email TEXT,
  phone TEXT,
  birthday DATE,
  avatar_url TEXT,
  bio TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  tier public.discipleship_tier NOT NULL DEFAULT 'new_invite',

  -- Dual Hierarchy Pointers (Non-Negotiable):
  -- invited_by_id = Permanent spiritual genealogy (Discipleship Tree)
  -- current_leader_id = Active cell shepherd (updated on Graduation / Multiplication)
  invited_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  current_leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Observable Attendance & Ministry Milestones (never percentage spirituality scores)
  consecutive_saturday_streak INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_saturday_streak >= 0),
  longest_saturday_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_saturday_streak >= 0),
  total_saturdays_attended INTEGER NOT NULL DEFAULT 0 CHECK (total_saturdays_attended >= 0),
  last_attended_saturday DATE,
  ministry_team TEXT,
  ministry_status public.ministry_status NOT NULL DEFAULT 'inactive',
  ministry_streak INTEGER NOT NULL DEFAULT 0 CHECK (ministry_streak >= 0),

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_no_self_invite CHECK (invited_by_id IS NULL OR invited_by_id <> id),
  CONSTRAINT profiles_no_self_leader CHECK (current_leader_id IS NULL OR current_leader_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by_id ON public.profiles(invited_by_id);
CREATE INDEX IF NOT EXISTS idx_profiles_current_leader_id ON public.profiles(current_leader_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND trim(email) <> '';
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- 3. Saturday Attendance Logs (Realtime-enabled for Treasurer live sync)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  method public.attendance_method NOT NULL DEFAULT 'qr_scan',
  notes TEXT,
  CONSTRAINT attendance_logs_unique_member_date UNIQUE (profile_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_service_date ON public.attendance_logs(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_profile_date ON public.attendance_logs(profile_id, service_date DESC);

-- ----------------------------------------------------------------------------
-- 4. Encrypted Care Vault (pgcrypto bytea storage, archived on graduation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_note BYTEA NOT NULL,
  category TEXT NOT NULL DEFAULT 'pastoral' CHECK (category IN ('pastoral', 'prayer', 'family', 'academic', 'discipleship', 'other')),
  follow_up_date DATE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_notes_leader_active
  ON public.care_notes(leader_id, member_id)
  WHERE is_archived = FALSE;

-- ----------------------------------------------------------------------------
-- 5. Cell Meetups & RSVPs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cell_meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
  topic TEXT,
  location TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cell_meetups_leader_date ON public.cell_meetups(leader_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS public.cell_meetup_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES public.cell_meetups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cell_meetup_rsvps_unique UNIQUE (meetup_id, member_id)
);

-- ----------------------------------------------------------------------------
-- 6. Treasury: Cash Liquidations, Tithes & Offerings, Petty Cash, Counter PINs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date DATE NOT NULL UNIQUE,

  -- Philippine Peso (PHP) physical denominations
  count_1000 INTEGER NOT NULL DEFAULT 0 CHECK (count_1000 >= 0),
  count_500  INTEGER NOT NULL DEFAULT 0 CHECK (count_500 >= 0),
  count_200  INTEGER NOT NULL DEFAULT 0 CHECK (count_200 >= 0),
  count_100  INTEGER NOT NULL DEFAULT 0 CHECK (count_100 >= 0),
  count_50   INTEGER NOT NULL DEFAULT 0 CHECK (count_50 >= 0),
  count_20   INTEGER NOT NULL DEFAULT 0 CHECK (count_20 >= 0),
  count_10   INTEGER NOT NULL DEFAULT 0 CHECK (count_10 >= 0),
  count_5    INTEGER NOT NULL DEFAULT 0 CHECK (count_5 >= 0),
  count_1    INTEGER NOT NULL DEFAULT 0 CHECK (count_1 >= 0),

  actual_physical_cash NUMERIC(12,2) GENERATED ALWAYS AS (
    (count_1000 * 1000) +
    (count_500  * 500)  +
    (count_200  * 200)  +
    (count_100  * 100)  +
    (count_50   * 50)   +
    (count_20   * 20)   +
    (count_10   * 10)   +
    (count_5    * 5)    +
    (count_1    * 1)
  ) STORED,

  expected_cash_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gcash_ewallet_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_expenses      NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  net_turnover        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  variance            NUMERIC(12,2) NOT NULL DEFAULT 0.00,

  -- 2-Counter PIN Sign-Off Lock
  counter_1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  counter_1_signed_at TIMESTAMPTZ,
  counter_2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  counter_2_signed_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  receipts_dispatched_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cash_liquidations_distinct_counters
    CHECK (counter_1_id IS NULL OR counter_2_id IS NULL OR counter_1_id <> counter_2_id)
);

CREATE TABLE IF NOT EXISTS public.tithes_and_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL = anonymous loose plate
  service_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  giving_type public.giving_type NOT NULL DEFAULT 'tithe',
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  liquidation_id UUID REFERENCES public.cash_liquidations(id) ON DELETE SET NULL,
  receipt_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tithes_service_date ON public.tithes_and_offerings(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_tithes_giver_date ON public.tithes_and_offerings(giver_id, service_date DESC);

CREATE TABLE IF NOT EXISTS public.liquidation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID NOT NULL REFERENCES public.cash_liquidations(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 2),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  receipt_image_url TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liquidation_expenses_liq ON public.liquidation_expenses(liquidation_id);

CREATE TABLE IF NOT EXISTS public.treasurer_pins (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. Koinonia Prayer Wall & Church Events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.koinonia_prayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) >= 3),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  is_answered BOOLEAN NOT NULL DEFAULT FALSE,
  answered_testimony TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koinonia_prayers_created ON public.koinonia_prayers(created_at DESC);

CREATE TABLE IF NOT EXISTS public.prayer_amens (
  prayer_id UUID NOT NULL REFERENCES public.koinonia_prayers(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.church_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  banner_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_church_events_date ON public.church_events(event_date DESC);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id UUID NOT NULL REFERENCES public.church_events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- 8. Web Push Subscriptions (VAPID)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON public.push_subscriptions(profile_id);

-- ----------------------------------------------------------------------------
-- 9. Dynamic Seasonal Theme Studio
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_theme_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_title TEXT NOT NULL,
  anchor_verse TEXT NOT NULL,
  verse_reference TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#1E3A8A',
  accent_color TEXT NOT NULL DEFAULT '#059669',
  banner_gradient TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #DBEAFE 0%, #DCFCE7 100%)',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_theme_single_active
  ON public.app_theme_settings (is_active)
  WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 10. System Audit Logs (Append-Only Root Override Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  before_state JSONB,
  after_state JSONB,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created ON public.system_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON public.system_audit_logs(actor_id);
