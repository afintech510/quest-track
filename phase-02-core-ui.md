# Phase 02: Core UI Shell
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 01 (Schema & DB Foundation)
**Implements:** F-001, F-002, F-003, F-020, F-021, F-022, F-023, F-024, C1-005, C1-009
**Recommended:** `claude --max-turns 75`

---

## 1. Context

You are executing **Phase 02: Core UI Shell** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the foundational UI layer — the app shell that every feature phase builds on top of. After this phase the app boots, connects to Supabase, shows live kid data, is navigable via D-pad, handles offline, and has the celebration/feedback systems working. You are NOT building chores, quizzes, books, calendar, or admin features.

**Tech Stack:** React 18+ (Vite), Tailwind CSS 3.4+, @supabase/supabase-js, canvas-confetti, Lucide React
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 5.1–5.3 (component tree, state management, spatial nav), 3.2 (RLS/trust model), 6.1 (Supabase integration), 7.1 (error handling) are your primary references.

### What Already Exists
- Phase 00: Vite + React + Tailwind scaffold, directory structure with placeholder files, all npm dependencies, Supabase CLI linked, Capacitor shell, dark theme config
- Phase 01: Complete Supabase schema — all 17 tables, indexes, constraints, 4 RPCs, RLS policies, views, seed data (2 kids, 17 modules, 73 lessons, 20 books, rewards, fallback questions). Check `PHASE-01-COMPLETION.md` for key UUIDs (family_id, kid IDs).

### What You're Building
The "app feels real" milestone. A kid picks their profile on the TV, enters their soft-lock sequence, sees their live stats, navigates everything with arrow keys, gets confetti on simulated completions, sees level-up modals, and the app survives a WiFi disconnect without losing state. This is the platform every feature phase plugs into.

---

## 2. Objective & Deliverables

### Objective
The app boots on localhost and Android TV emulator, connects to Supabase with live data, supports full D-pad spatial navigation, switches between kid profiles with soft-lock protection, displays real-time stats, handles offline gracefully with mutation queuing, and provides celebration feedback (confetti, level-up modals, toasts). Empty states render when data is absent.

### Deliverables
1. **`useSpatialNav` hook** — D-pad geometric routing with per-profile focus memory — Spec §5.3
2. **`useSupabase` hook** — Real-time subscriptions + state mirror from Supabase — Spec §5.2
3. **`useVisibilityReconnect` hook** — Force-reconnect WebSocket on TV wake — Spec §6.1
4. **`useDeviceType` hook** — TV vs mobile detection (userAgent + screen width) — Spec §5.1
5. **`useConnectionHealth` hook** — Online/offline/stale-reset indicator — Spec §7.1
6. **`offlineCache.js`** — IndexedDB cache + mutation queue with mutation_ids — Spec §5.2
7. **`supabaseClient.js`** — Supabase init from env vars — Spec §5.1
8. **`constants.js`** — XP cap (200), economy config, auto-approve default — Spec §5.1
9. **`ProfileSwitcher.jsx`** — Tab bar: Quinn (🦁 amber), Cora (🦄 purple), Family Hub (emerald) — Spec §5.1
10. **`SoftLockModal.jsx`** — 3-button D-pad sequence entry with visual feedback — Spec §5.1
11. **`SoftLockSetup.jsx`** — First-use sequence setup per kid (parent-assisted, sibling uniqueness) — Spec §5.1, C1-009
12. **`HeroStatsHUD.jsx`** — Level, XP bar, coins, reading streak, connection indicator — Spec §5.1
13. **`ConnectionIndicator.jsx`** — Online/offline/syncing badge — Spec §5.1, C1-029
14. **`Toast.jsx`** — Auto-dismissing notification system — Spec §7.1
15. **`LevelUpModal.jsx`** — Full-screen celebration with event queue (sequential, never stacked) — Spec §5.1
16. **`ConfettiCanvas.jsx`** — canvas-confetti wrapper firing at element coordinates — Spec §5.1
17. **`Header.jsx`** — Brand bar, profile tabs, admin button placeholder — Spec §5.1
18. **Empty state components** — EmptyQuestBoard, EmptyBookLibrary, EmptyCalendar, EmptyApprovalQueue — Spec §5.1, C1-005
19. **`FirstVisitHints.jsx`** — Lightweight navigation tutorial overlay for TV — Spec §5.1, C1-005
20. **`App.jsx`** — Route shell wiring all of the above together — Spec §5.1

---

## 3. Implementation Instructions

### Task 1: Supabase Client & Environment
**Spec Reference:** §5.1, §6.1
**Creates:** `src/lib/supabaseClient.js`, `src/lib/constants.js`

Initialize the Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. Export the client instance.

`constants.js` should export:
```javascript
export const DAILY_XP_CAP = 200;
export const XP_PER_LEVEL = 100;
export const AUTO_APPROVE_DEFAULT_HOURS = 48;
export const EARLY_BIRD_START_HOUR = 5;  // 5 AM ET
export const EARLY_BIRD_END_HOUR = 9;    // 8:30 AM ET (use 9 as hour boundary)
export const EARLY_BIRD_BONUS_COINS = 20;
export const SOFT_LOCK_LENGTH = 3;        // 3-button sequence
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 5;
export const TOAST_DURATION_MS = 4000;
export const SESSION_TOKEN_TTL_MINUTES = 30;
```

Read the family_id from `VITE_FAMILY_ID` env var.

### Task 2: Offline Cache with Mutation Queue
**Spec Reference:** §5.2
**Creates:** `src/lib/offlineCache.js`

Implement IndexedDB-backed offline cache using the browser's native IndexedDB API (no library needed for this scope):

- `cacheState(tableName, rows)` — store latest snapshot per table
- `getCachedState(tableName)` — retrieve cached rows
- `queueMutation(mutation)` — add to pending queue. Each mutation must include a `mutation_id` (UUID).
- `getPendingMutations()` — retrieve unsynced mutations
- `clearMutation(mutation_id)` — remove after successful sync
- `getPendingCount()` — for the sync indicator

Generate mutation_ids using `crypto.randomUUID()`.

Key implementation notes:
- IndexedDB operations are async — wrap in proper error handling
- The mutation queue is the bridge between offline and online. Phase 03+ will call `queueMutation` when offline and replay via RPCs when reconnected.

### Task 3: useSupabase Hook — Real-Time State Mirror
**Spec Reference:** §5.2, §6.1
**Creates:** `src/hooks/useSupabase.js`

This hook is the data backbone. It:

1. Fetches initial state from Supabase for the family (all kid data, chore events, etc.)
2. Subscribes to real-time changes on key tables: `kids`, `chore_events`, `calendar_events`, `book_progress`, `quiz_attempts`, `reward_redemptions`
3. Mirrors data into React state
4. On connection loss: falls back to IndexedDB cached state
5. On reconnect: replays queued mutations, re-fetches fresh state

Expose:
- `kids` — array of kid records
- `loading` — boolean
- `error` — error state
- `isOnline` — connection status
- `pendingMutationCount` — for sync indicator
- `refreshData()` — force re-fetch
- `subscribe(table, callback)` — real-time subscription helper

Use Supabase's channel-based realtime:
```javascript
const channel = supabase.channel('family-sync')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'kids' }, handleChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_events' }, handleChange)
  // ... more tables
  .subscribe();
```

### Task 4: useVisibilityReconnect Hook
**Spec Reference:** §6.1
**Creates:** `src/hooks/useVisibilityReconnect.js`

TV WebViews drop WebSocket connections during sleep. This hook:
1. Listens to `document.visibilitychange`
2. On `visible`: force-reconnect Supabase realtime channels
3. Trigger a fresh data fetch after reconnect
4. Also triggers catch-up reset check (Phase 03 will wire this)

```javascript
export function useVisibilityReconnect(supabase, onWake) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        supabase.realtime.reconnect();
        onWake?.();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [supabase, onWake]);
}
```

### Task 5: useDeviceType Hook
**Spec Reference:** §5.1
**Creates:** `src/hooks/useDeviceType.js`

Detect TV vs mobile/tablet:
```javascript
export function useDeviceType() {
  const [deviceType, setDeviceType] = useState('mobile');
  
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isTV = ua.includes('tv') || ua.includes('firetv') || ua.includes('android tv')
      || window.innerWidth >= 960; // large screen heuristic
    setDeviceType(isTV ? 'tv' : 'mobile');
  }, []);
  
  return deviceType;
}
```

Phase 07 (Parent Control) uses this to show/hide CRUD builders. Phase 05 uses it for device_type in quiz requests.

### Task 6: useConnectionHealth Hook
**Spec Reference:** §7.1, C1-029
**Creates:** `src/hooks/useConnectionHealth.js`

Tracks three states: `online`, `offline`, `syncing`. Also tracks stale-reset (>26h since last_daily_reset for parent banner — Phase 07 will consume this).

```javascript
export function useConnectionHealth(supabase, systemState) {
  const [status, setStatus] = useState('online'); // online | offline | syncing
  const [isStaleReset, setIsStaleReset] = useState(false);
  
  // Listen to navigator.onLine + Supabase channel state
  // When pending mutations > 0 and online, status = 'syncing'
  // Check system_state.last_daily_reset > 26h ago for stale banner
  
  return { status, isStaleReset };
}
```

### Task 7: Spatial Navigation Engine
**Spec Reference:** §5.3
**Creates:** `src/hooks/useSpatialNav.js`

Implement the geometric spatial navigation algorithm exactly as specified in §5.3. Key requirements:

- All interactive elements must have class `.tv-focusable`
- Geometric routing: find nearest element in the pressed direction using weighted distance (1.8x penalty for off-axis)
- Per-profile focus memory: when switching profiles, restore the last-focused element index for that profile
- Auto-scroll into view with `{ behavior: 'smooth', block: 'nearest' }`
- Handle Enter key as click on focused element
- Global keydown listener with `e.preventDefault()` for arrow keys and Enter
- Visible focus ring at 10-foot distance: use a Tailwind `ring` class or custom CSS that's large enough for TV viewing

Additional requirements not in the algorithm pseudocode:
- Skip elements with `[disabled]` attribute
- Handle elements that appear/disappear dynamically (re-query on state changes)
- If focused element is removed, reset to index 0

Expose: `{ focusIndex, setFocusIndex, focusMemory }`

### Task 8: Profile Switcher with Soft-Lock
**Spec Reference:** §3.2, §5.1, C1-003, C1-009
**Creates:** `src/components/profiles/ProfileSwitcher.jsx`, `src/components/profiles/SoftLockModal.jsx`, `src/components/profiles/SoftLockSetup.jsx`

**ProfileSwitcher:** Tab bar at the top with three profiles:
- Quinn 🦁 (amber theme — bg-amber-500/amber-400)
- Cora 🦄 (purple theme — bg-purple-500/purple-400)
- Family Hub 🏠 (emerald theme — bg-emerald-500/emerald-400)

Each tab is `.tv-focusable`. Pressing Enter on a tab triggers the soft-lock challenge (SoftLockModal) unless the kid hasn't set up a sequence yet (SoftLockSetup). Family Hub has no soft-lock.

**SoftLockModal:** Displays 3 empty circles. Kid enters a 3-button D-pad sequence (any combination of Up/Down/Left/Right). Each press fills a circle with the arrow icon. On complete:
- Hash the sequence (e.g., "up-up-down") with SHA-256 via Web Crypto API
- Compare to `kids.soft_lock_hash` from Supabase
- Match → switch profile, restore focus memory
- No match → shake animation, clear circles, "Try again!" toast

**SoftLockSetup (C1-009):** First-time setup when `soft_lock_hash` is null. Parent-assisted:
1. "Choose your secret code!" with visual instructions
2. Kid enters 3-button sequence
3. "Enter it again to confirm!"
4. If sequences match, hash and save to Supabase via direct update (or queue for offline)
5. Check against sibling's hash — if identical, prompt to choose a different one
6. "Forgot your code?" link → routes to parent PIN (placeholder in this phase, wired in Phase 07)

SHA-256 hashing:
```javascript
async function hashSequence(sequence) {
  const encoder = new TextEncoder();
  const data = encoder.encode(sequence.join('-'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Task 9: Hero Stats HUD
**Spec Reference:** §5.1
**Creates:** `src/components/profiles/HeroStatsHUD.jsx`

Displays for the active kid profile:
- **Level** badge (large, prominent)
- **XP progress bar** (0-100, fills proportionally, spec says daily cap 200 but XP per level is 100)
- **Gold coin balance** with coin icon
- **Reading streak** (days)
- **Connection indicator** component (from Task 6)

Subscribe to the `kids` real-time channel — when coins/xp change on another device, the HUD updates within 2 seconds.

When XP crosses 100: emit a level-up event (consumed by LevelUpModal). The RPC handles the math server-side, but the UI needs to detect the `leveled_up: true` response and trigger the modal.

Style for TV: large text (Fredoka font, 10-foot readable), high contrast against dark slate background.

### Task 10: Toast Notification System
**Spec Reference:** §7.1
**Creates:** `src/components/layout/Toast.jsx`

No native `alert()` or `prompt()` anywhere. Custom toast system:
- Stack in bottom-right corner (or top-right on TV for visibility)
- Auto-dismiss after ~4 seconds (use `TOAST_DURATION_MS` from constants)
- Types: `success` (green), `gold` (amber/coin icon), `info` (blue), `error` (red)
- Each toast slides in, auto-dismisses with fade-out
- Multiple toasts stack vertically
- Expose via React context: `useToast()` → `{ showToast(message, type) }`

No toasts should be `.tv-focusable` — they're display-only, not interactive.

### Task 11: Level-Up Modal with Event Queue
**Spec Reference:** §5.1
**Creates:** `src/components/shared/LevelUpModal.jsx`

Full-screen overlay with celebration animation when a kid levels up.

**Event queue (PubSub pattern):** If multiple level-ups occur (e.g., Monthly Epic + quiz in quick succession), modals display sequentially — never stacked. Use a queue:

```javascript
const [eventQueue, setEventQueue] = useState([]);
const [currentEvent, setCurrentEvent] = useState(null);

// When new level-up detected, push to queue
// When current modal dismissed, shift next from queue
// When queue empty, close overlay
```

Modal content: kid's name, new level number, big animated level badge, confetti fires behind it. Dismissible via Enter key (`.tv-focusable` dismiss button).

### Task 12: Confetti Canvas
**Spec Reference:** §5.1
**Creates:** `src/components/shared/ConfettiCanvas.jsx`

Wrapper around `canvas-confetti` library. Fires at the coordinates of a triggering element.

```javascript
import confetti from 'canvas-confetti';

export function fireConfetti(element) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { x, y },
    colors: ['#f59e0b', '#a855f7', '#10b981', '#f43f5e'],
    disableForReducedMotion: true,
  });
}
```

No DOM particles — canvas-confetti is hardware-accelerated. Cleanup happens automatically.

Expose via context or direct import. Phase 03 will call `fireConfetti(choreCardElement)` on chore completion.

### Task 13: Header & Layout
**Spec Reference:** §5.1
**Creates:** `src/components/layout/Header.jsx`

Top bar with:
- App branding ("QuestTrack Academy" in Fredoka)
- Profile tabs (ProfileSwitcher inline or referenced)
- Admin button (🔒 icon) — placeholder that shows "Admin PIN required" toast. Phase 07 wires this to ParentPinPad.
- All elements `.tv-focusable`

### Task 14: Empty States & First-Visit Hints
**Spec Reference:** §5.1, C1-005
**Creates:** `src/components/onboarding/EmptyQuestBoard.jsx`, `EmptyBookLibrary.jsx`, `EmptyCalendar.jsx`, `EmptyApprovalQueue.jsx`, `FirstVisitHints.jsx`

Each empty state: illustrated placeholder (use Lucide icons composited into a friendly illustration) with a message:
- EmptyQuestBoard: "No quests yet! A parent can add chores from their phone."
- EmptyBookLibrary: "No books assigned yet! Ask a parent to pick your first book."
- EmptyCalendar: "Nothing on the calendar this week!"
- EmptyApprovalQueue: "All caught up! No chores to review."

**FirstVisitHints:** On first app boot (detect via localStorage flag `questtrack_visited`), show a lightweight overlay with:
- "Use arrow keys to navigate" with arrow key icons
- "Press Enter to select" with Enter key icon
- "Pick your profile to get started!" pointing at ProfileSwitcher
- Dismissible with any key press. Sets `questtrack_visited = true`.

### Task 15: App Shell & Routing
**Spec Reference:** §5.1
**Creates:** Updates `src/App.jsx`, `src/main.jsx`

Wire everything together in `App.jsx`:

```
<SupabaseProvider>
  <ToastProvider>
    <SpatialNavProvider>
      <Header />
      <main>
        {activeProfile === null && <ProfileSwitcher />}
        {activeProfile && (
          <>
            <HeroStatsHUD kid={activeKid} />
            <MainContent activeTab={activeTab} />
          </>
        )}
      </main>
      <LevelUpModal />
      <FirstVisitHints />
    </SpatialNavProvider>
  </ToastProvider>
</SupabaseProvider>
```

**Tab navigation within a profile:** Once a kid is selected, show tabs for: Quest Board, Academy, Reading Guild, Calendar, Reward Shop. These render the relevant empty state component for now (content comes in later phases).

Tab bar is `.tv-focusable`. Left/Right arrows switch tabs. Content area shows the corresponding empty state.

Use React context for: active profile, active tab, toast system, confetti.

### Task 16: Dev-Only Remote Emulator
**Spec Reference:** §5.1
**Creates:** `src/components/layout/RemoteEmulator.jsx`

Floating D-pad overlay in bottom-left corner (dev mode only — hide via env var or `process.env.NODE_ENV`). Visual buttons for Up/Down/Left/Right/Enter that dispatch keyboard events. Helpful for testing spatial nav with a mouse during development.

---

## 4. Acceptance Criteria

### Navigation
- [ ] Arrow keys navigate all `.tv-focusable` elements
- [ ] Enter activates (clicks) the focused element
- [ ] Focus ring is visible at arm's length (large, high-contrast)
- [ ] Tab bar: Left/Right switches tabs within profile
- [ ] No element is unreachable via D-pad in any view
- [ ] Focus memory: switch to Cora, focus on tab 3, switch to Quinn, switch back to Cora → tab 3 is focused

### Profiles & Soft-Lock
- [ ] Selecting Quinn profile triggers SoftLockModal (if sequence set)
- [ ] Correct 3-button sequence → profile switches, theme changes to amber
- [ ] Wrong sequence → shake animation, "Try again!" toast
- [ ] First-time (no soft_lock_hash) → SoftLockSetup flow
- [ ] Setup: enter sequence twice → saved as SHA-256 hash to Supabase
- [ ] Identical sibling sequence rejected with "Choose a different code!" prompt
- [ ] Family Hub → no soft-lock, theme changes to emerald

### Live Data
- [ ] HeroStatsHUD shows Quinn's level, XP, coins, streak from Supabase
- [ ] Change Quinn's coins via Supabase SQL → HUD updates within 2 seconds
- [ ] Switch to Cora → HUD shows Cora's stats

### Celebration Systems
- [ ] Toast: `showToast('Test!', 'success')` → green toast appears, auto-dismisses in ~4s
- [ ] Toast: multiple rapid toasts stack vertically
- [ ] Confetti: `fireConfetti(element)` → particles burst from element center
- [ ] Level-up modal: manually set Quinn's XP to 99, then trigger +5 XP → level-up modal appears
- [ ] Multiple level-ups queue: trigger two → first modal, dismiss → second modal

### Offline
- [ ] Disconnect WiFi → ConnectionIndicator shows "offline"
- [ ] App continues to display cached data
- [ ] Reconnect → ConnectionIndicator shows "online", data refreshes
- [ ] Pending mutations count shows in sync indicator when offline actions queued

### Empty States & Onboarding
- [ ] Quest Board tab shows EmptyQuestBoard (until Phase 03 populates it)
- [ ] Book Library tab shows EmptyBookLibrary
- [ ] Calendar tab shows EmptyCalendar
- [ ] First app load (clear localStorage) → FirstVisitHints overlay appears
- [ ] Any keypress dismisses hints, they don't reappear

### Device Detection
- [ ] Desktop browser: `useDeviceType` returns 'mobile' (default for dev)
- [ ] Android TV emulator (if available): returns 'tv'

---

## 5. Constraints

### Hard Constraints
- No native `alert()`, `prompt()`, or `confirm()` — use Toast system
- No `<input>` elements that trigger Android TV keyboard (soft-lock uses D-pad buttons, not text)
- All interactive elements must have `.tv-focusable` class
- Supabase anon key only — no service_role key in client code
- SHA-256 for soft-lock hashing (Web Crypto API), not bcrypt (that's server-side for PIN)
- Do NOT implement chore completion, quiz, reading, calendar CRUD, or admin features
- Do NOT create Edge Functions — that's Phase 03+

### Soft Constraints
- Use Tailwind utility classes exclusively (no custom CSS unless Tailwind can't express it)
- Component files: PascalCase. Hook files: camelCase with `use` prefix.
- All Supabase queries go through the `useSupabase` hook — no direct `supabase.from()` calls scattered in components
- Toast messages should match the tone from spec §7.1 (kid-friendly, actionable)

---

## 6. Completion Protocol

When all acceptance criteria pass, provide this structured report:

### Files Created
| File | Purpose | Lines |

### Files Modified
| File | Changes | Why |

### Acceptance Criteria Results
| # | Criterion | Result | Evidence |

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |

### Blocked Items
| Task | Blocker | Required From |

### Warnings for Next Phase
[Phase 03 and 04 build on this shell. Note: any patterns established, context providers exported, hooks API shapes, focus management quirks discovered]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 75`
This phase has 16 tasks with significant UI work. Plan for 1-2 `--continue` cycles.

### Task Planning
1. Read spec §5.1-5.3, §3.2, §6.1, §7.1
2. Check Phase 01 completion: verify Supabase tables exist, seed data present
3. Read `PHASE-01-COMPLETION.md` for key UUIDs
4. Execute Tasks 1-16 in order (Tasks 1-6 are infrastructure, 7-16 are components)
5. After Task 7 (spatial nav), test with arrow keys before proceeding — this underpins everything
6. After Task 15 (app shell), verify full integration
7. Run all acceptance criteria

### Resumption Protocol (--continue)
1. Read this prompt to re-establish context
2. Check `PHASE-02-PROGRESS.md` for completed tasks
3. Check which component files are fully implemented vs placeholder
4. Resume from first incomplete task
5. Do NOT refactor completed tasks

### Progress Tracking
Update `PHASE-02-PROGRESS.md` after each task:
```markdown
# Phase 02 Progress
- [x] Task 1: Supabase client + constants
- [x] Task 2: Offline cache
- [ ] Task 3: useSupabase hook
...
```

## Skills Reference
Before building any UI components (Tasks 8+), review:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Follow design principles for TV-first dark theme UI
