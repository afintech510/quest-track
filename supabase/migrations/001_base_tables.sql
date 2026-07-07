-- Migration 001: Base Tables (17 tables)
-- Applied to Supabase remote via MCP

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_hash text NOT NULL,
  pin_attempts integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  timezone text NOT NULL DEFAULT 'America/New_York',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#f43f5e',
  xp integer NOT NULL DEFAULT 0,
  daily_xp integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  last_active_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_xp_nonneg CHECK (xp >= 0),
  CONSTRAINT chk_daily_xp_nonneg CHECK (daily_xp >= 0),
  CONSTRAINT chk_coins_nonneg CHECK (coins >= 0)
);

CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_module_subject CHECK (subject IN ('math','ela','science','social_studies'))
);

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  video_id text NOT NULL DEFAULT '',
  video_type text NOT NULL DEFAULT 'youtube',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_video_type CHECK (video_type IN ('youtube','vimeo','local'))
);

CREATE TABLE fallback_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_index integer NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  standard_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  page_count integer NOT NULL DEFAULT 0,
  reading_level text NOT NULL DEFAULT '',
  tier text NOT NULL DEFAULT 'bronze',
  xp_reward integer NOT NULL DEFAULT 10,
  coin_reward integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_book_tier CHECK (tier IN ('bronze','silver','gold'))
);

CREATE TABLE book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT chk_book_status CHECK (status IN ('in_progress','completed'))
);

CREATE TABLE reading_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_id uuid NOT NULL REFERENCES book_progress(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  photo_url text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chore_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  xp_reward integer NOT NULL DEFAULT 10,
  coin_reward integer NOT NULL DEFAULT 5,
  frequency text NOT NULL DEFAULT 'daily',
  auto_approve_hours integer NOT NULL DEFAULT 24,
  assigned_to uuid REFERENCES kids(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_chore_frequency CHECK (frequency IN ('daily','weekly','once'))
);

CREATE TABLE chore_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id uuid NOT NULL REFERENCES chore_definitions(id) ON DELETE CASCADE,
  kid_id uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reset',
  reset_period text NOT NULL DEFAULT 'daily',
  completed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_chore_status CHECK (status IN ('reset','completed','pending_approval','approved','rejected')),
  CONSTRAINT chk_reset_period CHECK (reset_period IN ('daily','weekly','once'))
);

CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kid_id uuid REFERENCES kids(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  rrule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_category CHECK (category IN ('general','school','chore','reward','quiz'))
);

CREATE TABLE quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  difficulty_tier text NOT NULL DEFAULT 'normal',
  questions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_difficulty_tier CHECK (difficulty_tier IN ('easy','normal','hard'))
);

CREATE TABLE reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  coins_spent integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  cost integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE processed_mutations (
  mutation_id text PRIMARY KEY,
  result jsonb NOT NULL DEFAULT '{}',
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  last_daily_reset date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  min_supported text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now()
);
