-- Migration 007: Cron Jobs
-- slim_quiz_jsonb function created
-- pg_cron schedule deferred to production (requires extension enabled in dashboard)

CREATE OR REPLACE FUNCTION slim_quiz_jsonb() RETURNS void AS $$
BEGIN
  UPDATE quiz_attempts
  SET questions = '[]'::jsonb
  WHERE created_at < now() - INTERVAL '90 days'
  AND questions != '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- To enable in production:
-- SELECT cron.schedule('slim-quiz-jsonb', '0 3 * * 0', 'SELECT slim_quiz_jsonb()');
