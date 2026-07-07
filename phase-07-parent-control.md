# Phase 07: Parent Control Deck
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 03 (Quest Board), Phase 05 (Quiz Engine), Phase 06 (Reading Guild)
**Implements:** F-017, F-018
**Recommended:** `claude --max-turns 50`

---

## 1. Context

You are executing **Phase 07: Parent Control Deck** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the PIN-protected parent admin system: the PIN pad, the session token flow, the analytics dashboard, the approval queue, device-aware admin routing, and emergency controls. You are also **retrofitting session token validation onto all parent-write Edge Functions** created in Phases 03 and 06.

**⚠️ AUTH RETROFIT:** Phases 03 and 06 deployed parent-write Edge Functions (create-chore, approve-chore, assign-book, etc.) WITHOUT session token validation — they all have `// TODO Phase 07` comments. This phase adds the auth gate. Every parent-write Edge Function must validate the `X-Session-Token` header before executing.

**Tech Stack:** React, Tailwind, Supabase Edge Functions (Deno), bcrypt (server-side via Edge Function)
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 3.3 (PIN session token flow), 4.2 (verify-pin, parent-write endpoints), 5.1 (component tree: admin/), 2.5 (analytics views) are your primary references.

### What Already Exists
- Phase 01: `families` table (pin_hash with bcrypt, pin_attempts, pin_locked_until, auto_approve_hours), `families_safe` view, `kid_analytics` view, `weekly_completion_rate` view. Need to add: `current_session_token` (uuid) and `session_expires_at` (timestamptz) columns to families table.
- Phase 02: Toast, useDeviceType, HeroStatsHUD, ConnectionIndicator, core shell
- Phase 03: QuestBoard, ChoreBuilder, RewardBuilder, ApprovalQueue placeholder, 11 parent-write Edge Functions (all with `// TODO Phase 07` token stubs), daily-reset cron, useEconomy, ProgressiveRamp
- Phase 05: QuizEngine, quiz_attempts persisted (for parent analytics)
- Phase 06: BookLibrary, BookAssigner, assign-book Edge Function (with TODO stub), reading_checkpoints

### What You're Building
The parent's command center. Parents enter a PIN on the custom numpad (works via D-pad on TV), which generates a 30-minute session token. That token gates all admin operations. On TV: read-only metrics dashboard, approval queue, and toggles. On mobile/web: full CRUD access to chores, events, rewards, and books. Analytics show per-kid completion rates, quiz scores, reading progress. The approval queue lets parents approve or reject yesterday's chores, with claw-back toasts for rejections.

---

## 2. Objective & Deliverables

### Objective
Parents authenticate via PIN, access a device-aware admin dashboard with analytics and approval queue, and all parent-write operations are gated by session tokens. TV shows read-only admin; mobile shows full CRUD.

### Deliverables
1. **Schema migration:** Add `current_session_token` and `session_expires_at` to families — New migration
2. **`verify-pin` Edge Function** — bcrypt verification, rate limiting, token generation — Spec §4.2
3. **Session token validation** — Shared middleware for all parent-write Edge Functions — Spec §3.3
4. **Retrofit all parent-write Edge Functions** — Add token validation — Spec §3.3
5. **`ParentPinPad.jsx`** — Custom numpad, D-pad navigable — Spec §5.1
6. **`AdminDashboard.jsx`** — Per-kid analytics from views — Spec §5.1
7. **`ApprovalQueue.jsx`** — Approve/reject pending chores — Spec §5.1
8. **`EventBuilder.jsx`** — Calendar CRUD (mobile-only) — Spec §5.1
9. **`StaleResetBanner.jsx`** — Warning if >26h since last reset — Spec §5.1
10. **Emergency controls** — Force morning boost, uncheck all, factory reset — Spec §5.1
11. **`update-family-settings` Edge Function** — Toggle settings — Spec §4.2
12. **`reset-soft-lock` Edge Function** — Parent resets kid's soft-lock — Spec §4.2
13. **Device-aware routing** — TV=read-only, mobile=full CRUD — Spec §5.1

---

## 3. Implementation Instructions

### Task 1: Schema Migration — Session Token Columns
**Spec Reference:** §3.3
**Creates:** `supabase/migrations/008_session_token.sql`

```sql
ALTER TABLE families ADD COLUMN current_session_token uuid;
ALTER TABLE families ADD COLUMN session_expires_at timestamptz;
```

Update the `families_safe` view to also exclude these columns:
```sql
CREATE OR REPLACE VIEW families_safe AS
SELECT id, family_name, force_morning_boost, auto_approve_hours, created_at
FROM families;
```

Run migration: `supabase migration up`

### Task 2: verify-pin Edge Function
**Spec Reference:** §4.2, §3.3
**Creates:** `supabase/functions/verify-pin/index.ts`

**Logic:**
1. Receive `{ pin: "1234" }` in request body
2. Fetch family record (using service_role key) — get `pin_hash`, `pin_attempts`, `pin_locked_until`
3. **Check lockout:** If `pin_locked_until > now()`, return 423 with remaining lockout time
4. **Compare:** Use bcrypt to verify pin against pin_hash
5. **On failure:**
   - Increment `pin_attempts`
   - If `pin_attempts >= 5`: set `pin_locked_until = now() + interval '5 minutes'`
   - Return 401 with `{ error: "Incorrect PIN", attempts_remaining: 5 - pin_attempts }`
6. **On success:**
   - Reset `pin_attempts = 0`, clear `pin_locked_until`
   - Generate session token: `crypto.randomUUID()`
   - Set `current_session_token = token`, `session_expires_at = now() + interval '30 minutes'`
   - Return 200 with `{ session_token: token, expires_at: timestamp }`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { pin } = await req.json();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch family
  const { data: family } = await supabase.from('families').select('*').single();

  // Check lockout
  if (family.pin_locked_until && new Date(family.pin_locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(family.pin_locked_until).getTime() - Date.now()) / 1000);
    return new Response(JSON.stringify({ error: 'Locked out', seconds_remaining: remaining }), { status: 423 });
  }

  // bcrypt compare (use Deno bcrypt)
  // Import: import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
  const valid = await bcrypt.compare(pin, family.pin_hash);

  if (!valid) {
    const newAttempts = (family.pin_attempts || 0) + 1;
    const lockout = newAttempts >= 5 ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
    await supabase.from('families').update({
      pin_attempts: newAttempts,
      pin_locked_until: lockout,
    }).eq('id', family.id);
    return new Response(JSON.stringify({
      error: 'Incorrect PIN',
      attempts_remaining: Math.max(0, 5 - newAttempts),
    }), { status: 401 });
  }

  // Success — generate token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await supabase.from('families').update({
    pin_attempts: 0,
    pin_locked_until: null,
    current_session_token: token,
    session_expires_at: expiresAt,
  }).eq('id', family.id);

  return new Response(JSON.stringify({ session_token: token, expires_at: expiresAt }), { status: 200 });
});
```

Deploy: `supabase functions deploy verify-pin`

### Task 3: Session Token Validation Middleware
**Spec Reference:** §3.3
**Creates:** `supabase/functions/_shared/validate-session.ts`

Shared utility imported by all parent-write Edge Functions:

```typescript
export async function validateSession(req: Request, supabase: any): Promise<boolean> {
  const token = req.headers.get('X-Session-Token');
  if (!token) return false;

  const { data: family } = await supabase
    .from('families')
    .select('current_session_token, session_expires_at')
    .single();

  if (!family) return false;
  if (family.current_session_token !== token) return false;
  if (new Date(family.session_expires_at) < new Date()) return false;

  return true;
}
```

### Task 4: Retrofit All Parent-Write Edge Functions
**Spec Reference:** §3.3
**Modifies:** All Edge Functions in `supabase/functions/` that have `// TODO Phase 07` comments

Add session validation to each parent-write Edge Function:

```typescript
import { validateSession } from '../_shared/validate-session.ts';

Deno.serve(async (req) => {
  const supabase = createClient(/* service_role */);

  // Session token gate
  const valid = await validateSession(req, supabase);
  if (!valid) {
    return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session token' } }), { status: 401 });
  }

  // ... existing logic
});
```

**Functions to retrofit:**
- create-chore, update-chore, delete-chore (Phase 03)
- create-reward, update-reward, delete-reward (Phase 03)
- approve-chore, reject-chore (Phase 03)
- create-calendar-event, update-calendar-event, delete-calendar-event (Phase 03)
- assign-book (Phase 06)
- update-family-settings (new, this phase)
- reset-soft-lock (new, this phase)

**Functions that do NOT need token validation:**
- daily-reset (cron — no client request)
- generate-quiz (kid-initiated)
- generate-checkpoint (kid-initiated)

Re-deploy all modified functions: `supabase functions deploy [name]`

### Task 5: ParentPinPad — Custom Numpad
**Spec Reference:** §5.1
**Creates:** `src/components/admin/ParentPinPad.jsx`

Full-screen modal with a custom HTML numpad — no native keyboard trigger.

**Layout (TV-optimized):**
```
[1] [2] [3]
[4] [5] [6]
[7] [8] [9]
[⌫] [0] [✓]
```

Each button is `.tv-focusable`. D-pad navigates the grid. Enter presses the focused button.

**State:** 4-digit PIN display as dots (●●●○ for 3 digits entered).

**Flow:**
1. Kid presses Admin button (🔒) in Header → ParentPinPad modal opens
2. Parent enters 4 digits via numpad
3. On 4th digit: auto-submit to verify-pin Edge Function
4. **Success:** Store token in React state (NOT localStorage — cleared on refresh is acceptable per §3.3). Close modal, show admin view.
5. **Failure:** Shake animation, "Incorrect PIN" toast, clear digits. Show remaining attempts.
6. **Lockout:** Show countdown timer. "Too many attempts. Try again in [X:XX]." Numpad disabled.
7. **Backspace (⌫):** Delete last entered digit.

**Token management:**
```javascript
const [sessionToken, setSessionToken] = useState(null);
const [tokenExpiresAt, setTokenExpiresAt] = useState(null);

// Check token validity before any admin action
const isSessionValid = () => {
  return sessionToken && new Date(tokenExpiresAt) > new Date();
};

// Include token in all parent-write fetch calls
const parentFetch = (url, options = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Session-Token': sessionToken,
    },
  });
};
```

### Task 6: AdminDashboard — Analytics
**Spec Reference:** §5.1, §2.5
**Creates:** `src/components/admin/AdminDashboard.jsx`

Query `kid_analytics` and `weekly_completion_rate` views. Display per-kid:

**Quinn's Stats / Cora's Stats (tabbed or side-by-side):**
- Level, XP, Coins (from kid_analytics)
- Chores approved (7 days) / pending approval
- Total quizzes taken, average quiz score %
- Books completed / currently reading
- Reading streak
- Weekly completion rate (from weekly_completion_rate view)
- Reading badges earned

**Quiz history (expandable):**
- Recent quiz_attempts for this kid (last 10)
- Show: lesson name, score, date, early_bird indicator
- Tappable on mobile for details; scrollable list on TV

Use Tailwind grid/flex for responsive layout. TV: larger cards, fewer per row. Mobile: compact list.

### Task 7: ApprovalQueue — Approve/Reject Chores
**Spec Reference:** §5.1
**Creates:** `src/components/admin/ApprovalQueue.jsx`

"Review Yesterday's Quests" section showing all `chore_events` with `status = 'pending_approval'` for the family.

Per item:
- Kid name + avatar
- Chore title
- Completed date/time
- XP/coins that were awarded
- **Approve** button (✅) — calls approve-chore Edge Function (with session token)
- **Reject** button (❌) — calls reject-chore Edge Function (with session token), triggers claw-back

Both buttons `.tv-focusable` on TV.

**Approve-all shortcut:** "Approve All" button at the top — batch-approves all pending. Important for the "set-and-forget" parent persona (SOW §4: "Daily approval queue must be quick").

**After rejection:** The reject-chore Edge Function claws back coins/xp. The next time the kid loads, the claw-back toast fires (implemented in Phase 03's ChoreCard). Verify this flow works end-to-end.

### Task 8: EventBuilder — Calendar CRUD
**Spec Reference:** §5.1
**Creates:** `src/components/admin/EventBuilder.jsx`

**Mobile/web only** — hidden on TV.

Form to add/edit/delete calendar events:
- Title (text input)
- Category (select: extracurricular, medical, school, family, other)
- Assign to (select: Quinn, Cora, Family)
- Start date/time (date + time inputs)
- End date/time
- Recurrence (optional: none, daily, weekly, monthly — maps to RRULE strings)
- Is Someday (checkbox — puts it in the Someday Bucket instead of the calendar)

CRUD calls go through the parent-write Edge Functions (with session token).

For recurrence, generate RRULE strings:
```javascript
function buildRRule(frequency, dayOfWeek) {
  if (frequency === 'weekly') return `FREQ=WEEKLY;BYDAY=${dayOfWeek}`;
  if (frequency === 'daily') return 'FREQ=DAILY';
  if (frequency === 'monthly') return 'FREQ=MONTHLY';
  return null;
}
```

### Task 9: Emergency Controls & Settings
**Spec Reference:** §5.1
**Creates:** Part of AdminDashboard or separate settings panel

**Force Morning Boost toggle:** Updates `families.force_morning_boost` via update-family-settings Edge Function. When on, Early Bird bonus applies all day.

**Auto-Approve Hours setting:** Number input (0 = disabled, default 48). Updates `families.auto_approve_hours`.

**Uncheck All:** Resets all current chore_events to status='reset' for a specific kid. Requires confirmation modal ("Are you sure? This will undo all of [Kid]'s chores for today.").

**Factory Reset:** Resets all kids to level 1, 0 XP, 0 coins, clears all chore_events and quiz_attempts. Requires double confirmation ("⚠️ This cannot be undone. Type RESET to confirm."). On mobile only — requires text input.

**StaleResetBanner (C1-029):** If `system_state.last_daily_reset` is >26 hours ago, show a warning banner at the top of the admin view: "⚠️ Daily reset may have been missed — check WiFi connection."

### Task 10: Device-Aware Admin Routing
**Spec Reference:** §5.1
**Modifies:** Admin section in `App.jsx`

After PIN verification:

**TV (useDeviceType === 'tv'):**
- AdminDashboard (read-only metrics)
- ApprovalQueue (approve/reject — these are button actions, not text input)
- Emergency toggles (force morning boost — toggle button)
- StaleResetBanner
- NO: ChoreBuilder, RewardBuilder, EventBuilder, BookAssigner, Factory Reset

**Mobile/Web:**
- Everything above PLUS
- ChoreBuilder (from Phase 03)
- RewardBuilder (from Phase 03)
- EventBuilder (new)
- BookAssigner (from Phase 06)
- ProgressiveRamp (from Phase 03)
- Factory Reset
- Auto-approve hours setting

Use `useDeviceType` to conditionally render. Tab-based navigation within admin: "Dashboard" | "Approve" | "Manage" (mobile-only tab with builders).

### Task 11: Wire Admin Button in Header
**Spec Reference:** §5.1
**Modifies:** `src/components/layout/Header.jsx`

Replace the placeholder admin button (from Phase 02) with the real flow:
1. Press 🔒 button → ParentPinPad opens
2. Correct PIN → Admin view renders (device-appropriate)
3. Session expires → return to kid view, toast "Session expired"
4. Explicit "Exit Admin" button → return to kid view

---

## 4. Acceptance Criteria

### PIN Authentication
- [ ] PIN pad renders with custom numpad (no native keyboard)
- [ ] D-pad navigates numpad grid on TV
- [ ] 4-digit PIN auto-submits
- [ ] Correct PIN (1234 from seed): session token returned, admin view opens
- [ ] Wrong PIN: shake, "Incorrect PIN" toast, attempts remaining shown
- [ ] 5 wrong PINs: "Locked out" with 5-minute countdown, numpad disabled
- [ ] After lockout expires: PIN attempts reset, can try again

### Session Tokens
- [ ] Token stored in React state (not localStorage)
- [ ] All parent-write Edge Functions reject requests without valid X-Session-Token header (401)
- [ ] All parent-write Edge Functions reject expired tokens (401)
- [ ] Token expires after 30 minutes (verify by checking server-side)
- [ ] Expired session: auto-redirect to PIN pad with "Session expired" toast

### Analytics Dashboard
- [ ] Per-kid metrics display: level, XP, coins, chores approved (7d), quizzes taken, avg score, books, streak
- [ ] Data comes from kid_analytics and weekly_completion_rate views
- [ ] Quiz history shows recent attempts with scores

### Approval Queue
- [ ] Pending chores listed with kid name, chore title, date, rewards
- [ ] Approve button → status changes to 'approved'
- [ ] Reject button → status changes to 'rejected', coins/xp clawed back
- [ ] Approve All → batch approves all pending items
- [ ] After rejection: kid sees claw-back toast on next login (verify end-to-end)

### Device-Aware Admin
- [ ] TV: dashboard + approval queue + toggles visible. No text-input builders.
- [ ] Mobile: all builders visible (ChoreBuilder, RewardBuilder, EventBuilder, BookAssigner)
- [ ] ProgressiveRamp visible on mobile admin

### Emergency Controls
- [ ] Force morning boost toggle works (verify via quiz submission outside early bird window)
- [ ] Auto-approve hours setting persists
- [ ] Uncheck All: confirmation required, then resets kid's chores
- [ ] Factory Reset: double confirmation, mobile-only, resets all data
- [ ] StaleResetBanner: appears when last_daily_reset > 26h ago

### Edge Function Retrofit
- [ ] All 13+ parent-write Edge Functions validate session token
- [ ] Calling any parent-write function without token → 401
- [ ] generate-quiz and generate-checkpoint still work without token (kid-initiated)
- [ ] daily-reset cron still works (no client request)

---

## 5. Constraints

### Hard Constraints
- PIN verification via bcrypt in Edge Function — never compare in client code
- Session token in React state only — never localStorage (per spec §3.3)
- Factory Reset requires text confirmation ("RESET") — mobile only, never on TV
- Every parent-write Edge Function MUST validate session token after this phase
- No text `<input>` elements rendered on TV viewport
- Admin button (🔒) accessible from any kid view via Header

### Soft Constraints
- PIN pad numpad layout: standard phone layout (1-2-3 top row)
- Analytics: prefer the pre-computed Postgres views over client-side calculation
- Approval queue: "Approve All" is a convenience — individual approve/reject is the core requirement
- Session token could be refreshed on activity (extend 30 min on each admin action) — nice to have, not required

---

## 6. Completion Protocol

### Files Created / Modified
[Standard tables]

### Schema Migrations
| Migration | Changes |
|-----------|---------|
| 008_session_token.sql | Added current_session_token, session_expires_at to families |

### Edge Functions Deployed / Retrofitted
| Function | New/Retrofit | Token Required |
|----------|-------------|----------------|
| verify-pin | New | No (generates token) |
| update-family-settings | New | Yes |
| reset-soft-lock | New | Yes |
| create-chore | Retrofit | Yes |
| [... all others] | Retrofit | Yes |
| generate-quiz | Unchanged | No |
| daily-reset | Unchanged | No (cron) |

### Acceptance Criteria Results
[Standard table]

### Warnings for Next Phase
[Phase 08 (Testing) needs to verify: token expiry, lockout timing, all Edge Function auth gates, end-to-end approval→claw-back→toast flow]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 50`
PIN + tokens + retrofit of 13 Edge Functions + dashboard + builders. May need 1-2 --continue.

### Task Planning
1. Read spec §3.3, §4.2, §5.1, §2.5
2. Task 1 (migration) first — need the columns before Edge Functions
3. Tasks 2-4 (auth infrastructure) — PIN, token validation, retrofit. Test auth flow before building UI.
4. Tasks 5-10 (UI components)
5. Task 11 (wiring) last

### Critical Test: After Task 4 (Retrofit)
Before proceeding to UI tasks, verify:
- `curl` to any parent-write Edge Function WITHOUT token → 401
- `curl` WITH valid token → success
- This confirms the auth gate works before building the UI that depends on it.

### Resumption Protocol (--continue)
1. Check `PHASE-07-PROGRESS.md`
2. Check which Edge Functions have been retrofitted
3. Check which UI components are implemented
4. Resume from first incomplete task

### Progress Tracking
Update `PHASE-07-PROGRESS.md` after each task.

## Skills Reference
Before building UI:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Design for PIN pad, dashboard layout, approval cards
