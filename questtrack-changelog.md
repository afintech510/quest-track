# QuestTrack Academy — Changelog

## Spec v1 → v2 (July 6, 2026)

**Review Cycle 1:** 12 reviewers (ADVOCATE ×4, FOUNDATION ×4, BRIDGE ×3, GUARDIAN ×3) across Grok 4, GPT-5.5, Gemini 1.5 Pro, Sonnet 5. 155 raw findings → 35 merged → 31 approved (5 modified), 1 rejected, 1 partial, 2 subsumed.

**Finding ID renumbering:** SOW-cycle REV-XXX references purged from spec body text. Cycle 1 findings renumbered to C1-001 through C1-035. All inline spec references now use C1-XXX prefix.

---

### CRITICAL Changes (7)

| C1-ID | Change Summary |
|-------|----------------|
| C1-001 | **Replaced generic `award_currency` RPC with 3 purpose-specific RPCs:** `complete_chore`, `submit_quiz`, `redeem_reward`. All look up amounts server-side — client never passes coin/xp values. Added `daily_xp_earned` column on kids table, enforced in every RPC. Added `CHECK (coins >= 0)`, `CHECK (xp >= 0)`. Fixed double-count return bug. Fixed non-atomic level-up with re-SELECT pattern. Added `processed_mutations` table + `mutation_id` on all RPCs for idempotency. |
| C1-002 | **Defined Trust Model A (single-tenant, no Supabase Auth).** `USING (true)` RLS for reads. All parent-privileged writes routed through Edge Functions with PIN session token verification. Added §3 "Security & Trust Model" section with explicit threat model, PIN session token flow (30-min expiry), and actual `CREATE POLICY` statements for every table. All 16 parent-write Edge Functions listed. |
| C1-003 | **Hid sensitive columns from client.** Created `families_safe` view excluding `pin_hash`, `pin_attempts`, `pin_locked_until`. Changed `soft_lock_sequence` to `soft_lock_hash` (SHA-256 client-side before storage). |
| C1-004 | **Added unique constraint preventing duplicate chore completions.** `CREATE UNIQUE INDEX ux_chore_events_active ON chore_events (kid_id, chore_id, period_date) WHERE status IN ('completed','pending_approval')`. Added `mutation_id` column to `chore_events` and `quiz_attempts`. Created `processed_mutations` table for server-side dedup. |
| C1-005 | **Added empty states and first-visit hints.** New `onboarding/` component directory with `FirstVisitHints`, `EmptyQuestBoard`, `EmptyBookLibrary`, `EmptyCalendar`, `EmptyApprovalQueue`. One starter book seeded per kid. Family setup wizard rejected (single-family build with developer-owned migrations). |
| C1-006 | **Resolved TV text-input contradiction.** All checkpoint and quiz questions are MC-only on TV. Open-response and reflection_text scoped to mobile/web only. AI prompt spec gains `device_type` parameter. `reflection_text` made nullable on `book_progress`. BookReflection component marked mobile/web only. |
| C1-007 | **Canonicalized fallback_questions.** Added `fallback_questions` table to ER diagram with columns (module_id, question, options, correct_index, explanation, standard_code). Server-side query is Tier-1 fallback. Client-bundled JSON demoted to Tier-2 (Supabase unreachable). Added `app_version` table to schema. |

### HIGH Changes (15)

| C1-ID | Change Summary |
|-------|----------------|
| C1-008 | **Atomic cron/catch-up coordination.** `perform_daily_reset()` RPC with `WHERE last_daily_reset::date < p_target_date RETURNING *` guard. Zero rows = already handled. Multi-day catch-up iterates missed days sequentially. |
| C1-009 | **Soft-lock setup flow.** New `SoftLockSetup.jsx` component for first-use per kid (parent-assisted). Visual feedback during entry. "Forgot?" → parent PIN reset. Sibling uniqueness check. |
| C1-010 | **TV calendar simplified.** TV defaults to week-list/agenda view. "Today" jump, Left/Right header paging. Full month grid reserved for mobile/tablet. |
| C1-011 | **Removed Service Worker dependency.** Plain `fetch()` to `app_version` table on mount/visibilitychange. Capgo OTA deferred to backlog. |
| C1-012 | **Quiz JSONB retention policy.** Slim to `{standard_code, is_correct, selected_index}` after 30 days via pg_cron. Full payloads kept 30 days for parent spot-checking. JSONB schemas documented in migration comments. |
| C1-013 | **Progressive ramp formalized.** Trigger: ≥80% approved completion over rolling 7 days via `weekly_completion_rate` Postgres view. Surface: parent mobile/web admin only. `ProgressiveRamp.jsx` moved from `components/quests/` to `components/admin/`. |
| C1-014 | **Book assignment lifecycle completed.** Unique constraint on `book_progress(kid_id, book_id)`. BookAssigner workflow with auto-suggest-next on completion. "Currently Reading" shelf prominent. TV toast on new assignment. Starter book seeded per kid. |
| C1-015 | **REJECTED — TV-only lockout.** Documented as accepted limitation in risk register. No emergency TV text entry or manual mode toggle. |
| C1-016 | **DST-safe cron.** Changed from midnight UTC-4 to hourly cron. Edge Function checks `now() AT TIME ZONE 'America/New_York'` before executing. |
| C1-017 | **Offline Early Bird disabled.** No offline fallback for multiplier. Early Bird determination folded into `submit_quiz` RPC (server-side only). Scoped to first-completion-per-lesson-per-day. Separate `validate-time` endpoint eliminated. |
| C1-018 | **Added 8 indexes in initial migration.** Performance indexes on chore_events, quiz_attempts, book_progress, calendar_events, reward_redemptions, reading_checkpoints, fallback_questions. |
| C1-019 | **Subsumed into C1-001.** `redeem_reward` RPC with balance check, daily limit, atomic deduction, `CHECK (coins >= 0)` backstop. |
| C1-020 | **Auto-approve as configurable family setting.** `auto_approve_hours` column on families (default 48, 0=disabled). `perform_daily_reset()` handles auto-approval. |
| C1-021 | **ChoreBuilder + RewardBuilder pulled into Phase 2.** Previously Phase 6 — now available for Phase 2 testing. Mobile-only, minimal CRUD. |
| C1-022 | **calendar_events.assignee → kid_id FK.** Text enum replaced with nullable `uuid REFERENCES kids(id)` (null = family-wide). Added `fallback_video_id` to lessons table. |

### MEDIUM Changes (10)

| C1-ID | Change Summary |
|-------|----------------|
| C1-023 | **Soft deletes on admin-managed entities.** `deleted_at` column on chore_definitions, lessons, rewards. ON DELETE RESTRICT on all FKs. Active queries filter `WHERE deleted_at IS NULL`. |
| C1-024 | **RRULE expansion bounded.** Expand only `[view_start, view_end]`. Memoize per event/range. Pin rrule.js version. |
| C1-025 | **CHECK constraints instead of ENUMs.** Text columns with CHECK constraints on all status/category fields. Easier to alter for grade expansion than Postgres ENUM types. |
| C1-026 | **AI prompt requirements specified.** New section in §4.2: 3rd grade reading level, growth-mindset tone, max explanation 2 sentences, prohibited language list. Cancel/back button added to "Summoning Quiz..." loading screen. |
| C1-027 | **Claw-back explanation toast.** On kid's next login after chore rejection: "[Chore] wasn't approved — ask a parent why!" Never silent balance decrease. |
| C1-028 | **Quiz request deduplication.** Client-side in-flight ref guard. mutation_id idempotency key to Edge Function. Client AbortController at 6-7s (wrapping full round trip, not just Anthropic's 4s). |
| C1-029 | **Observability additions.** StaleResetBanner for parents (>26h). ConnectionIndicator in HeroStatsHUD (online/offline/syncing). Actionable toast copy. |
| C1-030 | **Analytics resolved as Postgres views.** `kid_analytics` and `weekly_completion_rate` views defined in schema. "Or Edge Functions" ambiguity removed. quiz_attempts added to real-time subscription list. |
| C1-031 | **Phase 7 operational deliverables restored.** Data retention policy + pg_dump backup procedure added back to Phase 7 deliverables (dropped between SOW and spec v1). |
| C1-032 | **Hold-to-confirm visual + YouTube autoplay.** PurchaseProgressIndicator fills during 2s hold. `setMediaPlaybackRequiresUserGesture(false)` in Capacitor config. |

### LOW Changes (3)

| C1-ID | Change Summary |
|-------|----------------|
| C1-033 | **PARTIAL — standard_codes → text[].** `modules.standard_codes` changed to `text[]`. `grade_level → int[]` deferred to v2 (F-050 concern). |
| C1-034 | **Subsumed into C1-008.** Multi-day catch-up: sequential per-day iteration from last_daily_reset. |
| C1-035 | **Traceability gaps fixed.** BookReflection.jsx mapped to F-010/011. fallback_questions and app_version added to traceability matrix. All C1 findings mapped back. |

### Structural Changes

- **New §3: Security & Trust Model** — Entire new section replacing the brief §7.2 auth model. Includes threat model, RLS policy listing, PIN session token flow, data protection.
- **New §2.2: Indexes** — Dedicated subsection for all performance indexes.
- **New §2.3: Constraints Summary** — All CHECK constraints in one place.
- **New §2.4: Purpose-Specific RPCs** — Full SQL for complete_chore, submit_quiz, redeem_reward, perform_daily_reset.
- **New §2.5: Analytics Views** — kid_analytics and weekly_completion_rate CREATE VIEW statements.
- **New §2.6: Data Retention** — pg_cron JSONB slimming job.
- **New onboarding/ component directory** — Empty states and first-visit hints.
- **ProgressiveRamp.jsx moved** from `components/quests/` to `components/admin/`.
- **Finding IDs renumbered** from REV-XXX to C1-XXX to avoid collision with SOW-cycle references.
- **Phase 2 expanded** to include ChoreBuilder + RewardBuilder (formerly Phase 6).
- **Phase 7 expanded** with data retention, backup, and pg_cron operational deliverables.

---

## Pipeline Status

| Milestone | Date | Status |
|-----------|------|--------|
| SOW v2.0 confirmed | July 6, 2026 | ✅ |
| Spec v1 complete | July 6, 2026 | ✅ |
| Review Cycle 1 (12 reviewers) | July 6, 2026 | ✅ |
| Synthesis v1 decisions | July 6, 2026 | ✅ |
| Spec v2 produced | July 6, 2026 | ✅ |
| Review Cycle 2 (focused: RPC/RLS) | — | ⬜ Recommended but deferred |
| Spec LOCKED | July 6, 2026 | ✅ (pending C2 at discretion) |
| Build plan + operator prompts | — | 🔨 In progress |
