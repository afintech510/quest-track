-- Migration 006: Views
-- Applied to Supabase remote via MCP

CREATE OR REPLACE VIEW families_safe AS
SELECT id, name, timezone, created_at
FROM families;

CREATE OR REPLACE VIEW kid_analytics AS
SELECT
  k.id AS kid_id,
  k.name,
  k.xp,
  k.coins,
  k.level,
  k.streak_days,
  (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.kid_id = k.id) AS total_quizzes,
  (SELECT COUNT(*) FROM book_progress bp WHERE bp.kid_id = k.id AND bp.status = 'completed') AS books_completed,
  (SELECT COUNT(*) FROM chore_events ce WHERE ce.kid_id = k.id AND ce.status = 'approved') AS chores_approved
FROM kids k;

CREATE OR REPLACE VIEW weekly_completion_rate AS
SELECT
  k.id AS kid_id,
  k.name,
  COUNT(ce.id) FILTER (WHERE ce.status = 'approved') AS completed,
  COUNT(ce.id) AS total,
  CASE WHEN COUNT(ce.id) > 0
    THEN ROUND(100.0 * COUNT(ce.id) FILTER (WHERE ce.status = 'approved') / COUNT(ce.id), 1)
    ELSE 0
  END AS completion_pct
FROM kids k
LEFT JOIN chore_events ce ON ce.kid_id = k.id
  AND ce.created_at >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY k.id, k.name;
