-- Migration 009: Session Token columns for parent PIN auth (Phase 07)

ALTER TABLE families ADD COLUMN IF NOT EXISTS current_session_token uuid;
ALTER TABLE families ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

-- Update families_safe view to exclude sensitive columns
CREATE OR REPLACE VIEW families_safe AS
SELECT id, name, timezone, force_morning_boost, auto_approve_hours, created_at
FROM families;
