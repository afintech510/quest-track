-- Migration 010: Fix kid_analytics — add avg quiz score and 7-day chore count

CREATE OR REPLACE VIEW kid_analytics AS
SELECT
  k.id AS kid_id,
  k.name,
  k.xp,
  k.coins,
  k.level,
  k.streak_days,
  k.reading_streak,
  (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.kid_id = k.id) AS total_quizzes,
  (SELECT COALESCE(ROUND(AVG(qa.score::numeric / NULLIF(qa.total, 0)) * 100), 0) FROM quiz_attempts qa WHERE qa.kid_id = k.id) AS avg_quiz_pct,
  (SELECT COUNT(*) FROM book_progress bp WHERE bp.kid_id = k.id AND bp.status = 'completed') AS books_completed,
  (SELECT COUNT(*) FROM chore_events ce WHERE ce.kid_id = k.id AND ce.status = 'approved') AS chores_approved,
  (SELECT COUNT(*) FROM chore_events ce WHERE ce.kid_id = k.id AND ce.status = 'approved' AND ce.created_at > NOW() - INTERVAL '7 days') AS chores_7d
FROM kids k;
