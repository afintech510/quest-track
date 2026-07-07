# QuestTrack Academy — UX / Toast Copy Audit
**Phase:** 08 (Testing & Hardening)
**Date:** 2026-07-07
**Spec Reference:** §7.1 Error Taxonomy

---

## Toast Message Audit

| Context | Spec §7.1 Expected | Actual | File:Line | Status |
|---------|-------------------|--------|-----------|--------|
| Supabase offline (chore) | "Saving locally — will sync when online!" | "Chore saved offline — will sync when connected!" | useEconomy.js:15 | **WARNING** |
| Supabase offline (purchase) | "Saving locally — will sync when online!" | "Purchase saved offline — will sync when connected!" | useEconomy.js:64 | **WARNING** |
| Supabase offline (quiz) | "Saving locally — will sync when online!" | "Saving results offline — will sync when connected!" | QuizEngine.jsx:216 | **WARNING** |
| Supabase offline (checkpoint) | "Saving locally — will sync when online!" | "Saving results offline — will sync when connected!" | ChapterCheckpoint.jsx:243 | **WARNING** |
| Anthropic timeout | (seamless fallback, no toast) | Seamless fallback via fallbackBank | QuizEngine.jsx:82-90 | **PASS** |
| YouTube fail | "Video unavailable — trying backup..." | "Video unavailable — trying backup..." | LessonPlayer.jsx:122 | **PASS** |
| PIN lockout | "Too many attempts. Try again in 5 minutes." | "Too many attempts" + dynamic countdown timer | ParentPinPad.jsx:145-146 | **WARNING** |
| Chore rejected | "[Chore] wasn't approved — ask a parent why!" | `${title} wasn't approved — ask a parent why!` | QuestBoard.jsx:52 | **PASS** |
| Stale reset | "Daily reset may have been missed — check WiFi" | "Daily reset may have been missed — check WiFi connection." | StaleResetBanner.jsx:13 | **PASS** |
| Quiz generation failed | "Let's try some practice questions instead!" | (no toast — seamless fallback) | QuizEngine.jsx | **WARNING** |

---

## Quiz Feedback Language Audit

### Check: No "wrong", "incorrect", "failed" in quiz feedback
**Result: PASS**

| File | Feedback Messages |
|------|-------------------|
| QuizQuestion.jsx:4 | Correct: "Amazing!", "You got it!", "Great thinking!" |
| QuizQuestion.jsx:5 | Retry: "Not quite! Try again!", "Almost! Give it another shot!", "Close! Try once more!" |

All quiz feedback uses growth-mindset language per spec. No instances of "wrong", "incorrect", or "failed" in quiz-related components.

Note: `videoFailed` state variable in LessonPlayer.jsx is internal state naming, not user-facing text.

---

## ConnectionIndicator States Audit

### Check: online → offline → syncing → online transitions
**Result: PASS**

| State | Icon | Color | Label |
|-------|------|-------|-------|
| online | Wifi | text-emerald-400 | "Online" |
| offline | WifiOff | text-red-400 | "Offline" |
| syncing | RefreshCw (spinning) | text-amber-400 | "Syncing" |

File: `src/components/layout/ConnectionIndicator.jsx`

Transitions driven by `useConnectionHealth.js`:
- `!isOnline` → status = 'offline'
- `isOnline && pendingCount > 0` → status = 'syncing'
- `isOnline && pendingCount === 0` → status = 'online'

Pending count shown in parentheses when > 0 (e.g., "Syncing (3)").

---

## Summary

| Category | Total Checks | PASS | WARNING |
|----------|-------------|------|---------|
| Toast messages | 10 | 5 | 5 |
| Quiz feedback language | 1 | 1 | 0 |
| ConnectionIndicator states | 1 | 1 | 0 |
| No native dialogs | 1 | 1 | 0 |

### Warnings Detail

1. **Offline toast copy mismatch (4 instances):** Messages say "will sync when connected" instead of spec's "will sync when online." Functionally equivalent but not verbatim spec match. Files: useEconomy.js:15, useEconomy.js:64, QuizEngine.jsx:216, ChapterCheckpoint.jsx:243

2. **PIN lockout message:** Shows "Too many attempts" + dynamic countdown instead of spec's static "Too many attempts. Try again in 5 minutes." The dynamic countdown is arguably better UX but deviates from spec.

3. **Missing quiz fallback toast:** Spec §7.1 expects "Let's try some practice questions instead!" toast when quiz generation fails. Implementation uses seamless fallback without toast notification. User may not realize they're getting fallback questions.
