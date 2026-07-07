# Phase 01: Schema & DB Foundation
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 00 (Environment Setup)
**Implements:** Full database layer (infrastructure — all phases depend on this)
**Recommended:** `claude --max-turns 75`

---

## 1. Context

You are executing **Phase 01: Schema & DB Foundation** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the complete database layer — all tables, indexes, constraints, RPCs, RLS policies, views, and seed data. No frontend code, no Edge Functions, no UI components.

**⚠️ CRITICAL PHASE:** Every subsequent phase reads from and writes to this schema. Errors here cascade into 8 downstream phases. The spec review cycle identified the data layer as the weakest area (11 findings). Take extra care with RPCs and constraints.

**Tech Stack:** Supabase PostgreSQL (free tier), Supabase CLI for migrations
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE FIRST. Sections 2.1 through 2.9, 3.2, and 2.4-2.6 are your primary references.

### What Already Exists
Phase 00 created:
- Vite + React + Tailwind project scaffold
- Supabase CLI initialized (`supabase/` directory)
- All npm dependencies installed
- `.env` with Supabase project URL and anon key (verify these are populated)
- Directory structure with placeholder components

### What You're Building
The complete Supabase database layer: 17 tables, 9+ indexes, CHECK constraints on all status columns, 4 SECURITY DEFINER RPCs for the coin/XP economy, RLS policies on every table, 3 Postgres views, a pg_cron job definition, and full seed data for the family. After this phase, you can query any table and call any RPC — the data foundation is complete.

---

## 2. Objective & Deliverables

### Objective
All database objects exist and are verified. RPCs handle the coin/XP economy atomically with idempotency. RLS prevents direct writes to economy tables. Seed data populates the family, kids, curriculum, books, and chore bank.

### Deliverables
1. **Migration 001:** All 17 tables with columns, types, FKs — Spec §2.1
2. **Migration 002:** All indexes — Spec §2.2
3. **Migration 003:** All CHECK constraints — Spec §2.3
4. **Migration 004:** RPC functions (complete_chore, submit_quiz, redeem_reward, perform_daily_reset) — Spec §2.4
5. **Migration 005:** RLS policies on all tables — Spec §3.2
6. **Migration 006:** Views (families_safe, kid_analytics, weekly_completion_rate) — Spec §2.5
7. **Migration 007:** pg_cron job for quiz JSONB slimming — Spec §2.6
8. **Seed data script:** Family, kids, modules, lessons, books, chore bank, fallback questions, rewards — Spec §2.8

---

## 3. Implementation Instructions

### Task 1: Create Base Tables Migration
**Spec Reference:** §2.1 (ER Diagram)
**Creates:** `supabase/migrations/001_base_tables.sql`

Create ALL 17 tables in one migration, in FK-dependency order:

1. `families` — root table
2. `kids` — FK to families
3. `chore_definitions` — FK to families
4. `chore_events` — FK to kids, chore_definitions
5. `modules` — standalone
6. `lessons` — FK to modules
7. `quiz_attempts` — FK to kids, lessons
8. `fallback_questions` — FK to modules
9. `app_version` — standalone
10. `books` — standalone
11. `book_progress` — FK to kids, books
12. `reading_checkpoints` — FK to book_progress
13. `calendar_events` — FK to families, kids (nullable)
14. `rewards` — FK to families
15. `reward_redemptions` — FK to kids, rewards
16. `system_state` — FK to families
17. `processed_mutations` — standalone (idempotency table)

**CRITICAL — Match spec §2.1 exactly:** Every column name, type, and nullable status must match the ER diagram. Key columns to watch:

- `kids.soft_lock_hash` — text, NOT `soft_lock_sequence` (C1-003: SHA-256 hash, not plaintext)
- `kids.daily_xp_earned` — int, default 0 (C1-001: server-side daily XP cap)
- `families.auto_approve_hours` — int, default 48 (C1-020: configurable auto-approve)
- `chore_events.mutation_id` — uuid (C1-004: idempotency key)
- `quiz_attempts.mutation_id` — uuid (C1-004: idempotency key)
- `modules.standard_codes` — text[] (C1-033: array, not text)
- `lessons.fallback_video_id` — text, nullable (C1-022: backup YouTube ID)
- `calendar_events.kid_id` — uuid FK to kids, nullable (C1-022: null = family-wide, NOT text enum)
- `chore_definitions.deleted_at` — timestamptz, nullable (C1-023: soft delete)
- `lessons.deleted_at` — timestamptz, nullable (C1-023: soft delete)
- `rewards.deleted_at` — timestamptz, nullable (C1-023: soft delete)
- `book_progress.reflection_text` — text, nullable (C1-006: mobile/web only)

All FKs use `ON DELETE RESTRICT` (C1-023).

All UUID primary keys: use `uuid DEFAULT gen_random_uuid()`.

All `created_at` columns: `timestamptz DEFAULT now()`.

### Task 2: Create Indexes Migration
**Spec Reference:** §2.2
**Creates:** `supabase/migrations/002_indexes.sql`

Create all 9 indexes exactly as specified in §2.2:

```sql
-- Performance indexes
CREATE INDEX idx_chore_events_kid_period ON chore_events (kid_id, period_date, status);
CREATE INDEX idx_quiz_attempts_kid_date ON quiz_attempts (kid_id, completed_at);
CREATE INDEX idx_book_progress_kid_book ON book_progress (kid_id, book_id);
CREATE INDEX idx_calendar_events_family_start ON calendar_events (family_id, event_start);
CREATE INDEX idx_reward_redemptions_kid_date ON reward_redemptions (kid_id, redeemed_at);
CREATE INDEX idx_reading_checkpoints_progress ON reading_checkpoints (book_progress_id);
CREATE INDEX idx_fallback_questions_module ON fallback_questions (module_id);

-- C1-004: Partial unique index — prevents duplicate active chore completions
CREATE UNIQUE INDEX ux_chore_events_active
    ON chore_events (kid_id, chore_id, period_date)
    WHERE status IN ('completed', 'pending_approval');
```

Also add:
```sql
-- Unique book assignment per kid (C1-014)
ALTER TABLE book_progress ADD CONSTRAINT uq_book_progress_kid_book UNIQUE (kid_id, book_id);
```

### Task 3: Create CHECK Constraints Migration
**Spec Reference:** §2.3
**Creates:** `supabase/migrations/003_constraints.sql`

Add ALL CHECK constraints from §2.3. Key ones:

```sql
ALTER TABLE kids ADD CONSTRAINT chk_coins_nonneg CHECK (coins >= 0);
ALTER TABLE kids ADD CONSTRAINT chk_xp_nonneg CHECK (xp >= 0);
ALTER TABLE kids ADD CONSTRAINT chk_daily_xp_nonneg CHECK (daily_xp_earned >= 0);
```

Plus status/category CHECKs on: chore_definitions.frequency, chore_events.status, modules.subject, lessons.video_type, quiz_attempts.difficulty_tier, book_progress.status, books.tier, calendar_events.category.

### Task 4: Create RPC Functions Migration
**Spec Reference:** §2.4
**Creates:** `supabase/migrations/004_rpc_functions.sql`

**⚠️ CAUTION:** These RPCs are the economy backbone. The review cycle found the original `award_currency` had a double-count return bug, race condition on level-up, and no daily cap enforcement. The spec §2.4 provides corrected SQL — implement it exactly.

Create all 4 functions as `SECURITY DEFINER`:
1. `complete_chore(p_chore_event_id uuid, p_mutation_id uuid)` — spec §2.4
2. `submit_quiz(p_kid_id uuid, p_lesson_id uuid, p_answers jsonb, p_questions jsonb, p_score int, p_max_score int, p_difficulty_tier text, p_mutation_id uuid)` — spec §2.4
3. `redeem_reward(p_kid_id uuid, p_reward_id uuid, p_mutation_id uuid)` — spec §2.4
4. `perform_daily_reset(p_family_id uuid, p_target_date date)` — spec §2.4

Each RPC must:
- Check `processed_mutations` for idempotency FIRST
- Use `SELECT ... FOR UPDATE` to lock rows
- Insert into `processed_mutations` on success
- Re-SELECT final state for accurate return values (don't return stale pre-update values)
- Return JSON with status field

### Task 5: Create RLS Policies Migration
**Spec Reference:** §3.2
**Creates:** `supabase/migrations/005_rls_policies.sql`

Enable RLS on ALL tables. Create `anon_read` SELECT policy with `USING (true)` on every table.

**⚠️ CRITICAL (C1-002):** Do NOT create INSERT/UPDATE/DELETE policies for the anon role on economy tables. All writes go through SECURITY DEFINER RPCs or Edge Functions with service_role key. The anon role can only READ.

For tables where kids need direct writes (none in this architecture — all writes are via RPCs or Edge Functions), document why.

### Task 6: Create Views Migration
**Spec Reference:** §2.5, §3.2
**Creates:** `supabase/migrations/006_views.sql`

Create:
1. `families_safe` — SELECT excluding pin_hash, pin_attempts, pin_locked_until (C1-003)
2. `kid_analytics` — Per-kid metrics for parent dashboard (C1-030)
3. `weekly_completion_rate` — Rolling 7-day completion % for progressive ramp (C1-013)

Match the SQL exactly from spec §2.5. The views query across multiple tables — verify the JOINs are correct.

### Task 7: Create pg_cron Job Definition
**Spec Reference:** §2.6
**Creates:** `supabase/migrations/007_cron_jobs.sql`

Create the quiz JSONB slimming cron job from spec §2.6. Note: pg_cron may not be available on Supabase free tier — if so, document this as a Phase 09 manual task and create the function but not the schedule:

```sql
-- Function that can be called manually or via cron
CREATE OR REPLACE FUNCTION slim_quiz_jsonb() RETURNS void AS $$
BEGIN
    UPDATE quiz_attempts
    SET questions = (
        SELECT jsonb_agg(jsonb_build_object(
            'standard_code', q->>'standard_code',
            'is_correct', (q->>'is_correct')::boolean,
            'selected_index', (q->>'selected_index')::int
        ))
        FROM jsonb_array_elements(questions) AS q
    ),
    answers = NULL
    WHERE completed_at < now() - interval '30 days'
    AND jsonb_array_length(questions) > 0
    AND questions->0 ? 'question';
END;
$$ LANGUAGE plpgsql;
```

### Task 8: Seed Data
**Spec Reference:** §2.8
**Creates:** `supabase/seed.sql`

Seed in FK-dependency order:

1. **Family:** One record with family_name='Larkin', pin_hash=bcrypt('1234'), auto_approve_hours=48, force_morning_boost=false
2. **Kids:** Quinn (🦁, amber, #f59e0b, level 1, 0 xp, 0 coins, grade 3) and Cora (🦄, purple, #a855f7, level 1, 0 xp, 0 coins, grade 3)
3. **Modules:** 17 modules across math (5), ela (4), science (4), social_studies (4) — use spec content or generate reasonable names. Each with standard_codes array.
4. **Lessons:** 73 lessons distributed across modules. Use placeholder YouTube IDs (e.g., 'dQw4w9WgXcQ') — real IDs come in Phase 09.
5. **Books:** 20 books across 3 tiers with metadata. Chapter summaries can be placeholder JSONB — real content in Phase 09.
6. **Chore bank:** defaultChoreBank.json with ~30 age-appropriate chores
7. **Starter chores:** 3 daily chore_definitions (Make Bed, Brush Teeth, Clean Up Toys), 1 weekly (Vacuum Room)
8. **Starter rewards:** 3 default items (30 Min Screen Time: 50 coins, Choose Dinner: 75 coins, Craft Supplies Trip: 150 coins)
9. **Fallback questions:** ~50 per subject (200 total) in fallback_questions table. Generate reasonable 3rd-grade MC questions.
10. **System state:** One record with all reset timestamps set to now()
11. **Starter book assignments:** 1 book_progress per kid (status='assigned')
12. **App version:** v1.0.0

For bcrypt hash generation in seed SQL, use `crypt('1234', gen_salt('bf'))` which requires the `pgcrypto` extension:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 4. Acceptance Criteria

### Schema Verification
- [ ] All 17 tables exist: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` returns 17+ rows
- [ ] `families` has columns: id, family_name, pin_hash, pin_attempts, pin_locked_until, force_morning_boost, auto_approve_hours, created_at
- [ ] `kids` has `daily_xp_earned` (int), `soft_lock_hash` (text), `coins` with CHECK >= 0, `xp` with CHECK >= 0
- [ ] `chore_events` has `mutation_id` (uuid) column
- [ ] `calendar_events.kid_id` is uuid FK to kids (nullable), NOT a text enum
- [ ] `modules.standard_codes` is text[] (array type)
- [ ] `lessons.fallback_video_id` exists (text, nullable)
- [ ] `chore_definitions.deleted_at`, `lessons.deleted_at`, `rewards.deleted_at` exist (timestamptz, nullable)

### Constraint Verification
- [ ] `UPDATE kids SET coins = -1 WHERE id = '<quinn_id>'` fails with CHECK violation
- [ ] Insert duplicate active chore_event (same kid_id, chore_id, period_date, status='completed') fails with unique violation
- [ ] Insert duplicate book_progress (same kid_id, book_id) fails with unique violation
- [ ] Insert chore_definition with frequency='hourly' fails with CHECK violation

### RPC Verification
- [ ] `SELECT complete_chore('<valid_event_id>', '<new_uuid>')` returns `{"status": "success", ...}`
- [ ] Same call again with same mutation_id returns `{"status": "already_processed"}`
- [ ] `SELECT redeem_reward('<quinn_id>', '<reward_id>', '<new_uuid>')` deducts coins correctly
- [ ] `SELECT redeem_reward(...)` with kid at 0 coins returns `{"status": "insufficient_coins"}`
- [ ] `SELECT perform_daily_reset('<family_id>', CURRENT_DATE)` transitions completed chores
- [ ] Same perform_daily_reset again returns `{"status": "already_reset"}`

### RLS Verification
- [ ] Anon role can SELECT from all tables (test via Supabase client with anon key)
- [ ] Anon role CANNOT directly INSERT into chore_events (RLS blocks)
- [ ] Anon role CANNOT directly UPDATE kids.coins (RLS blocks)
- [ ] RPCs (SECURITY DEFINER) CAN write to all tables (bypass RLS)

### View Verification
- [ ] `SELECT * FROM families_safe` returns family WITHOUT pin_hash, pin_attempts, pin_locked_until
- [ ] `SELECT * FROM kid_analytics` returns rows for both Quinn and Cora
- [ ] `SELECT * FROM weekly_completion_rate` returns rows (may be 0% with fresh seed data)

### Seed Data Verification
- [ ] 2 kids exist (Quinn, Cora) with correct colors and starting stats
- [ ] 17 modules exist across 4 subjects
- [ ] 73 lessons exist with module FKs
- [ ] 20 books exist across 3 tiers
- [ ] ≥180 fallback questions exist across 4 subjects
- [ ] 3 daily + 1 weekly chore definitions exist
- [ ] 3 rewards exist
- [ ] 1 book_progress per kid (status='assigned')

---

## 5. Constraints

### Hard Constraints
- Column names, types, and constraints MUST match spec §2.1 ER diagram exactly
- RPC function signatures MUST match spec §2.4 exactly
- All RPCs MUST be SECURITY DEFINER
- All RPCs MUST check processed_mutations for idempotency
- All RPCs MUST use SELECT FOR UPDATE on rows being modified
- RLS MUST be enabled on ALL tables
- Anon role MUST NOT have INSERT/UPDATE/DELETE on economy tables
- `pgcrypto` extension MUST be enabled (for bcrypt in seed data)

### Soft Constraints
- Migration numbering: 001-007 in order. If you need to combine or reorder, document why.
- Seed data UUIDs: use `gen_random_uuid()` for most. For family_id and kid IDs, consider using fixed UUIDs that can be referenced in `.env` for app config.
- If pg_cron is unavailable on the Supabase free tier, create the slimming function but skip the schedule. Mark with `// DEFERRED: pg_cron schedule — manual or Phase 09`

---

## 6. Completion Protocol

When all acceptance criteria pass, provide this structured report:

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| [migration path] | [what it creates] | [approx lines] |

### Acceptance Criteria Results
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | [criterion] | PASS/FAIL | [SQL used and result] |

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |

### Blocked Items
| Task | Blocker | Required From |

### Key IDs for Downstream Phases
Provide the actual UUIDs from seed data that downstream phases will need:
- Family ID: `________`
- Quinn ID: `________`
- Cora ID: `________`
- Sample Module ID: `________`
- Sample Lesson ID: `________`
- Sample Book ID: `________`

### Warnings for Next Phase
[Any schema decisions, pg_cron status, Supabase tier limitations discovered]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 75`
This phase involves significant SQL. May need one --continue if seed data generation is extensive.

### Task Planning
1. Read spec §2.1 through §2.9 and §3.2 thoroughly
2. Check Supabase project is connected (`supabase status`)
3. Execute Tasks 1-8 in order
4. Run `supabase db push` or `supabase migration up` after each migration
5. Verify acceptance criteria via SQL queries
6. Write completion report with key UUIDs

### Resumption Protocol (--continue)
If resumed:
1. Check which migrations exist in `supabase/migrations/`
2. Check which tables exist in the database
3. Resume from the first incomplete migration
4. Do NOT re-run already-applied migrations

### Progress Tracking
Update `PHASE-01-PROGRESS.md` after each task:
```markdown
# Phase 01 Progress
- [x] Task 1: Base tables (17 tables created)
- [x] Task 2: Indexes (9 indexes created)
- [ ] Task 3: CHECK constraints
...
```
