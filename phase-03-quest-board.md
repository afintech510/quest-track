# Phase 03: Quest Board & Economy
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 02 (Core UI Shell)
**Implements:** F-012, F-013, F-013b, F-013c, F-014, F-015, F-016 (banner only), F-019
**Recommended:** `claude --max-turns 75`
**⚡ Can run in parallel with Phase 04 (Video & Curriculum)**

---

## 1. Context

You are executing **Phase 03: Quest Board & Economy** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the chore system, reward shop, family calendar, cron-based daily reset, and the parent CRUD builders for chores and rewards. You are NOT building the quiz engine, reading guild, PIN authentication, or analytics dashboard.

**⚠️ ECONOMY INTEGRITY:** The review cycle identified the economy as the highest-risk area. All coin/XP mutations MUST go through the server-side RPCs created in Phase 01 (`complete_chore`, `redeem_reward`). Never write directly to `kids.coins` or `kids.xp` from the client. The daily XP cap (200) is enforced server-side in the RPCs.

**Tech Stack:** React, Tailwind, Supabase (RPCs + Edge Functions + Realtime), rrule.js, canvas-confetti
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 2.4 (RPCs), 2.5 (views), 2.7 (recurring events), 4.2 (Edge Functions: daily-reset, parent-write endpoints), 5.1 (component tree), 7.1 (error handling) are your primary references.

### What Already Exists
- Phase 00: Project scaffold, dependencies, Capacitor shell
- Phase 01: Complete DB schema (17 tables, RPCs, RLS, views, seed data). Key RPCs: `complete_chore(event_id, mutation_id)`, `redeem_reward(kid_id, reward_id, mutation_id)`, `perform_daily_reset(family_id, target_date)`. Seed data includes 3 daily chores, 1 weekly, 3 rewards.
- Phase 02: Core UI shell — useSpatialNav, useSupabase, ProfileSwitcher, HeroStatsHUD, Toast, LevelUpModal, ConfettiCanvas, offlineCache with mutation queue, ConnectionIndicator, empty states. Check `PHASE-02-COMPLETION.md` for context providers and hook APIs.

### What You're Building
The daily-use backbone. Kids open the app, see their chores, check them off with confetti and coin rewards, browse the reward shop, and see the family calendar. Behind the scenes: a cron resets chores at midnight ET, transitions completions to the approval queue, auto-approves stale items, and emails parents. Parents can add/edit/delete chores and rewards from their phone. The progressive ramp suggests new chores when kids prove consistency.

---

## 2. Objective & Deliverables

### Objective
Kids can complete chores (daily/weekly/monthly) with atomic coin/XP awards, purchase rewards with hold-to-confirm protection, and view a family calendar with recurring events. Chores reset automatically at midnight ET via cron. Parents can manage chores and rewards via mobile CRUD. Progressive ramp suggests new chores at ≥80% weekly completion.

### Deliverables
1. **`QuestBoard.jsx`** — Daily/Weekly/Monthly sections with chore cards — Spec §5.1
2. **`ChoreCard.jsx`** — Toggle with 1s debounce, confetti, RPC call — Spec §5.1
3. **`useEconomy.js` hook** — Wrapper around complete_chore and redeem_reward RPCs — Spec §5.1
4. **`useCatchUpReset.js` hook** — Calls perform_daily_reset on mount/visibilitychange — Spec §5.1
5. **`useDebounce.js` hook** — 1-second debounce for D-pad chore toggle — Spec §5.1
6. **`daily-reset` Edge Function** — Hourly cron, AT TIME ZONE check, parent email — Spec §4.2
7. **Parent-write Edge Functions** — create/update/delete chore, reward, calendar event; approve/reject chore — Spec §4.2
8. **`RewardGrid.jsx` + `PurchaseConfirm.jsx` + `PurchaseProgressIndicator.jsx`** — Spec §5.1
9. **`CalendarView.jsx`** — TV=agenda/week-list, Mobile=month grid — Spec §5.1
10. **`EventCard.jsx`** — Color-coded per kid — Spec §5.1
11. **`SomedayBucket.jsx`** — Undated wishlist — Spec §5.1
12. **`rruleParser.js`** — Bounded [view_start, view_end] RRULE expansion — Spec §2.7
13. **`clockService.js`** — UTC time utilities — Spec §5.1
14. **`EarlyBirdBanner.jsx`** — Display-only sunrise indicator (logic wired in Phase 05) — Spec §5.1
15. **`ProgressiveRamp.jsx`** — Parent admin, "Ready to Grow" suggestion — Spec §5.1
16. **`ChoreBuilder.jsx`** — Mobile-only CRUD for chore_definitions — Spec §5.1
17. **`RewardBuilder.jsx`** — Mobile-only CRUD for rewards — Spec §5.1

---

## 3. Implementation Instructions

### Task 1: useEconomy Hook
**Spec Reference:** §2.4, §5.1
**Creates:** `src/hooks/useEconomy.js`

Wrapper around the Supabase RPCs. Each function:
1. Generates a `mutation_id` via `crypto.randomUUID()`
2. If online: calls the RPC directly
3. If offline: queues the mutation in IndexedDB (from Phase 02's offlineCache), returns optimistic result
4. Handles the response JSON (status, coins, xp, leveled_up)
5. On `leveled_up: true`, triggers the level-up modal event

```javascript
export function useEconomy(supabase, activeKid, showToast, offlineCache) {
  const completeChore = async (choreEventId) => {
    const mutationId = crypto.randomUUID();
    // ... RPC call or offline queue
  };
  
  const redeemReward = async (rewardId) => {
    const mutationId = crypto.randomUUID();
    // ... RPC call or offline queue
  };
  
  return { completeChore, redeemReward };
}
```

**Key:** Never construct coin/xp amounts client-side. The RPCs look up amounts from chore_definitions/rewards server-side.

### Task 2: Quest Board & Chore Cards
**Spec Reference:** §5.1
**Creates:** `src/components/quests/QuestBoard.jsx`, `src/components/quests/ChoreCard.jsx`
**Depends on:** Task 1

**QuestBoard:** Renders three sections (Daily Quests, Weekly Raids, Monthly Epics) filtered by `chore_definitions.frequency`. Each section maps active chore_definitions (WHERE `deleted_at IS NULL AND is_active = true`) and joins with the latest `chore_events` for the current kid + current period.

**ChoreCard:** Displays chore title, reward amounts, and status. Interactive via D-pad:
- Status `reset` → unchecked. Enter → starts completion.
- 1-second debounce (useDebounce hook) prevents accidental double-toggle from D-pad repeat
- On complete: call `completeChore(eventId)` → fire `fireConfetti(cardElement)` → show gold toast with coins earned
- Status `completed` → checkmark shown, card grayed/styled
- Status `pending_approval` → hourglass icon, "Waiting for parent review"
- Status `approved` → gold checkmark
- Status `rejected` → red X, claw-back toast: "[Chore] wasn't approved — ask a parent why!" (C1-027)

**Claw-back toast (C1-027):** On kid login, check for recently rejected chore_events (reviewed_at in last 24h, status='rejected'). Show toast for each.

All chore cards are `.tv-focusable`.

### Task 3: useDebounce Hook
**Spec Reference:** §5.1
**Creates:** `src/hooks/useDebounce.js`

Simple debounce: prevent the same action from firing within `delay` ms. Used by ChoreCard to prevent D-pad Enter key repeat from double-completing.

```javascript
export function useDebounce(callback, delay = 1000) {
  const lastCall = useRef(0);
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
}
```

### Task 4: useCatchUpReset Hook
**Spec Reference:** §5.1, §2.4
**Creates:** `src/hooks/useCatchUpReset.js`

On app mount and `visibilitychange` (TV wake), check if a daily reset was missed:

1. Fetch `system_state.last_daily_reset` for the family
2. If `last_daily_reset` is before today (in ET timezone), call `perform_daily_reset` RPC
3. Handle multi-day catch-up: if 3 days behind, the RPC's atomic guard handles sequential processing (call once with today's date — the RPC iterates missed days internally)
4. After reset, refresh chore data

Wire this into `useVisibilityReconnect` from Phase 02.

### Task 5: Daily Reset Edge Function (Cron)
**Spec Reference:** §4.2
**Creates:** `supabase/functions/daily-reset/index.ts`

Supabase Edge Function running on hourly cron schedule.

```typescript
// Runs every hour. Only executes reset logic at midnight ET.
Deno.serve(async () => {
  // Check current ET time
  const now = new Date();
  const etHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
  );
  
  if (etHour !== 0) {
    return new Response(JSON.stringify({ status: 'not_midnight_et', hour: etHour }));
  }
  
  // Call perform_daily_reset RPC via service_role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase.rpc('perform_daily_reset', {
    p_family_id: FAMILY_ID,
    p_target_date: new Date().toISOString().split('T')[0]
  });
  
  // Send parent notification email (Resend or SendGrid)
  // ... email with summary of yesterday's completions
  
  return new Response(JSON.stringify({ status: 'reset_complete', data }));
});
```

**Cron schedule in Supabase:** Set via Supabase dashboard or `supabase/config.toml`:
```
[functions.daily-reset]
schedule = "0 * * * *"  # Every hour
```

**Email notification:** Use Resend (or SendGrid) SDK. Email parent with: "QuestTrack Daily Reset — [date]. [N] chores pending your review." Include link to web app. API key in Edge Function env vars.

If email service isn't configured yet, log to console and mark email as `// DEFERRED: configure Resend/SendGrid API key in Edge Function env vars`.

### Task 6: Parent-Write Edge Functions
**Spec Reference:** §4.2
**Creates:** Multiple files in `supabase/functions/`

Create Edge Functions for parent-privileged writes. **In this phase, these do NOT require PIN session tokens** — Phase 07 adds the token validation middleware. For now, they accept requests directly (interim trust model per C1-002).

| Function | File | Purpose |
|----------|------|---------|
| create-chore | `supabase/functions/create-chore/index.ts` | INSERT into chore_definitions |
| update-chore | `supabase/functions/update-chore/index.ts` | UPDATE chore_definitions |
| delete-chore | `supabase/functions/delete-chore/index.ts` | SET deleted_at (soft delete) |
| create-reward | `supabase/functions/create-reward/index.ts` | INSERT into rewards |
| update-reward | `supabase/functions/update-reward/index.ts` | UPDATE rewards |
| delete-reward | `supabase/functions/delete-reward/index.ts` | SET deleted_at (soft delete) |
| approve-chore | `supabase/functions/approve-chore/index.ts` | SET status='approved' on chore_event |
| reject-chore | `supabase/functions/reject-chore/index.ts` | SET status='rejected', claw back coins/xp |
| create-calendar-event | `supabase/functions/create-calendar-event/index.ts` | INSERT into calendar_events |
| update-calendar-event | `supabase/functions/update-calendar-event/index.ts` | UPDATE calendar_events |
| delete-calendar-event | `supabase/functions/delete-calendar-event/index.ts` | DELETE calendar_events (hard delete) |

Each function:
- Uses `SUPABASE_SERVICE_ROLE_KEY` (not anon key) to bypass RLS
- Validates input (required fields, correct types)
- Returns JSON with created/updated record
- Has a `// TODO Phase 07: Add session token validation` comment at the top

**reject-chore** must also reverse the coin/xp awards:
```sql
UPDATE kids SET
  coins = coins - ce.coins_awarded,
  xp = xp - ce.xp_awarded,
  daily_xp_earned = GREATEST(0, daily_xp_earned - ce.xp_awarded)
WHERE id = ce.kid_id;
```

### Task 7: Reward Shop
**Spec Reference:** §5.1, §2.4
**Creates:** `src/components/shop/RewardGrid.jsx`, `src/components/shop/PurchaseConfirm.jsx`, `src/components/shared/PurchaseProgressIndicator.jsx`

**RewardGrid:** Grid of reward cards. Each shows title, icon, cost in coins, remaining daily limit. All cards `.tv-focusable`.

**PurchaseConfirm:** On Enter, show confirmation overlay. On TV: requires holding Enter for 2 seconds (hold-to-confirm). On mobile: single tap confirm button.

**PurchaseProgressIndicator (C1-032):** During the 2-second hold, a visual progress ring/bar fills. If released early, cancels. On complete, calls `redeemReward(rewardId)`.

Implementation:
```javascript
const [holdProgress, setHoldProgress] = useState(0);
const holdTimer = useRef(null);

const onKeyDown = (e) => {
  if (e.key === 'Enter' && !holdTimer.current) {
    holdTimer.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          clearInterval(holdTimer.current);
          holdTimer.current = null;
          executePurchase();
          return 0;
        }
        return prev + (100 / (2000 / 50)); // 2s duration, 50ms intervals
      });
    }, 50);
  }
};
const onKeyUp = () => {
  clearInterval(holdTimer.current);
  holdTimer.current = null;
  setHoldProgress(0);
};
```

Show toast on purchase: "🎉 [Reward] purchased! [X] coins spent."
Show error toast if insufficient: "Not enough coins! Need [X] more."

### Task 8: Calendar System
**Spec Reference:** §5.1, §2.7, §6.3
**Creates:** `src/components/calendar/CalendarView.jsx`, `src/components/calendar/EventCard.jsx`, `src/components/calendar/SomedayBucket.jsx`, `src/lib/rruleParser.js`

**rruleParser.js (C1-024):** RRULE instance expansion using the `rrule` npm package, strictly bounded:

```javascript
import { RRule } from 'rrule';

export function expandEvents(events, viewStart, viewEnd) {
  // CRITICAL: Only expand within [viewStart, viewEnd] — never unbounded
  const expanded = [];
  for (const event of events) {
    if (event.recurrence_rule) {
      const rule = RRule.fromString(event.recurrence_rule);
      const instances = rule.between(viewStart, viewEnd, true);
      instances.forEach(date => {
        expanded.push({ ...event, event_start: date, isRecurring: true });
      });
    } else if (!event.is_someday) {
      expanded.push(event);
    }
  }
  return expanded;
}
```

Memoize with `useMemo` keyed on `[events, viewStart, viewEnd]`.

**CalendarView (C1-010):**
- **TV (useDeviceType === 'tv'):** Week-list/agenda view. Shows events for current week as a vertical list. "Today" jump button (`.tv-focusable`). Left/Right header arrows page between weeks.
- **Mobile:** Full month grid with day cells + week view toggle. Events shown as colored dots/pills.

**EventCard:** Color-coded by assignee:
- `kid_id` matches Quinn → amber border/badge
- `kid_id` matches Cora → purple border/badge
- `kid_id` is null (family-wide) → emerald border/badge

All event cards `.tv-focusable` on TV.

**SomedayBucket:** Separate section below calendar for events where `is_someday = true`. Rendered as a simple list. "Someday" label with ✨ icon.

### Task 9: EarlyBirdBanner (Display Only)
**Spec Reference:** §5.1
**Creates:** `src/components/academy/EarlyBirdBanner.jsx`

Animated gradient banner displayed during the Early Bird window (5:00-8:30 AM ET). Uses `clockService.js` to check current ET time.

**Display only in this phase.** The actual multiplier logic lives in the `submit_quiz` RPC and will be wired in Phase 05. This phase just shows/hides the banner and exposes an `isEarlyBird` flag for other components.

```javascript
export function EarlyBirdBanner() {
  const isEarlyBird = useEarlyBirdWindow(); // check clockService
  if (!isEarlyBird) return null;
  return (
    <div className="bg-gradient-to-r from-amber-400 to-rose-400 ...">
      🌅 Early Bird Active — Bonus rewards on quizzes!
    </div>
  );
}
```

**clockService.js:** Utility for ET time calculations:
```javascript
export function getCurrentETHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })
  );
}

export function isEarlyBirdWindow() {
  const hour = getCurrentETHour();
  return hour >= 5 && hour < 9; // 5:00 AM - 8:59 AM ET (spec says 8:30 but 9 is the hour boundary)
}
```

### Task 10: Progressive Ramp
**Spec Reference:** §5.1, §2.5, C1-013
**Creates:** `src/components/admin/ProgressiveRamp.jsx`

**Parent-facing only (admin/ directory).** Hidden on TV.

Queries `weekly_completion_rate` view for each kid. If any kid has ≥80% completion:
1. Show "Ready to Grow!" badge next to kid's name
2. Present 3 random suggestions from `data/defaultChoreBank.json` (filter out already-active chores)
3. Each suggestion has a "+" button that calls `create-chore` Edge Function

Load the chore bank from the bundled JSON file:
```javascript
import defaultChores from '../../data/defaultChoreBank.json';
```

### Task 11: ChoreBuilder & RewardBuilder (Mobile CRUD)
**Spec Reference:** §5.1, C1-021
**Creates:** `src/components/admin/ChoreBuilder.jsx`, `src/components/admin/RewardBuilder.jsx`

**Mobile-only** — hidden when `useDeviceType() === 'tv'`.

**ChoreBuilder:** Form to add/edit/delete chore_definitions:
- Fields: title (text), frequency (daily/weekly/monthly select), xp_reward (number), coin_reward (number)
- Add → calls `create-chore` Edge Function
- Edit → calls `update-chore`
- Delete → calls `delete-chore` (soft delete)
- Also shows the chore suggestion bank for quick-add

**RewardBuilder:** Form to add/edit/delete rewards:
- Fields: title (text), cost (number), icon (emoji picker or text), max_per_day (number)
- Add → calls `create-reward` Edge Function
- Edit → calls `update-reward`
- Delete → calls `delete-reward` (soft delete)

Both builders use standard HTML form elements (text inputs, selects, buttons). These are fine on mobile — the no-input constraint only applies to TV.

---

## 4. Acceptance Criteria

### Chore Completion
- [ ] Daily chore visible in Quest Board → Enter checks it off
- [ ] Confetti fires at the chore card element on completion
- [ ] Gold toast: "✨ +[X] coins, +[Y] XP!"
- [ ] HeroStatsHUD updates with new coin/xp values
- [ ] Double-press within 1 second: only one completion (debounce)
- [ ] Same chore cannot be completed twice in same period (unique index)
- [ ] Weekly chore visible in "Weekly Raids" section
- [ ] Monthly chore visible in "Monthly Epics" section with premium styling

### Economy Integrity
- [ ] After 200 XP earned today: next chore awards 0 XP, still awards coins
- [ ] `complete_chore` with duplicate mutation_id returns 'already_processed'
- [ ] Coins never go below 0 (CHECK constraint holds)

### Cron & Reset
- [ ] Manual call to `perform_daily_reset`: completed chores → pending_approval
- [ ] `useCatchUpReset` on mount: if last_reset was yesterday, triggers reset automatically
- [ ] Multi-day catch-up: last_reset 3 days ago → all missed days processed
- [ ] Auto-approve: items pending > `auto_approve_hours` → approved automatically
- [ ] daily-reset Edge Function: responds correctly to hourly invocation (only fires at midnight ET)

### Approval & Claw-Back
- [ ] `approve-chore` Edge Function: sets status='approved'
- [ ] `reject-chore` Edge Function: sets status='rejected', reverses coins/xp on kid
- [ ] On kid login after rejection: toast "[Chore] wasn't approved — ask a parent why!"

### Reward Shop
- [ ] Rewards displayed with cost and daily limit
- [ ] Hold Enter 2s → progress indicator fills → purchase executes
- [ ] Release before 2s → purchase cancels, indicator resets
- [ ] Insufficient coins → error toast, no deduction
- [ ] Daily limit reached → "Limit reached for today!" toast

### Calendar
- [ ] TV: week-list shows events for current week
- [ ] TV: Left/Right pages between weeks
- [ ] TV: "Today" button jumps to current week
- [ ] Mobile: month grid renders
- [ ] Recurring event (weekly): appears on correct days within view window
- [ ] Events color-coded: Quinn=amber, Cora=purple, Family=emerald
- [ ] Someday bucket renders separately

### Progressive Ramp
- [ ] Kid at ≥80% weekly completion → parent admin shows "Ready to Grow"
- [ ] 3 random suggestions from chore bank (excluding active chores)
- [ ] Click "+" on suggestion → chore created via Edge Function

### CRUD Builders
- [ ] ChoreBuilder visible on mobile, hidden on TV
- [ ] Add chore → appears in Quest Board
- [ ] Edit chore → changes reflected
- [ ] Delete chore → disappears (soft delete, history preserved)
- [ ] RewardBuilder: same add/edit/delete flow for rewards

---

## 5. Constraints

### Hard Constraints
- ALL coin/xp mutations via RPCs (`complete_chore`, `redeem_reward`). Never write `kids.coins` directly.
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY`, not anon key
- RRULE expansion MUST be bounded to [viewStart, viewEnd] — never call `rule.all()`
- ChoreBuilder and RewardBuilder hidden on TV (useDeviceType check)
- No PIN session token validation yet — that's Phase 07. Add `// TODO Phase 07` comments.
- Do NOT implement quiz or reading features
- Do NOT implement the PIN pad or analytics dashboard

### Soft Constraints
- rrule.js version must be pinned in package.json (lock the current version)
- Edge Functions written in Deno/TypeScript
- Cron Edge Function checks ET timezone before executing — never hardcode UTC-4 offset
- Chore cards: premium visual distinction for Monthly Epics (gold border, epic badge per SOW F-013b)

---

## 6. Completion Protocol

### Files Created
| File | Purpose | Lines |

### Files Modified
| File | Changes | Why |

### Acceptance Criteria Results
| # | Criterion | Result | Evidence |

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |

### Edge Functions Deployed
| Function | Status | Auth Required | Notes |
|----------|--------|---------------|-------|
| daily-reset | deployed/deferred | None (cron) | |
| create-chore | deployed | None (Phase 07 adds token) | |
| ... | ... | ... | ... |

### Warnings for Next Phase
[Phase 05 (Quiz Engine) needs: useEconomy hook API shape, how confetti fires, how level-up events propagate. Phase 04 (Video) runs in parallel — note any shared file modifications.]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 75`
This is a large phase (11 Edge Functions + 10 components). Plan for 1-2 `--continue` cycles.

### Task Planning
1. Read spec §2.4, §2.5, §2.7, §4.2, §5.1, §7.1
2. Check Phase 02 completion: verify hooks API, context providers, offlineCache
3. Tasks 1-4 are hooks (infrastructure). Tasks 5-6 are Edge Functions (server). Tasks 7-11 are components (UI).
4. Deploy Edge Functions with `supabase functions deploy [name]`
5. Test chore flow end-to-end before moving to calendar/rewards

### Resumption Protocol (--continue)
1. Read this prompt
2. Check `PHASE-03-PROGRESS.md`
3. Check which Edge Functions are deployed (`supabase functions list`)
4. Check which components are implemented
5. Resume from first incomplete task

### Progress Tracking
Update `PHASE-03-PROGRESS.md` after each task.

## Skills Reference
Before building UI components (Tasks 7+):
- `view /mnt/skills/public/frontend-design/SKILL.md` — Design principles for quest cards, reward shop, calendar
