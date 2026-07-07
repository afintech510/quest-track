-- Migration 002: Indexes
CREATE INDEX idx_quiz_attempts_kid_date ON quiz_attempts (kid_id, created_at DESC);
CREATE INDEX idx_chore_events_kid_period ON chore_events (kid_id, reset_period, created_at DESC);
CREATE INDEX idx_book_progress_kid_book ON book_progress (kid_id, book_id);
CREATE INDEX idx_fallback_questions_module ON fallback_questions (module_id);
CREATE INDEX idx_reading_checkpoints_progress ON reading_checkpoints (progress_id);
CREATE INDEX idx_reward_redemptions_kid_date ON reward_redemptions (kid_id, redeemed_at DESC);
CREATE INDEX idx_calendar_events_family_start ON calendar_events (family_id, start_time);
CREATE UNIQUE INDEX uq_book_progress_kid_book ON book_progress (kid_id, book_id);
CREATE UNIQUE INDEX ux_chore_events_active ON chore_events (chore_id, kid_id, reset_period) WHERE status NOT IN ('approved','rejected');
