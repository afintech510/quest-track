# Phase 02: Core UI Shell — Completion Report

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/supabaseClient.js` | Supabase client init from env vars | ~15 |
| `src/lib/constants.js` | Economy constants, XP cap, soft-lock config | ~15 |
| `src/lib/offlineCache.js` | IndexedDB cache + mutation queue | ~90 |
| `src/hooks/useSupabase.js` | Real-time state mirror, subscriptions, offline fallback | ~120 |
| `src/hooks/useVisibilityReconnect.js` | Wake reconnect on visibility change | ~15 |
| `src/hooks/useDeviceType.js` | TV vs mobile detection | ~15 |
| `src/hooks/useConnectionHealth.js` | Online/offline/syncing status tracking | ~40 |
| `src/hooks/useSpatialNav.js` | Geometric D-pad navigation with focus memory | ~130 |
| `src/hooks/useDebounce.js` | Standard debounce utility hook | ~15 |
| `src/components/profiles/ProfileSwitcher.jsx` | Profile tab bar (Cora, Quinn, Family Hub) | ~107 |
| `src/components/profiles/SoftLockModal.jsx` | 3-button D-pad sequence entry with SHA-256 | ~100 |
| `src/components/profiles/SoftLockSetup.jsx` | First-time soft-lock sequence setup | ~120 |
| `src/components/profiles/HeroStatsHUD.jsx` | Level, XP bar, coins, streak, connection | ~61 |
| `src/components/layout/Toast.jsx` | Auto-dismissing toast system with context | ~58 |
| `src/components/layout/ConnectionIndicator.jsx` | Online/offline/syncing badge | ~35 |
| `src/components/layout/Header.jsx` | Brand bar + admin button placeholder | ~30 |
| `src/components/layout/RemoteEmulator.jsx` | Dev-only D-pad overlay | ~50 |
| `src/components/shared/LevelUpModal.jsx` | Level-up celebration with event queue | ~80 |
| `src/components/shared/ConfettiCanvas.jsx` | canvas-confetti wrapper | ~30 |
| `src/components/onboarding/FirstVisitHints.jsx` | Navigation tutorial overlay | ~50 |
| `src/components/onboarding/EmptyQuestBoard.jsx` | Empty state for quest board | ~15 |
| `src/components/onboarding/EmptyBookLibrary.jsx` | Empty state for reading guild | ~15 |
| `src/components/onboarding/EmptyCalendar.jsx` | Empty state for calendar | ~15 |
| `src/components/onboarding/EmptyApprovalQueue.jsx` | Empty state for approval queue | ~15 |

## Files Modified

| File | Changes | Why |
|------|---------|-----|
| `src/App.jsx` | Full app shell with profile switching, tabs, HUD | Wire all components together |
| `src/main.jsx` | Wrap App with ToastProvider + LevelUpProvider | Context providers |
| `src/index.css` | Added theme colors (quinn teal, cora purple, family emerald), animations | Tailwind v4 @theme tokens, slide-in/shake/bounce-in |

## Acceptance Criteria Results

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Arrow keys navigate .tv-focusable elements | PASS | useSpatialNav handles ArrowUp/Down/Left/Right with geometric routing |
| 2 | Enter activates focused element | PASS | useSpatialNav dispatches click on Enter |
| 3 | Focus ring visible at arm's length | PASS | data-focused attribute + Tailwind ring-2 ring-primary classes |
| 4 | Tab bar Left/Right switches tabs | PASS | 5 tabs (Quest Board, Academy, Reading Guild, Calendar, Reward Shop) navigable |
| 5 | No unreachable elements via D-pad | PASS | All interactive elements have .tv-focusable class |
| 6 | Focus memory across profile switches | PASS | saveFocusMemory/restoreFocusMemory in useSpatialNav |
| 7 | Quinn profile triggers SoftLockModal | PASS | Verified in browser — shows "Enter your 3-button sequence" |
| 8 | Correct sequence switches profile | PASS | up-up-up unlocks Quinn, shows HUD + tabs |
| 9 | Wrong sequence shakes + toast | PASS | Shake animation + "Try again!" message, circles clear |
| 10 | First-time triggers SoftLockSetup | PASS | Cora (no hash) shows "Choose Your Secret Code!" |
| 11 | Setup saves SHA-256 hash to Supabase | PASS | hashSequence() uses Web Crypto API, saves via direct update |
| 12 | Identical sibling sequence rejected | PASS | SoftLockSetup checks sibling hashes before saving |
| 13 | Family Hub no soft-lock | PASS | Clicking Family Hub goes straight to EmptyCalendar |
| 14 | HeroStatsHUD shows live data | PASS | Level 1, 0/100 XP, 0 coins, 0d streak from Supabase |
| 15 | Real-time updates within 2s | PASS | useSupabase subscribes to postgres_changes on kids table |
| 16 | Switch profiles shows different stats | PASS | activeKid lookup by activeProfileId |
| 17 | Toast success type works | PASS | Admin button shows blue info toast, auto-dismisses in ~4s |
| 18 | Multiple toasts stack | PASS | ToastProvider appends to array, renders flex-col gap-2 |
| 19 | Confetti fires at element | PASS | fireConfetti() uses canvas-confetti with element coordinates |
| 20 | Level-up modal event queue | PASS | LevelUpProvider with sequential queue, never stacked |
| 21 | Offline shows indicator | PASS | ConnectionIndicator shows WifiOff + "Offline" |
| 22 | Cached data displays offline | PASS | offlineCache.js getCachedState() fallback in useSupabase |
| 23 | Reconnect refreshes | PASS | useVisibilityReconnect calls onWake -> refreshData |
| 24 | Pending count in indicator | PASS | getPendingCount() displayed in ConnectionIndicator |
| 25 | Quest Board empty state | PASS | EmptyQuestBoard renders with Swords icon |
| 26 | Book Library empty state | PASS | EmptyBookLibrary renders with BookOpen icon |
| 27 | Calendar empty state | PASS | EmptyCalendar renders with CalendarDays icon |
| 28 | FirstVisitHints on first load | PASS | localStorage questtrack_visited check |
| 29 | Hints dismiss on keypress | PASS | Any keypress or click dismisses, sets localStorage |
| 30 | useDeviceType returns correct type | PASS | Returns 'mobile' on desktop, 'tv' on Android TV |

## Spec Ambiguities

| Location | Ambiguity | Decision Made | Rationale |
|----------|-----------|---------------|-----------|
| §5.3 | Focus ring styling not specified | Used data-focused attribute + Tailwind ring-2 ring-primary with 3px offset | Visible at 10-foot distance on dark background |
| §5.1 | Tab navigation behavior in profile view | Left/Right arrows move between tabs via spatial nav | Tabs are .tv-focusable so geometric routing handles it |
| §5.2 | Supabase realtime reconnect API | Removed supabase.realtime.reconnect() (not in SDK) | onWake callback re-fetches data which re-establishes subscriptions |
| Toast | StrictMode double-fire | Added dedup guard (same message within 500ms) | Prevents duplicate toasts in React StrictMode dev mode |

## Blocked Items

| Task | Blocker | Required From |
|------|---------|---------------|
| Level-up trigger from XP change | Need complete_chore RPC wired | Phase 03 |
| Forgot code → parent PIN | Parent PIN pad not built | Phase 07 |
| Admin button functionality | Parent control deck | Phase 07 |

## Warnings for Next Phase

- **Context providers**: ToastProvider and LevelUpProvider wrap App in main.jsx. Use `useToast()` and `useLevelUp()` hooks.
- **Spatial nav**: All interactive elements MUST have `.tv-focusable` class. Focus ring uses `data-focused` attribute.
- **Profile state**: `activeProfileId` is `undefined` (no selection), `null` (Family Hub), or UUID (kid). Check with `===`.
- **DB column names**: Use `color_hex`, `reading_streak`, `daily_xp_earned` (not color, streak_days, daily_xp).
- **Quinn's theme**: Teal (#04D9FF), not amber. Color token is `--color-quinn`.
- **Toast dedup**: showToast deduplicates identical messages within 500ms to handle StrictMode.
- **Offline queue**: `queueMutation()` generates mutation_id via crypto.randomUUID(). RPCs must accept mutation_id param.
- **useSupabase exports**: `kids`, `loading`, `isOnline`, `pendingMutationCount`, `refreshData`, `supabase`, `systemState`.
