-- Migration 005: Row Level Security
-- RLS enabled on all 17 tables
-- anon role gets SELECT-only access on all tables
-- Applied to Supabase remote via MCP

-- Pattern applied to each table:
-- ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anon_select_<table>" ON <table> FOR SELECT TO anon USING (true);
