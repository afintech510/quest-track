# Review Synthesis: QuestTrack Academy Spec v1 — Cycle 1 DECISIONS

**Spec Version Reviewed:** v1
**SOW Reference:** questtrack-academy-sow-v2.md
**Decision Date:** July 6, 2026
**Decision Basis:** Each finding validated against SOW v2 scope (single-family personal build, Supabase free tier, no Supabase Auth, TV = no text input, phones confirmed as primary admin devices per Adam/Allie personas) and Spec v1 source text.

**Tally: 31 APPROVE (5 modified), 1 REJECT, 1 PARTIAL (half deferred to v2), 2 subsumed into other approvals.**

---

## Pre-Decision Note: REV Numbering Collision

Spec v1 internally cites `REV-001`–`REV-033` from the **SOW review cycle** (e.g., spec's "REV-001 — Normalized schema"). This synthesis reuses the same `REV-` prefix with entirely different meanings. **Action for v2:** renumber this cycle's findings to `C1-001`–`C1-035` in the changelog, and strip the stale SOW-cycle REV references from spec v2 body text (they've served their purpose). Prevents ambiguity when build-prompter consumes the locked spec.

---

## CRITICAL Findings

| ID | Title | Decision | Rationale |
|----|-------|----------|-----------|
| REV-001 | award_currency RPC: payload bug, no bounds, no daily cap | ✅ **APPROVE** | Verified in spec §2.2: `RETURNING * INTO v_kid` captures the post-update row, then the return adds `p_coins` again — double-count confirmed. Level-up second UPDATE re-reads `xp` non-atomically. All 12 reviewers converged. Replace with purpose-specific RPCs (`complete_chore`, `submit_quiz`, `redeem_reward`) that look up amounts server-side; enforce daily XP cap in `daily_xp_earned` column; single transaction with `SELECT FOR UPDATE`; `CHECK (coins >= 0)`. This is the economy backbone and the kids are the threat model. |
| REV-002 | auth_context() undefined — RLS unimplementable | ✅ **APPROVE — Option A** | Spec §2.2 references `auth_context()` which cannot exist; SOW §6 constraint is explicit: "No Supabase Auth for v1." Choose **(a) single-tenant trust model**: `USING (true)` read RLS, all parent-privileged writes routed through Edge Functions that verify a short-lived PIN session token server-side. Option (b) custom JWT is over-engineering for one family on sideloaded devices. Spec v2 must include actual `CREATE POLICY` statements for every table and a written trust-model section. |
| REV-003 | PIN hash + soft-lock sequence exposed to clients | ✅ **APPROVE** | `families.pin_hash` readable under "kids read all family data" (spec §7.2) defeats the bcrypt + rate-limit design entirely — offline brute force of a 4-digit keyspace is trivial. Revoke SELECT on `pin_hash/pin_attempts/pin_locked_until`; expose `families` via a view. Soft-lock: SHA-256 client-side before storage is sufficient — SOW risk table already frames it as "not high security, prevents casual interference." No Edge Function needed for soft-lock. |
| REV-004 | No unique constraint on chore_events — offline replay farms coins | ✅ **APPROVE** | Same oversell-guarantee pattern as HTE's UNIQUE(day,slot) and Eastern Rentals' daterange exclusion. Partial unique index on `(kid_id, chore_id, period_date) WHERE status IN ('completed','pending_approval')`, client `mutation_id` UUIDs, `processed_mutations` dedup table, graceful `ON CONFLICT`. The offline mutation queue (spec §4.2) is unusable without idempotency. |
| REV-005 | First-run onboarding / empty states missing | ✅ **APPROVE — MODIFIED** | **Reject the family setup wizard** — single-family build; spec §2.3 seed data already creates the family, both kids, starter chores, rewards, and modules, and Adam runs the migrations himself. **Approve** the rest: explicit empty-state components for every list view (EmptyQuestBoard, EmptyBookLibrary, EmptyCalendar, EmptyApprovalQueue), one starter book seeded per kid, and a lightweight first-visit navigation hint on TV. Empty states still occur post-seed (all books finished, no calendar events this week). |
| REV-006 | Open-response text on TV contradicts no-input constraint | ✅ **APPROVE** | Undeniable: F-011 specifies "prediction (open-response)" and `book_progress.reflection_text`, while SOW §6 forbids any `<input>` that triggers TV keyboards. All checkpoint questions MC-only on TV; open-response and reflections scoped to mobile/web; AI prompt spec gains device-aware question-type parameter. Reflections become optional (kid can complete a book on TV, add reflection later on tablet). |
| REV-007 | fallback_questions: 3 contradictory descriptions, missing from schema | ✅ **APPROVE** | Confirmed: traceability matrix and generate-quiz Edge Function reference a `fallback_questions` table absent from the ER diagram, while `data/fallbackQuizBank.json` sits in the component tree. Canonical: Supabase `fallback_questions` table queried server-side on timeout. Client-bundled JSON demoted to tier-2 (Supabase itself unreachable). Add `app_version` table (referenced in §5.4, also missing) to schema. |

---

## HIGH Findings

| ID | Title | Decision | Rationale |
|----|-------|----------|-----------|
| REV-008 | Cron vs catch-up reset race | ✅ **APPROVE** | Both paths call one `perform_daily_reset()` with the atomic `WHERE last_daily_reset < CURRENT_DATE RETURNING *` guard. Cheap, correct, closes REV-034 too. |
| REV-009 | Soft-lock setup/recovery unspecified | ✅ **APPROVE** | Kids must set sequences somehow; "Forgot?" → parent PIN reset; sibling-uniqueness check. Phase 1 acceptance criteria updated. |
| REV-010 | Calendar month grid unusable on D-pad | ✅ **APPROVE** | TV defaults to week-list/agenda with "Today" jump and Left/Right paging; full month grid mobile-only. Satisfies O-004 without fighting a 42-cell focus grid. |
| REV-011 | Service Workers unsupported in TV WebView | ✅ **APPROVE — MODIFIED** | Plain `fetch()` version check against `app_version` on mount/visibilitychange: approved. **Capgo OTA: deferred** — SOW §1.3 already accepts APK re-sideload for major versions, it's one TV, and Adam controls the toolchain. Don't add an OTA dependency to a family app. |
| REV-012 | quiz_attempts JSONB bloat | ✅ **APPROVE** | Note: raw bloat math doesn't actually threaten 500MB for a family of 4, but the recommendation as written is right anyway — and critically, the 30-day full-payload retention window **preserves the SOW §10 assumption** that parents spot-check AI quiz quality via quiz_attempts history. Slim `{standard_code, is_correct, selected_index}` kept forever; full JSONB purged after 30 days via pg_cron. Document JSONB schemas in migrations. |
| REV-013 | Progressive ramp trigger undefined | ✅ **APPROVE** | The trigger isn't actually undefined — SOW F-013c specifies "≥80% weekly completion over 7 days"; the spec just dropped it. Carry into spec v2: `weekly_completion_rate` view, parent mobile/web admin surface only, 3 random suggestions, one-click add. Move ProgressiveRamp.jsx to `components/admin/`. |
| REV-014 | Book assignment lifecycle incomplete | ✅ **APPROVE** | Unique constraint on `book_progress(kid_id, book_id)`, BookAssigner workflow, auto-suggest next book on completion, "Currently Reading" shelf, TV toast on new assignment, starter book seeded (overlaps REV-005). Directly serves O-003 (1 book/month). |
| REV-015 | TV-only households locked out of configuration | ❌ **REJECT (document only)** | Not this household: personas confirm phones/tablets as primary admin devices, and SOW §6 makes "all text-creation on mobile/web" a deliberate constraint, not an oversight. Emergency TV text entry would violate the no-input constraint we just enforced in REV-006. **Approve only** the one-line risk-register entry documenting the accepted limitation, and keep device detection as userAgent + screen-width per spec Phase 6 deliverable 7 — no manual mode toggle needed. |
| REV-016 | DST cron drift (hardcoded UTC-4) | ✅ **APPROVE** | Real bug — spec §3.2 says "midnight UTC-4," wrong November–March. Hourly cron; Edge Function checks `now() AT TIME ZONE 'America/New_York'` before executing. |
| REV-017 | Offline Early Bird clock exploit | ✅ **APPROVE** | This consciously overrides a SOW-accepted risk (F-016 "falls back to local clock only when offline") — override justified: changing the TV clock is exactly the exploit an 8-year-old discovers, and the fix *simplifies* the design by deleting the separate `validate-time` endpoint. Early Bird determination folds into the `submit_quiz` RPC (REV-001), scoped to first-completion-per-lesson-per-day. Offline quizzes earn base rewards, no multiplier — clean rule, easy to explain to Cora. |
| REV-018 | Missing indexes | ✅ **APPROVE** | All six indexes into the initial migration. Trivial. |
| REV-019 | Reward redemption not atomic | ✅ **APPROVE** | Subsumed by REV-001's purpose-specific RPC architecture — `redeem_reward(p_kid_id, p_reward_id)` with max_per_day check, coins check, atomic decrement, `CHECK (coins >= 0)` backstop. |
| REV-020 | Parent approval bottleneck | ✅ **APPROVE — MODIFIED** | 48-hour auto-approve cron, but as a **configurable family setting (default ON, 48h)** rather than hardcoded — this is a parenting-policy knob, not an engineering constant. Pairs with the existing daily notification email and the personas' "approve-all option" pain point. |
| REV-021 | Admin CRUD in Phase 6 but needed in Phase 2 | ✅ **APPROVE** | Phase 2's milestone is the family actually using the quest board — parents need ChoreBuilder/RewardBuilder (mobile-only, minimal) then, not four phases later. Pull into Phase 2; PIN gate arrives in Phase 6, interim access via the trusted-device model documented in REV-002. Update traceability matrix. |
| REV-022 | calendar_events.assignee text enum → FK | ✅ **APPROVE** | Nullable `kid_id uuid REFERENCES kids(id)` (null = family-wide). Also approve `fallback_video_id` on lessons — SOW §11 risk table already commits to "maintain fallback video IDs per module" and the spec has nowhere to put them. |

---

## MEDIUM Findings

| ID | Title | Decision | Rationale |
|----|-------|----------|-----------|
| REV-023 | FK cascade / soft deletes | ✅ **APPROVE** | `deleted_at` on chore_definitions, lessons, rewards; ON DELETE RESTRICT. SOW F-014 promises chore_events history is "never lost" — hard deletes on definitions would orphan it. |
| REV-024 | RRULE expansion unbounded | ✅ **APPROVE** | SOW §11 already says "limit expansion window" — spec must make it concrete: expand only `[view_start, view_end]`, memoize, pin rrule.js version. |
| REV-025 | Status ENUMs / CHECK constraints | ✅ **APPROVE — MODIFIED** | Constraints yes, but prefer **text + CHECK constraints over Postgres ENUM types** — CHECKs are painless to alter when 4th-grade expansion (F-050) adds categories; ENUMs require type migrations. Keep `CHECK (coins >= 0)`, `CHECK (xp >= 0)` on kids. |
| REV-026 | Quiz prompt tone underspecified | ✅ **APPROVE** | Direct persona traceability — Cora's profile explicitly requires encouraging, never-punitive feedback. Spec v2 gets an AI prompt-requirements section: reading level, growth-mindset tone, max explanation length, prohibited language. Add cancel/back from "Summoning Quiz..." |
| REV-027 | Claw-back has no kid-facing explanation | ✅ **APPROVE** | Toast on next login naming the chore and prompting "ask a parent why." Silent balance drops teach kids the economy is arbitrary — kills O-002. |
| REV-028 | Quiz request dedup | ✅ **APPROVE** | In-flight ref guard, idempotency key, client AbortController at 6–7s wrapping the full round trip (the 4s server timeout alone doesn't cover network transit). |
| REV-029 | Observability gaps | ✅ **APPROVE** | Stale-reset banner (>26h), pending-sync indicators, actionable toast copy, connection indicator in HeroStatsHUD. Modest scope, high debugging value for a TV app Adam can't attach devtools to easily. |
| REV-030 | Analytics: views vs Edge Functions | ✅ **APPROVE** | Postgres views, full stop — free tier has an Edge Function invocation budget and views are simpler. `CREATE VIEW kid_analytics` in schema; quiz_attempts added to real-time subscription list; ambiguity removed. |
| REV-031 | SOW Phase 7 backup/retention dropped from spec | ✅ **APPROVE** | Straight traceability restore — SOW Phase 7 lines commit to a documented retention policy and pg_dump procedure; spec v2 Phase 7 gets them back. |
| REV-032 | Hold-to-confirm indicator + YouTube autoplay | ✅ **APPROVE** | PurchaseProgressIndicator fill during hold (2s of nothing reads as broken on TV). `setMediaPlaybackRequiresUserGesture(false)` in Capacitor config — real WebView gotcha that would break F-008's custom play button. |

---

## LOW Findings

| ID | Title | Decision | Rationale |
|----|-------|----------|-----------|
| REV-033 | grade_level → int[], standard_codes → text[] | ⚠️ **PARTIAL** | **Approve** `modules.standard_codes` → `text[]` (it's genuinely a list, cheap now). **Defer** `grade_level` → `int[]` to v2 — O-008 ("add new grade levels without code changes") is fully satisfied by inserting new rows with `grade_level = 4`; cross-grade modules are an F-050 concern. Logged to backlog. |
| REV-034 | Multi-day catch-up underspecified | ✅ **APPROVE** | Subsumed into REV-008's solution — sequential per-day iteration from last_reset. |
| REV-035 | Traceability matrix gaps | ✅ **APPROVE** | BookReflection.jsx into F-010/011 row; map all approved cycle-1 findings back into the matrix; add fallback_questions and app_version tables to matrix rows. |

---

## Deferred Backlog (carried to v2 planning)

| Item | Source | Trigger |
|------|--------|---------|
| Capgo OTA updates | REV-011 | If APK re-sideloads become frequent enough to annoy |
| grade_level int[] for cross-grade modules | REV-033 | F-050 4th Grade Bridge |

## Rejected Log (audit trail)

| Item | Source | Reasoning |
|------|--------|-----------|
| Family setup wizard | REV-005 | Single-family build; seed migrations owned by developer; empty states approved instead |
| Emergency TV-side text entry + manual mode toggle | REV-015 | Household has confirmed mobile admin devices; TV text entry violates SOW no-input constraint reaffirmed by REV-006; documented as accepted limitation in risk register |

---

## Next Steps

1. **Apply approved changes → Spec v2** with changelog (v1 → v2 diff summary), renumbering this cycle's findings to `C1-XXX` and purging stale SOW-cycle REV references from spec body text.
2. **Re-review recommended:** 7 CRITICALs and 15 HIGHs incorporated is well past the re-review threshold. Cycle 2 should focus reviewers on the rewritten RPC/RLS/trust-model sections (REV-001/002/003/004) since that's where the surgery happened.
3. After Cycle 2 returns LOW/MEDIUM-only (or explicit lock), hand off to **build-prompter**.
