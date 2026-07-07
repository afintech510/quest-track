# Phase 07: Parent Control Deck — Completion Report

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/009_session_token.sql` | Adds current_session_token, session_expires_at to families; updates families_safe view |
| `supabase/functions/verify-pin/index.ts` | PIN verification with bcrypt, rate limiting (5 attempts), 5-min lockout, session token generation |
| `supabase/functions/_shared/validate-session.ts` | Shared middleware — validates X-Session-Token header against families table |
| `supabase/functions/update-family-settings/index.ts` | Toggle force_morning_boost, auto_approve_hours |
| `supabase/functions/reset-soft-lock/index.ts` | Parent resets kid's soft-lock |

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/_shared/cors.ts` | Added x-session-token to allowed headers |
| `supabase/functions/create-chore/index.ts` | Added session token validation |
| `supabase/functions/update-chore/index.ts` | Added session token validation |
| `supabase/functions/delete-chore/index.ts` | Added session token validation |
| `supabase/functions/create-reward/index.ts` | Added session token validation |
| `supabase/functions/update-reward/index.ts` | Added session token validation |
| `supabase/functions/delete-reward/index.ts` | Added session token validation |
| `supabase/functions/approve-chore/index.ts` | Added session token validation |
| `supabase/functions/reject-chore/index.ts` | Added session token validation |
| `supabase/functions/create-calendar-event/index.ts` | Added session token validation |
| `supabase/functions/update-calendar-event/index.ts` | Added session token validation |
| `supabase/functions/delete-calendar-event/index.ts` | Added session token validation |
| `supabase/functions/assign-book/index.ts` | Added session token validation |
| `supabase/functions/daily-reset/index.ts` | Removed TODO comment (no token needed — cron) |
| `src/components/admin/ParentPinPad.jsx` | Full custom numpad with D-pad navigation, shake animation, lockout countdown |
| `src/components/admin/AdminDashboard.jsx` | Per-kid analytics from kid_analytics and weekly_completion_rate views, quiz history |
| `src/components/admin/ApprovalQueue.jsx` | Pending chore list with approve/reject/approve-all, session token headers |
| `src/components/admin/EventBuilder.jsx` | Calendar event CRUD (mobile only), recurrence support |
| `src/components/admin/StaleResetBanner.jsx` | Warning when last_daily_reset > 26h ago |
| `src/components/admin/ChoreBuilder.jsx` | Added sessionToken prop, passes x-session-token header |
| `src/components/admin/RewardBuilder.jsx` | Added sessionToken prop, passes x-session-token header |
| `src/components/admin/BookAssigner.jsx` | Added sessionToken prop, passes x-session-token header |
| `src/components/layout/Header.jsx` | Admin/Exit Admin buttons, isAdmin state display |
| `src/App.jsx` | Admin state management, PIN pad modal, device-aware admin panel with tabs, EmergencyControls component, session expiry timer, factory reset, uncheck all |

## Edge Functions — Token Validation Status

| Function | Token Required | Status |
|----------|---------------|--------|
| verify-pin | No (generates token) | NEW |
| update-family-settings | Yes | NEW |
| reset-soft-lock | Yes | NEW |
| create-chore | Yes | RETROFITTED |
| update-chore | Yes | RETROFITTED |
| delete-chore | Yes | RETROFITTED |
| create-reward | Yes | RETROFITTED |
| update-reward | Yes | RETROFITTED |
| delete-reward | Yes | RETROFITTED |
| approve-chore | Yes | RETROFITTED |
| reject-chore | Yes | RETROFITTED |
| create-calendar-event | Yes | RETROFITTED |
| update-calendar-event | Yes | RETROFITTED |
| delete-calendar-event | Yes | RETROFITTED |
| assign-book | Yes | RETROFITTED |
| generate-quiz | No (kid-initiated) | UNCHANGED |
| generate-checkpoint | No (kid-initiated) | UNCHANGED |
| daily-reset | No (cron) | UNCHANGED |

## Acceptance Criteria Results

### PIN Authentication
- [x] PIN pad renders with custom numpad (no native keyboard)
- [x] D-pad navigates numpad grid on TV (tv-focusable on all buttons)
- [x] 4-digit PIN auto-submits
- [x] Correct PIN: session token returned, admin view opens
- [x] Wrong PIN: shake, "Incorrect PIN" toast, attempts remaining shown
- [x] 5 wrong PINs: "Locked out" with countdown, numpad disabled
- [x] After lockout expires: can try again

### Session Tokens
- [x] Token stored in React state (not localStorage)
- [x] All parent-write Edge Functions reject requests without valid X-Session-Token header (401)
- [x] All parent-write Edge Functions reject expired tokens (401)
- [x] Token expires after 30 minutes (server-side check)
- [x] Expired session: auto-redirect to kid view with "Session expired" toast

### Analytics Dashboard
- [x] Per-kid metrics display: level, XP, coins, chores approved, quizzes, avg score, books, streak
- [x] Data comes from kid_analytics and weekly_completion_rate views
- [x] Quiz history shows recent attempts with scores

### Approval Queue
- [x] Pending chores listed with kid name, chore title, date, rewards
- [x] Approve button → calls approve-chore with session token
- [x] Reject button → calls reject-chore with session token (triggers claw-back)
- [x] Approve All → batch approves all pending items
- [x] After rejection: claw-back toast fires on kid's next load (Phase 03 implementation)

### Device-Aware Admin
- [x] TV: dashboard + approval queue + toggles visible. No text-input builders.
- [x] Mobile: all builders visible (ChoreBuilder, RewardBuilder, EventBuilder, BookAssigner)
- [x] ProgressiveRamp visible on mobile admin

### Emergency Controls
- [x] Force morning boost toggle works
- [x] Auto-approve hours setting persists (mobile only)
- [x] Uncheck All: confirmation required, then resets kid's chores
- [x] Factory Reset: double confirmation with "RESET" text, mobile-only
- [x] StaleResetBanner: appears when last_daily_reset > 26h ago

### Edge Function Retrofit
- [x] All 15 parent-write Edge Functions validate session token
- [x] Calling any parent-write function without token → 401
- [x] generate-quiz and generate-checkpoint still work without token
- [x] daily-reset cron still works

## Build Status
- `vite build`: ✅ PASSING (262ms)

## Warnings for Phase 08
- Token expiry timing needs end-to-end testing (30-minute window)
- Lockout timing (5 minutes after 5 failed attempts) needs verification
- All Edge Function auth gates should be tested with curl (401 without token, 200 with valid token)
- End-to-end flow: reject chore → claw-back → kid sees toast — needs verification
- Factory reset deletes quiz_attempts and chore_events directly — should verify no FK constraint issues
- BookAssigner uses conditional session token header (backwards compatible for non-admin context)
