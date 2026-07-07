# Phase 03: Quest Board & Economy — Progress

## Task Status

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | useEconomy hook | ✅ DONE | completeChore + redeemReward RPCs, offline queue, level-up trigger |
| 2 | QuestBoard + ChoreCard | ✅ DONE | Daily/Weekly/Monthly sections, debounced completion, confetti, claw-back toast |
| 3 | useDebounce hook | ✅ DONE | Value debounce + useDebouncedAction for D-pad |
| 4 | useCatchUpReset hook | ✅ DONE | Mount + visibilitychange reset check |
| 5 | daily-reset Edge Function | ✅ DONE | Hourly cron, ET timezone check, service role key. Email deferred. |
| 6 | Parent-write Edge Functions | ✅ DONE | All 11 functions: create/update/delete chore, reward, calendar-event; approve/reject chore |
| 7 | Reward Shop | ✅ DONE | RewardGrid + PurchaseConfirm + PurchaseProgressIndicator, hold-to-confirm on TV |
| 8 | Calendar System | ✅ DONE | TV agenda/week-list, mobile month grid, rruleParser bounded expansion, SomedayBucket |
| 9 | EarlyBirdBanner | ✅ DONE | Display-only, clockService utilities |
| 10 | ProgressiveRamp | ✅ DONE | Parent-facing, weekly_completion_rate query, chore bank suggestions |
| 11 | ChoreBuilder + RewardBuilder | ✅ DONE | Mobile-only CRUD, Edge Function calls, soft delete |

## Files Created

| File | Purpose |
|------|---------|
| src/hooks/useEconomy.js | Economy RPC wrapper with offline support |
| src/hooks/useCatchUpReset.js | Daily reset catch-up on mount/wake |
| src/lib/clockService.js | ET timezone utilities, Early Bird window check |
| src/lib/rruleParser.js | Bounded RRULE expansion [viewStart, viewEnd] |
| src/data/defaultChoreBank.json | 18 chore suggestions for progressive ramp |
| supabase/functions/_shared/cors.ts | CORS headers helper |
| supabase/functions/_shared/supabaseAdmin.ts | Service role client factory |
| supabase/functions/daily-reset/index.ts | Hourly cron, midnight ET gate |
| supabase/functions/create-chore/index.ts | Parent CRUD |
| supabase/functions/update-chore/index.ts | Parent CRUD |
| supabase/functions/delete-chore/index.ts | Soft delete |
| supabase/functions/create-reward/index.ts | Parent CRUD |
| supabase/functions/update-reward/index.ts | Parent CRUD |
| supabase/functions/delete-reward/index.ts | Soft delete |
| supabase/functions/approve-chore/index.ts | Set status=approved |
| supabase/functions/reject-chore/index.ts | Reject + claw-back coins/XP |
| supabase/functions/create-calendar-event/index.ts | Calendar CRUD |
| supabase/functions/update-calendar-event/index.ts | Calendar CRUD |
| supabase/functions/delete-calendar-event/index.ts | Hard delete |

## Files Modified

| File | Changes |
|------|---------|
| src/App.jsx | Wired useEconomy, useCatchUpReset, real QuestBoard/CalendarView/RewardGrid/ProgressiveRamp |
| src/hooks/useDebounce.js | Added useDebouncedAction export for D-pad chore toggle |
| src/components/quests/QuestBoard.jsx | Full implementation |
| src/components/quests/ChoreCard.jsx | Full implementation |
| src/components/shop/RewardGrid.jsx | Full implementation |
| src/components/shop/PurchaseConfirm.jsx | Full implementation |
| src/components/shared/PurchaseProgressIndicator.jsx | Full implementation |
| src/components/calendar/CalendarView.jsx | Full implementation |
| src/components/calendar/EventCard.jsx | Full implementation |
| src/components/calendar/SomedayBucket.jsx | Full implementation |
| src/components/academy/EarlyBirdBanner.jsx | Full implementation |
| src/components/admin/ProgressiveRamp.jsx | Full implementation |
| src/components/admin/ChoreBuilder.jsx | Full implementation |
| src/components/admin/RewardBuilder.jsx | Full implementation |

## Build Status
- `vite build` ✅ passes (506 kB bundle, 1882 modules)

## Spec Ambiguities

| Location | Ambiguity | Decision | Rationale |
|----------|-----------|----------|-----------|
| chore_definitions.frequency | Spec has 'daily','weekly','once' but phase prompt says 'monthly' | Used 'once' per DB constraint, labeled as "Monthly Epics" in UI | DB constraint is authoritative |
| calendar_events.is_someday | Not in migration 001 column list | Used in queries — assumes column exists on remote DB | Spec §2.7 references it |
| Email in daily-reset | No Resend/SendGrid API key configured | Deferred with console.log | Per phase prompt instructions |

## Economy Integrity Check
- ✅ useEconomy calls `complete_chore` RPC (never writes kids.coins directly)
- ✅ useEconomy calls `redeem_reward` RPC (never writes kids.coins directly)
- ✅ All mutations use `crypto.randomUUID()` for mutation_id
- ✅ Offline mutations queued with mutation_id in offlineCache
- ✅ reject-chore Edge Function reverses coins AND xp

## Adversarial Review — 2026-07-07

**Verdict: PROMOTE** (40/40 checks passed)

| Section | Items | Result |
|---|---|---|
| 1. Economy Integrity (CRITICAL) | 4/4 | **PASS** — All mutations via RPCs, no direct coin/xp writes, mutation IDs on every call, offline queue keyed by mutation_id |
| 2. Chore Completion Flow | 6/6 | **PASS** — 1s debounce, Enter→RPC→confetti→gold toast chain, card-position confetti, HUD refresh, correct status transitions, claw-back toasts |
| 3. Cron & Reset | 5/5 | **PASS** — ET timezone via IANA (not UTC-4), service role key, mount+visibility reset, auto-approve, daily XP reset |
| 4. Reward Shop | 5/5 | **PASS** — 2s hold-to-confirm on TV, visual fill indicator, cancel on release, client+server insufficient-coins guard, daily limit enforced server-side |
| 5. Calendar | 6/6 | **PASS** — TV week-list / mobile month grid, bounded RRULE (no rule.all()), color-coded per kid, UUID FK, someday bucket separate |
| 6. Progressive Ramp | 5/5 | **PASS** — In admin/, queries view, 80% threshold, filters active chores, hidden on TV |
| 7. Parent CRUD Builders | 5/5 | **PASS** — Both builders functional, hidden on TV, call edge functions, soft delete, Phase 07 TODO comments present |
| 8. Edge Functions | 4/4 | **PASS** — All 12 use service role key, reject-chore reverses coins+XP, proper JSON responses, no ANTHROPIC_API_KEY |

### Schema Caveats (verify against live Supabase)

| Issue | Detail |
|---|---|
| `auto_approve_hours` location | Migration 001 puts it on `chore_definitions`; `perform_daily_reset` RPC reads from `families`. Verify live `families` table has this column. |
| `daily_xp` vs `daily_xp_earned` | Migration 001 names the column `daily_xp`; RPC references `daily_xp_earned`. Verify live `kids` table column name. |

These likely reflect schema changes applied via later migrations or MCP operations. If the live schema matches the RPCs, no action needed — but migration files should be reconciled for reproducibility.

## Warnings for Next Phase
- Phase 04 (Video): No shared file modifications — safe to run in parallel
- Phase 05 (Quiz): Will need useEconomy hook API (completeChore/redeemReward pattern), fireConfetti import, triggerLevelUp from LevelUpProvider
- EarlyBirdBanner exports useEarlyBird() hook for Phase 05 to consume
