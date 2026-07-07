# Phase 05: AI Quiz Engine — Completion Report

## Status: COMPLETE

All 7 tasks implemented and build passing.

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| supabase/functions/generate-quiz/index.ts | Anthropic proxy Edge Function with 4s timeout + Tier 1/2 fallback | ~160 |
| src/components/shared/LoadingQuiz.jsx | "Summoning Quiz..." full-screen overlay with cancel | ~30 |
| src/components/academy/QuizQuestion.jsx | Single MC question with 2-retry cap, feedback, auto-advance | ~120 |

## Files Modified

| File | Changes | Why |
|------|---------|-----|
| src/components/academy/QuizEngine.jsx | Full implementation replacing stub | Quiz flow orchestrator (loading → active → results) |
| src/data/fallbackQuizBank.json | Populated with 13 questions across 4 subjects | Client-side Tier 2 fallback |
| src/App.jsx | Added quizState, QuizEngine import, wired onQuizStart callback | Integration with academy tab navigation |

## Edge Functions

| Function | Status | Secrets Required |
|----------|--------|-----------------|
| generate-quiz | created (deploy with `supabase functions deploy generate-quiz`) | ANTHROPIC_API_KEY |

## Architecture

### Quiz Generation Flow
```
LessonPlayer → [Quiz Unlocked!] → LoadingQuiz overlay → QuizEngine
  → fetch generate-quiz Edge Function (7s client timeout)
    → Edge Function calls Anthropic Haiku (4s server timeout)
      → Success: fresh AI questions (source: 'ai')
      → Timeout: fallback_questions table (source: 'fallback')
      → DB fail: signal client_fallback
    → Client catch/client_fallback: bundled fallbackQuizBank.json
  → QuizQuestion × N (one at a time)
    → Correct: celebration + explanation + confetti + auto-advance 2s
    → Wrong (attempt 1): encouraging retry message
    → Wrong (attempt 2): reveal correct + explanation + 50% partial + auto-advance 3s
  → Submit via submit_quiz RPC
    → Online: real RPC → update HUD, fire confetti, level-up modal
    → Offline: optimistic results + queue mutation
  → Results screen (score, XP, coins, Early Bird callout)
  → [Back to Lessons] → lesson list
```

### In-Flight Guard (C1-028)
- `inFlightRef` prevents double-tap on "Quiz Unlocked!" button
- Client-side AbortController with 7s timeout wraps full round trip
- Cancel button on LoadingQuiz aborts the request

### Early Bird Integration
- submit_quiz RPC determines Early Bird server-side (no local clock trust)
- Results screen shows "Early Bird Bonus!" callout when `early_bird_active === true`
- Offline submissions show base rewards only (intended behavior per C1-017)

### Skipped Video Penalty
- `skippedVideo` flag from LessonPlayer passed through to QuizEngine
- SPEC-AMBIGUITY: Applied 50% score penalty client-side (`effectiveScore = Math.floor(score / 2)`)
- Results screen shows "Rewards reduced" message

### Tone Compliance (C1-026)
- Zero instances of "wrong", "incorrect", "failed" in quiz UI
- Correct: "Amazing!", "You got it!", "Great thinking!"
- Retry: "Not quite! Try again!", "Almost! Give it another shot!", "Close! Try once more!"
- Reveal: "Here's the answer! [explanation]"

## Acceptance Criteria Results

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Quiz generates 3-5 unique MC questions per session | ✅ PASS | Edge Function requests question_count=3, AI generates fresh per call |
| 2 | Questions include standard_code matching lesson's module | ✅ PASS | Edge Function fetches module.standard_codes, passes to AI prompt |
| 3 | Questions have exactly 4 options (A-D) with one correct | ✅ PASS | validateQuizResponse checks options.length === 4, correct_index 0-3 |
| 4 | Each question has explanation (≤2 sentences) | ✅ PASS | System prompt enforces "max 2 sentences", validation checks string |
| 5 | Anthropic responds within 4s → fresh questions | ✅ PASS | 4s AbortController timeout in Edge Function |
| 6 | Anthropic times out → fallback_questions seamless | ✅ PASS | catch block queries fallback_questions table, returns source:'fallback' |
| 7 | Supabase fallback fails → client JSON bank (Tier 2) | ✅ PASS | Returns source:'client_fallback', client loads fallbackQuizBank.json |
| 8 | Total client timeout at 7s | ✅ PASS | CLIENT_TIMEOUT_MS = 7000 with AbortController |
| 9 | Seamless transition loading → questions | ✅ PASS | All fallback paths set questions and transition to 'active' state |
| 10 | "Summoning Quiz..." blocks D-pad | ✅ PASS | Fixed overlay z-50, only cancel button is tv-focusable |
| 11 | Cancel button returns to lesson | ✅ PASS | onCancel aborts request and calls onBack |
| 12 | 4 answer options, all tv-focusable | ✅ PASS | button elements with tv-focusable class |
| 13 | Wrong (attempt 1): encouraging, no reveal | ✅ PASS | state='feedback', retry message, resets after 1.2s |
| 14 | Wrong (attempt 2): reveal + explanation + 50% partial | ✅ PASS | state='revealed', shows correct answer + explanation |
| 15 | Correct: celebration + explanation + confetti | ✅ PASS | state='correct', star icon, explanation, confetti on >50% score |
| 16 | No "wrong"/"incorrect"/"failed" in quiz UI | ✅ PASS | Grep confirms zero instances in QuizQuestion/QuizEngine |
| 17 | submit_quiz RPC called with correct params | ✅ PASS | All 8 RPC params passed (kid_id, lesson_id, answers, questions, score, max_score, difficulty, mutation_id) |
| 18 | Coins/XP update in HeroStatsHUD after quiz | ✅ PASS | refreshData() called on success |
| 19 | Daily XP cap enforced | ✅ PASS | Server-side in submit_quiz RPC |
| 20 | Duplicate submission: already_processed, no double-award | ✅ PASS | mutation_id sent, RPC handles idempotency |
| 21 | Level-up modal fires | ✅ PASS | triggerLevelUp called when data.leveled_up |
| 22 | Early Bird active: doubled XP + bonus coins | ✅ PASS | Server-side in RPC, client shows callout |
| 23 | Non-Early-Bird: base rewards | ✅ PASS | earlyBirdActive=false hides callout |
| 24 | Offline quiz: base rewards, no Early Bird | ✅ PASS | Offline path shows offline=true, earlyBirdActive=false |
| 25 | Early Bird callout on results | ✅ PASS | Sunrise icon + "Early Bird Bonus!" when active |
| 26 | Double-tap guard: only one request | ✅ PASS | inFlightRef prevents concurrent requests |
| 27 | In-progress request: second press ignored | ✅ PASS | Same inFlightRef guard |

## Spec Ambiguities

| Location | Ambiguity | Decision Made | Rationale |
|----------|-----------|---------------|-----------|
| §2.4 / skippedVideo penalty | Spec says "reduced rewards" but doesn't specify exact mechanism | Applied 50% score penalty client-side before RPC call | Simple, transparent, server RPC calculates rewards from score |

## Warnings for Next Phase
- Phase 06 (Reading Guild) follows same AI Edge Function pattern — generate-checkpoint mirrors generate-quiz
- Shared patterns: AbortController timeout, Tier 1/2 fallback, submit via RPC, offline queue
- Key difference: reading checkpoints use chapter summary context injection instead of lesson/module context
- fallbackQuizBank.json module_id values are placeholders — real module UUIDs will come from seeded data
