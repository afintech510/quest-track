# Statement of Work: QuestTrack Academy
**Version:** 2.0
**Date:** July 6, 2026
**Prepared for:** Adam Larkin (personal/family use)
**Prepared by:** Spec Pipeline — Claude (Benchworks methodology)
**Review Cycle:** 1 complete — 47 raw findings, 33 merged, all approved

---

## 1. Executive Summary

QuestTrack Academy is a full home learning platform and family management system built for two children — Quinn (age 8) and Cora (age 8) — and their parents, Adam and Allie Larkin. The platform combines a complete NYS 3rd Grade curriculum (Mathematics, ELA, Science, Social Studies/History), a structured reading program with assigned books, a gamified chore management system, a family calendar, and a rewards economy.

The primary deployment target is a Smart TV (Android TV / Fire TV) via a Capacitor-wrapped APK with the React build **bundled inside the APK assets** for offline boot capability. The app is also accessible as a hosted web app on phones and tablets for full CRUD admin access. All data is persisted in Supabase (PostgreSQL free tier) with real-time multi-device sync.

The app must be fully navigable using only a standard TV D-Pad remote (spatial navigation). All text-creation admin tasks (adding chores, calendar events, book assignments) happen on the mobile/web interface — the TV is a consumption and management device. The curriculum engine is AI-powered (Anthropic API via Supabase Edge Functions) for quiz generation and reading comprehension, with embedded YouTube educational videos and AI-generated custom content. The architecture is grade-agnostic, supporting expansion into 4th grade and beyond.

---

## 2. Project Objectives

| ID | Objective | Success Metric | Priority |
|----|-----------|----------------|----------|
| O-001 | Deliver a complete, engaging NYS 3rd Grade curriculum across 4 subjects | 17 modules with 73 lessons, all traceable to NYS standard codes | MUST |
| O-002 | Gamify daily/weekly/monthly chores to increase kid participation | Both kids completing ≥80% of daily tasks within first 2 weeks of use | MUST |
| O-003 | Build a reading habit through structured book assignments with comprehension | Each kid completes at least 1 book per month with AI-generated chapter checkpoints | MUST |
| O-004 | Full Smart TV remote (D-Pad) operability | Every interactive element reachable and activatable via ArrowUp/Down/Left/Right/Enter only | MUST |
| O-005 | Real-time multi-device sync across TV, phones, and tablets | Changes on any device appear on all others within 2 seconds | MUST |
| O-006 | Give parents real-time visibility into academic progress and chore completion | Parent dashboard shows completion metrics, approval queue, quiz scores, reading progress, and coin balances | MUST |
| O-007 | Automatic chore resets with parent approval workflow | Daily/weekly/monthly resets transition chores to pending_approval. Parent reviews and confirms. | SHOULD |
| O-008 | Expand curriculum into 4th grade when kids master 3rd grade content | Grade-agnostic data model supports adding new grade levels without code changes | SHOULD |
| O-009 | Support adaptive quiz difficulty that adjusts to kid performance | AI quiz engine serves Bronze/Silver/Gold tiers based on prior scores | COULD |

---

## 3. Feature Set

### 3.1 Core Features (Must-Have)

| ID | Feature | Description | User Story | Acceptance Criteria |
|----|---------|-------------|------------|---------------------|
| F-001 | Smart TV Spatial Navigation Engine | Custom React hook handling ArrowUp/Down/Left/Right/Enter keydown events. Geometric focus routing between `.tv-focusable` elements. Auto-scroll into view. Per-profile focus memory restores last-focused element on profile switch. | As a kid using the TV remote, I want to navigate the entire app without a mouse or keyboard | Every interactive element is reachable. Focus ring visible at 10-foot distance. No element unreachable via D-pad. Focus state persists per profile. |
| F-002 | Kid Profile Switcher with Soft-Lock | Toggle between Quinn (🦁 Amber), Cora (🦄 Purple), and Family Hub (Emerald). Each profile protected by a kid-chosen 3-button D-pad sequence (e.g., Up-Up-Down) to prevent sibling sabotage. Parent can reset sequence via admin. | As a kid, I want my profile protected so my sibling can't mess with my coins or chores | Switching profiles requires soft-lock input. Each profile has independent XP, coins, level, reading progress, and chore status. Parent override available. |
| F-003 | Hero Stats HUD | Displays current Level, XP progress bar (0-100, daily cap 200), Gold coin balance, reading streak, and active grade level for the selected kid profile | As a kid, I want to see my level and coins so I feel motivated to earn more | XP bar fills proportionally. Level increments at 100 XP with queued modal celebration. Coins update in real-time via Supabase subscription. Daily XP cap of 200 enforced. |
| F-004 | NYS Mathematics Curriculum (5 modules) | Multiply & Divide Quest, Place Value Power, Fraction Explorers, Measure & Graph Lab, Shape Builders. Each module has embedded lesson videos + AI-generated quiz. Grade-agnostic data model with `grade_level` field. | As a kid, I want to learn math through videos and quizzes so I'm prepared for NYS tests | Each module displays lesson video, unlocks quiz after ≥85% watch time. Quiz graded instantly. Scores affect XP/coins via atomic RPC. |
| F-005 | NYS ELA Reading Curriculum (4 modules) | Story Detectives, Word Wizards, Compare & Connect, Fluency Builders. Lesson videos + AI quiz per module. | As a kid, I want to practice reading skills through interactive lessons | Same flow as F-004. ELA-specific question types (vocabulary, inference, theme). |
| F-006 | NYS Science Curriculum (4 modules) | Force & Motion Lab, Life Cycles & Traits, Habitats & History, Weather Watch. Lesson videos + AI quiz. | As a kid, I want to learn science through real video content and quizzes | Videos sourced from Crash Course Kids, SciShow Kids, etc. Same quiz flow. |
| F-007 | Social Studies & History Curriculum (4 modules) | World Geography Explorer, Communities & Cultures, Government & Citizenship, Economics & Resources. Embedded history threads (ancient civilizations, famous Americans, Long Island local history). | As a kid, I want to learn about world communities and history | Each module has video content + AI quiz. History integrated across modules. |
| F-008 | Video Lesson Player with Anti-Escape Controls | Embedded YouTube videos via IFrame API with restrictive parameters (`controls=0, rel=0, modestbranding=1, disablekb=1, fs=0`). Transparent overlay div blocks IFrame focus capture — play/pause controlled via custom TV buttons using YouTube JS API. Progress polled via `getCurrentTime()` every 5 seconds. Quiz unlocks only after ≥85% of video duration watched. Self-hosted MP4 fallback for custom content. | As a kid, I want to watch a lesson and then take a quiz | YouTube overlay prevents navigation escape. 85% watch requirement prevents scrub-to-end exploit. If YouTube fails to load within 10s, skip-to-quiz option with reduced rewards. |
| F-009 | AI Quiz Engine with Timeout Fallback | Anthropic API (Haiku 4.5) generates quiz questions at runtime, **proxied through Supabase Edge Functions** (API key never in client code). Full-screen "Summoning Quiz..." animation blocks D-pad during API call. Strict 4-second AbortController timeout — on timeout, seamlessly serve from pre-seeded fallback bank in Supabase. 3-5 multiple choice questions per quiz, aligned to NYS standard codes. Retry cap: 2 attempts per question; on second failure, reveal correct answer with encouraging explanation and award 50% partial XP. Quiz attempts stored in `quiz_attempts` table for parent analytics. | As a kid, I want fresh quiz questions that are fun and not too frustrating | Questions unique per session. 4s timeout with seamless fallback. Wrong answers show kid-friendly encouragement. Never stuck with zero rewards. All attempts persisted for parent review. |
| F-010 | Reading Guild — Book Library & Tracking | Curated library of 20 books across 3 difficulty tiers. Each book includes pre-written chapter summaries (2-3 sentences per checkpoint interval) stored in JSONB for AI context accuracy. Book assignment by parent via mobile/web admin. Per-kid progress tracking. "I finished Chapter X" manual log button triggers checkpoint. | As a parent, I want to assign books and track reading with real comprehension checks | Book progress tracked per kid. Chapter summaries prevent AI hallucination. Completion awards XP/Gold/Badge. |
| F-011 | Reading Guild — AI Chapter Checkpoints | At designated chapter intervals, kid presses "I finished Chapter X" button. AI generates comprehension questions using the book's stored chapter summary for that interval. Mix of recall, inference, vocabulary, prediction (open-response), and curriculum connection questions. | As a kid, I want to answer questions about what I'm reading to earn rewards | Checkpoint triggers on manual chapter log. AI prompt includes chapter summary for accuracy. All responses earn XP. |
| F-012 | Quest Board — Daily Tasks | Parent-configurable daily chores with status machine: `pending → completed → pending_approval → approved/rejected → reset`. Completing a chore triggers atomic coin/XP award via Supabase RPC. 1-second debounce prevents accidental D-pad double-toggle. `last_completed_at` timestamp prevents rapid uncheck/recheck exploit. Confetti fires on completion via canvas-confetti (hardware accelerated). Starts with 2-3 simple starter tasks. | As a kid, I want to check off my chores and see confetti and earn coins | Toggle works per-kid with debounce. XP/Gold awarded atomically. Confetti via Canvas (not DOM). State persists in Supabase. |
| F-013 | Quest Board — Weekly Raids | Parent-configurable weekly chores with higher rewards. Same mechanics as daily. Resets on Monday (configurable by parent). | As a kid, I want bigger challenges with bigger rewards | Weekly tasks display separately. Higher default XP/Gold. Reset day configurable. |
| F-013b | Quest Board — Monthly Epics | Parent-configurable monthly chores with highest rewards (deep clean bedroom, help with yard work). Resets on 1st of month. Visual distinction: gold border, epic badge. | As a kid, I want rare big-ticket quests that earn a ton of coins | Monthly section with premium styling. Highest XP/Gold tier. |
| F-013c | Progressive Quest Ramp ("Start Slow & Grow") | App ships with pre-built bank of ~30 age-appropriate chore suggestions. New users start with 2-3 daily, 1 weekly, 0 monthly. App tracks completion rate per kid from `chore_events` history table. At ≥80% weekly completion, parent sees "Ready to Grow" suggestion presenting 3 random chores from the suggestion bank — addable with one click. App never auto-adds chores. | As a parent, I want to start easy and gradually add more chores as kids prove consistency | Default starter set pre-loaded. "Ready to Grow" triggers at 80%+ over 7 days. Suggestion bank of 30 chores. Parent always decides. |
| F-014 | Automatic Chore Reset with Approval Queue | Chore resets handled by **Supabase Edge Function on cron schedule** (not client-side `setInterval`). At midnight Eastern: daily chores with `status: completed` transition to `status: pending_approval`. Weekly resets on Monday, monthly on 1st. Client-side `useCatchUpReset` hook runs on app mount and `visibilitychange` to handle missed resets (TV was asleep). Parent notification sent via Edge Function to parent's email/phone (not browser Notification API, which is unsupported on TV). Parent dashboard includes "Review Yesterday's Quests" approval queue where they approve (locking in coins) or reject (clawing back coins). All completions stored in `chore_events` history table — never lost. | As a parent, I want chores to reset automatically and give me a queue to confirm what was actually done | Cron fires at midnight ET. Catch-up runs on mount. History preserved. Parent sees approval queue. Notification goes to phone, not TV. |
| F-015 | Reward Shop with Purchase Protection | Coin-redeemable prizes. Each reward has `max_per_day` limit and `cost`. On TV: purchase requires "Hold ENTER 2 seconds" to prevent accidental D-pad purchases. Toast confirms redemption. Parent sees claims in admin. Economy rules: Early Bird multiplier applies to quizzes only (not chores). Daily XP cap of 200. | As a kid, I want to spend my earned coins on real-world rewards without accidentally buying things | Hold-to-confirm on TV. Daily redemption limits enforced. Purchase deducts coins atomically via RPC. |
| F-016 | Cora's Early Bird Sunrise Booster | Active 5:00 AM–8:30 AM. Time validated against **Supabase server timestamp** via lightweight RPC call on quiz submit (not local clock, preventing timezone spoofing). Falls back to local clock only when offline. Doubles XP and adds +20 Gold bonus on quiz completion only. Animated gradient banner displayed. | As Cora, I want bonus rewards for studying early in the morning | Server-side time validation. Multiplier scoped to quizzes only. Banner visible during window. |
| F-017 | Parent View — PIN Protected Admin (Device-Aware) | Custom HTML numpad (no native keyboard) for PIN entry on TV. PIN stored as **bcrypt hash** in Supabase `families` table. Verification via Supabase Edge Function with **rate limiting** (5 attempts, 5-minute lockout). **TV admin is read-only**: metrics dashboard, approval queue, toggles (morning boost, uncheck all, factory reset). **Mobile/web admin has full CRUD**: add/edit/delete chores, calendar events, rewards, book assignments. Device detection via screen width or `navigator.userAgent`. | As a parent, I want to manage settings on my phone and just review/approve on the TV | PIN hashed with bcrypt. Rate-limited. TV = read-only toggles. Mobile = full CRUD. Device-aware UI. |
| F-018 | Parent View — Analytics Dashboard with Approval Queue | Per-kid metrics: chores completed (by period), chores pending approval, quizzes completed with scores, books read, reading streak, combined gold balance. "Review Yesterday's Quests" approval queue. Analytics powered by pre-computed Supabase views or Edge Functions for performance. Quiz attempt history reviewable. | As a parent, I want a dashboard showing how my kids are doing and a queue to approve their work | Metrics computed from `chore_events`, `quiz_attempts`, `book_progress` tables. Approval queue shows pending chores with approve/reject. |
| F-019 | Family Calendar with Recurring Events & Bucket List | Full visual calendar view (week/month) showing extracurriculars, doctor appointments, school events, family activities. Per-kid color-coded entries (Quinn=amber, Cora=purple, Family=emerald). **Recurring events stored as iCal RRULE** strings with client-side instance expansion. Categories: extracurricular, medical, school, family, other. "Someday Bucket" list for undated wishlist items. Calendar CRUD on mobile/web only (text entry required). Kids see read-only calendar. All timestamps stored as **UTC with local display conversion**. | As a parent, I want a real calendar showing all family activities with recurring events and a bucket list | Calendar renders week and month views. Events color-coded. Recurring events expand correctly. Someday items separate. D-pad navigable. UTC storage with local display. |
| F-020 | Toast Notification System | Custom HTML toast popups for all feedback. No native `alert()` or `prompt()` anywhere in the app. Auto-dismiss after ~4 seconds. Styled per type (success, gold, info, error). | As a TV user, I want feedback notifications I can see without dismissing dialog boxes | Toasts stack in corner. Auto-dismiss. No native browser dialogs. |
| F-021 | Level-Up Celebration Modal with Event Queue | Full-screen modal with animation when a kid levels up. **Event queue (PubSub pattern)**: if multiple level-ups occur simultaneously (e.g., Monthly Epic + Early Bird), modals display sequentially — never stacked. Dismissible via D-pad Enter. | As a kid, I want a big celebration when I level up | Modal triggers at XP ≥ 100. Queue handles concurrent level-ups. D-pad dismissible. |
| F-022 | Canvas-Based Confetti Particle System | Hardware-accelerated confetti burst at the coordinates of the triggering element using `canvas-confetti` library. Fires on chore completion, quiz correct answer, reward purchase. Does NOT use DOM elements (performance issue on TV hardware). | As a kid, I want to see confetti when I accomplish something | canvas-confetti renders at element center. No DOM particles. Cleanup after animation. |
| F-023 | Supabase Real-Time Persistence with Offline Fallback | All app state persisted to normalized Supabase PostgreSQL tables. Real-time subscriptions push updates to all connected devices. **Offline fallback**: mutations queue in IndexedDB, replay on reconnect. `visibilitychange` listener force-reconnects Supabase channels on TV wake (handles WebSocket drops during sleep). Connection health monitor with auto-reconnect + periodic poll fallback. Coin/XP mutations use server-side RPC `increment()`/`decrement()` — never overwrite absolute balances. | As a family, I want data safe in the cloud with offline support when WiFi drops | State saves atomically. Real-time sync <2s. Offline queues in IndexedDB. TV wake reconnects. No data loss from concurrent edits. |
| F-024 | Multi-Device Sync | Changes on any device (TV, phone, tablet) propagate to all others via Supabase real-time subscriptions. Normalized schema bounds conflicts to row level — unrelated feature updates never overwrite each other. Coin/XP conflicts resolved via server-side atomic RPC (not last-write-wins on balances). | As a parent, I want to add a dentist appointment on my phone and see it on the TV | Supabase real-time delivers <2s sync. Conflict resolution: server RPC for currency, last-write-wins with timestamp for other fields. |

### 3.2 Enhancement Features (Nice-to-Have)

| ID | Feature | Description | Dependency | Deferred Until |
|----|---------|-------------|------------|----------------|
| F-050 | 4th Grade Curriculum Bridge | Unlock 4th grade modules when all 3rd grade modules in a subject are mastered | F-004–F-007 | v2 |
| F-051 | Adaptive Quiz Difficulty | AI auto-promotes kids from Bronze → Silver → Gold based on score history | F-009 | v2 |
| F-052 | "Ask the Professor" Mode | Free-form question box where kid types/speaks a question, Claude Haiku answers at age-appropriate level | F-009 | v2 |
| F-053 | Deep Dive Explorer Lessons | Optional bonus lessons unlocked after module completion | F-004–F-007 | v2 |
| F-054 | Cross-Curricular Connections | Bonus content linking books to curriculum modules | F-010, F-006 | v2 |
| F-055 | Sound Design | Audio feedback: level-up chimes, coin sounds, confetti pops | F-022, F-021 | v1.5 |
| F-056 | Streak Tracking with Bonuses | 7-day streak bonuses for daily chore completion and daily reading | F-012, F-010 | v1.5 |
| F-057 | Parent-Assigned Custom Books | Parent can add any book title to the library. AI generates checkpoint content on demand | F-010, F-017 | v1.5 |
| F-058 | Reading Streak Calendar | Visual calendar showing daily reading activity with streak indicators | F-010 | v1.5 |

### 3.3 Explicitly Out of Scope

- User authentication / multi-family login system (single family context, PIN-only parent gate)
- Custom backend server (Supabase Edge Functions handle all server-side logic)
- Real video recording or camera integration
- AI-generated video content served dynamically at runtime (videos pre-produced, not generated on demand)
- Payment processing or real-money transactions
- iOS/App Store deployment (Android TV APK sideloading only)
- Full WCAG accessibility compliance (TV remote + spatial nav is primary; screen reader support deferred)
- Content moderation (family-only app, no user-generated public content)
- Multiplayer or competitive features between kids (individual progress only)
- Native mobile app (phone/tablet access is via hosted web app, not native build)

---

## 4. Users & Personas

### Persona: Quinn (🦁)
- **Role:** 8-year-old student, primary app user
- **Goal:** Complete chores, watch lesson videos, pass quizzes, earn coins, buy rewards, read assigned books
- **Technical Comfort:** Low — uses TV remote or tablet touchscreen
- **Key Workflows:** Enter profile (soft-lock sequence) → check off chores → watch lesson → take quiz → browse reward shop → log reading chapter → complete checkpoint
- **Pain Points:** Gets bored with repetitive content, needs immediate visual feedback, short attention span for long instructions

### Persona: Cora (🦄)
- **Role:** 8-year-old student, primary app user (with Early Bird morning bonus)
- **Goal:** Fly through math challenges, read assigned books, earn coins for craft supplies and art rewards
- **Technical Comfort:** Low — uses TV remote or tablet touchscreen
- **Strengths:** Very quick at math, loves reading, creative and hands-on (crafts, drawing, making things)
- **Key Workflows:** Same as Quinn, plus early morning quiz sessions for bonus rewards. Likely to blast through math modules faster. Will engage deeply with Reading Guild and book reflections.
- **Pain Points:** May get frustrated easily when stuck — needs encouraging feedback on wrong answers (never punitive language). Shorter fuse for confusing UX or slow navigation. Benefits from immediate positive reinforcement and the ability to move on quickly when she's mastered something. Reward shop items should include creative/craft rewards (art supplies, drawing time, craft project outing) alongside standard screen time prizes. Quiz retry cap (2 per question) and partial XP ensure she's never stuck with zero progress.

### Persona: Adam & Allie (Schedule Keepers)
- **Role:** Parents, admin users
- **Goal:** Configure chores, assign books, monitor academic progress, manage family calendar, stock reward shop, review and approve daily completions
- **Technical Comfort:** Adam: High (developer). Allie: Medium (comfortable with apps)
- **Key Workflows:**
  - **On phone/tablet (primary admin device):** Add chores, create calendar events, assign books, stock reward shop, manage all text-entry CRUD
  - **On TV (secondary review device):** Enter PIN → review analytics dashboard → approve/reject yesterday's chore completions → toggle morning boost → view quiz scores and reading progress
- **Pain Points:** Need visibility without micromanaging. Want set-and-forget with occasional review. TV remote input for text is impossible — all text creation happens on phone. Daily approval queue must be quick (approve-all option). Need notification on phone when it's time to review, not on TV.

---

## 5. Competitive & Design References

| Reference | URL | What to Emulate | What to Avoid |
|-----------|-----|-----------------|---------------|
| Khan Academy Kids | khanacademy.org/kids | Subject organization, progress tracking, reward animations | Desktop-only UX, no TV support |
| ClassDojo | classdojo.com | Point economy, avatar customization, parent visibility | Classroom-centric, requires login |
| Epic! Reading | getepic.com | Book library, reading tracking, badges | Subscription paywall, no chore integration |
| Duolingo | duolingo.com | Streak mechanics, XP leveling, celebratory animations | Adult-oriented UI, no TV support |
| Existing prototype | (provided) | Dark slate TV aesthetic, spatial nav concept, confetti, PIN pad design | Vanilla JS/innerHTML, single-file, localStorage, fake video player |

---

## 6. Technical Constraints & Existing Infrastructure

### Target Stack
- **Frontend:** React (Vite build) with standard component tree, Tailwind CSS, Lucide-React icons
- **State:** Centralized React state mirroring Supabase, with IndexedDB offline cache
- **Database:** Supabase (free tier) — Normalized PostgreSQL with real-time subscriptions and RLS
- **Serverless:** Supabase Edge Functions (Deno) — API proxy for Anthropic, cron for resets/notifications, PIN verification
- **AI Integration:** Anthropic API (Haiku 4.5) accessed exclusively via Edge Functions (API key never in client)
- **Video:** YouTube IFrame API (embedded with overlay + restrictive params) + self-hosted MP4 for custom content
- **Particles:** canvas-confetti library (hardware-accelerated, not DOM-based)
- **TV Deployment:** Capacitor with React build **bundled inside APK assets** (loads offline, no hosted WebView dependency)
- **Web Hosting:** Netlify or Vercel for phone/tablet web access only
- **Build Tool:** Claude Code (Nimbalyst IDE on Windows)

### Constraints
- Supabase free tier only (500MB database, 50K MAU, 500K Edge Function invocations/month)
- No Supabase Auth for v1 — single family context with RLS scoped to `family_id`, PIN-only parent gate with bcrypt hash
- All interactive elements must work with D-Pad remote only (no mouse, no touch required) on TV
- No native `alert()`, `prompt()`, or `<input>` fields that trigger TV virtual keyboards
- All text-creation admin happens on mobile/web — TV is read-only admin
- API costs must stay under $5/month for normal family usage
- Content production budget: ~$171 one-time for AI video generation tools
- All timestamps stored as UTC with local display conversion
- No deadline pressure — quality over speed

---

## 7. Assets & Materials

| Asset | Status | Location/Notes |
|-------|--------|----------------|
| Working HTML prototype | Available | ~1,600 lines vanilla JS (reference only, not ported) |
| TV APK deployment guide | Available | Capacitor + Android Studio workflow documented |
| NYS curriculum research | Available | questtrack-curriculum-research.md + v2-expanded.md |
| Book list with chapter summaries | Needs creation | 20 books identified; 2-3 sentence summaries per checkpoint interval needed for AI context |
| YouTube video playlists | Needs curation | ~9 hours of curation work |
| AI-generated custom videos | Needs production | ~$171 / ~20-30 hours |
| Pre-built chore suggestion bank | Needs creation | ~30 age-appropriate chores in JSON |
| Fallback quiz question bank | Needs generation | ~50 questions per subject via Anthropic Batch API |
| Brand assets (logo, colors) | Defined in prototype | Rose-500 primary, Fredoka + Quicksand fonts, deep slate background |

---

## 8. Delivery Phases & Timeline

### Phase 1: Core Engine & Supabase Foundation
**Features:** F-001, F-002, F-003, F-020, F-021, F-022, F-023, F-024
**Deliverables:**
- Vite + React + Tailwind scaffold with standard component tree
- Supabase project setup, schema migration (families, kids tables), RLS policies
- `useSpatialNav` hook with geometric routing and per-profile focus memory
- Profile switcher with kid soft-lock (3-button sequence)
- Hero Stats HUD with real-time Supabase subscription
- Toast notification system (no native alerts)
- Level-up modal with event queue (sequential, never stacked)
- canvas-confetti integration (hardware-accelerated)
- `useVisibilityReconnect` hook (force-reconnect on TV wake)
- IndexedDB offline cache layer with mutation queue
- `award_currency` RPC function for atomic XP/coin updates

**Milestone:** App renders on localhost. Profiles switch with soft-lock. Spatial navigation works with arrow keys. State persists to Supabase and syncs across two browser tabs in <2 seconds. App loads offline from cached state.

### Phase 2: Quest Board & Reward Economy
**Features:** F-012, F-013, F-013b, F-013c, F-014, F-015, F-016, F-019
**Deliverables:**
- Schema migration: chore_definitions, chore_events, calendar_events, rewards, reward_redemptions, system_state
- Daily/Weekly/Monthly quest sections with full status machine (completed → pending_approval → approved/rejected → reset)
- 1-second debounce on chore toggle + `last_completed_at` cooldown
- `useCatchUpReset` hook — checks/executes missed resets on mount and `visibilitychange`
- Cron Edge Function: midnight reset + parent email notification
- Early Bird with server-side time validation via RPC
- Family Calendar: week/month views, color-coded entries, RRULE recurring events, Someday Bucket
- Reward shop with hold-to-confirm (2s ENTER) on TV, `max_per_day` limits
- Economy constants: daily XP cap 200, Early Bird scoped to quizzes only
- Progressive ramp: starter set of 2-3 daily chores, pre-built bank of ~30 suggestions, "Ready to Grow" prompt at 80%+ weekly completion

**Milestone:** Kids check chores with confetti, earn coins atomically. Chores reset at midnight, transition to pending_approval. Parent sees approval queue. Calendar displays recurring events. Daily XP cap enforced. Progressive ramp suggests new chores.

### Phase 3: Video Player & Curriculum Framework
**Features:** F-004, F-005, F-006, F-007, F-008
**Deliverables:**
- Schema migration: modules, lessons (grade-agnostic with `grade_level` FK)
- Module grid UI (4 subjects × 4-5 modules)
- YouTube IFrame embed with transparent overlay + restrictive params (no escape, no related videos)
- ≥85% watch time gate via progress polling
- Self-hosted MP4 fallback player
- Seed data: 17 modules, 73 lessons with video IDs

**Milestone:** Kid selects module → watches video → 85% progress unlocks quiz. D-pad cannot interact with YouTube UI. No content escape possible.

### Phase 4: AI Quiz Engine
**Features:** F-009
**Deliverables:**
- `generate-quiz` Edge Function proxying Anthropic (API key server-side only)
- Quiz UI with "Summoning Quiz..." full-screen loading blocker (blocks D-pad)
- 4-second AbortController timeout with seamless fallback to pre-seeded bank
- Retry cap: 2 attempts per question → reveal answer with encouraging explanation + 50% partial XP
- `quiz_attempts` table for persistence and parent analytics
- Fallback question bank seeded in Supabase (~50 per subject)
- Early Bird multiplier validated server-side on quiz submit

**Milestone:** Quiz generates unique questions. API timeout falls back seamlessly. Wrong answers show encouragement. After 2 failures, answer revealed with partial credit. All attempts persisted.

### Phase 5: Reading Guild
**Features:** F-010, F-011
**Deliverables:**
- Schema migration: books, book_progress, reading_checkpoints
- 20 books seeded with metadata + pre-written chapter summaries for AI context
- Book library UI (3 tiers)
- "I finished Chapter X" manual log button triggers checkpoint
- `generate-checkpoint` Edge Function with chapter summaries in prompt
- Checkpoint UI: comprehension + vocabulary + prediction + curriculum connection
- Book reflection + star rating
- Reading badges and streak tracking

**Milestone:** Kid logs chapter → AI generates accurate questions using chapter summary. Book completion awards badge + XP/coins. Reading streak increments on consecutive daily logs.

### Phase 6: Parent Control Deck
**Features:** F-017, F-018
**Deliverables:**
- Custom PIN pad with bcrypt verification via Edge Function (rate-limited: 5 tries, 5-min lockout)
- Device-aware admin: TV = read-only metrics + toggles + approval queue; Mobile/web = full CRUD
- Analytics dashboard with pre-computed Supabase views
- "Review Yesterday's Quests" approval queue (approve/reject with coin claw-back)
- Mobile CRUD builders: chores (with suggestion bank), calendar events, rewards, book assignments
- Emergency controls: force morning boost, uncheck all, factory reset (with confirmation)

**Milestone:** PIN works via D-pad numpad. Locks after 5 failures. Parent reviews approval queue. Text CRUD only on mobile/web. Metrics compute correctly from history tables.

### Phase 7: Content Production & Polish
**Deliverables:**
- YouTube playlist curation (13 modules × 3-5 videos)
- AI video production batch (Golpo, HeyGen, InVideo, ElevenLabs, Manim)
- Video IDs populated into Supabase lessons table
- Fallback quiz bank generated (50 questions/subject via Batch API)
- Chapter summaries written for all 20 books (2-3 sentences per checkpoint interval)
- Pre-built chore suggestion bank (30 items) seeded
- UI polish: animations, transitions, responsive layout, TV + mobile testing
- Capacitor APK build with bundled React assets
- Sideload test on Android TV / Fire Stick
- Data retention policy documented (archive >90 days or accept growth)
- Supabase backup procedure documented (pg_dump + free tier daily backups)

**Milestone:** All 17 modules have functioning video + quiz flow. APK boots offline, syncs when connected. Full family workflow tested: TV + phone simultaneously. Parent receives email notification at midnight.

---

## 9. Commercial Terms

Not applicable — personal/family build. Adam is the developer and sole stakeholder.

---

## 10. Assumptions & Dependencies

- Kids have access to the physical books in the Reading Guild list (purchased, library, or digital)
- YouTube videos remain available and are not taken down by content owners
- Anthropic API maintains Haiku 4.5 at current pricing ($1/$5 per MTok) or lower
- Supabase free tier remains available with current limits (500MB, 50K MAU, 500K Edge Function invocations)
- TV has reliable WiFi for initial setup and periodic sync (offline mode handles intermittent drops)
- AI-generated quiz content is educationally sound (parent spot-checks recommended via quiz_attempts history)
- Capacitor + Android Studio toolchain available on Adam's Windows machine
- Content production tools (Golpo, HeyGen, InVideo, ElevenLabs) maintain current pricing/features
- Android TV WebView supports WebSocket connections for Supabase real-time (tested on target hardware)

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| YouTube video removed/unavailable | Medium | Medium | Maintain fallback video IDs per module. Custom AI-generated videos as backup. Skip-to-quiz option. |
| Anthropic API down or rate limited | Low | Medium | 4-second timeout + pre-seeded fallback bank in Supabase. App functions without API. |
| Kids lose interest in gamification | Medium | High | Rotate reward shop items. Progressive ramp prevents overwhelm. Parent can adjust difficulty. Streak bonuses (F-056). |
| TV WebView drops Supabase WebSocket | Medium | Medium | `visibilitychange` reconnect. Auto-reconnect with periodic poll fallback. Connection health monitor. |
| Supabase free tier limits hit | Very Low | Medium | Family of 4 uses <1% of free tier. Monitor via dashboard. Upgrade to $25/mo Pro if ever needed. |
| Supabase service outage | Low | Medium | Offline fallback caches state in IndexedDB. App functional in read-only mode during outage. Mutations queue and replay. |
| Quiz content quality from AI | Low | Medium | Chapter summaries provide context (prevents hallucination). System prompt includes strict rules. Parent can review quiz_attempts. Feedback mechanism to flag bad questions. |
| Sibling sabotage of profiles | Medium | Medium | Kid soft-lock (3-button D-pad sequence). Parent can reset. Not high security — prevents casual interference. |
| Recurring calendar event complexity | Medium | Low | RRULE column with client-side expansion via rrule.js. Limit expansion window to prevent performance issues. |
| Scope creep into v2 features | Medium | Medium | SOW explicitly defers F-050–F-058. Architecture supports them, build does not implement. |
| Early Bird clock exploit | Low | Low | Server-side time validation via Supabase RPC. Local clock fallback only when offline. |
| Anthropic API key exposure | N/A (mitigated) | N/A | API key in Edge Function env vars only. Never in client bundle. |

---

## 12. Sign-Off

By confirming this SOW, the stakeholder agrees that the scope, features, and phases described above accurately represent the intended project.

- [ ] **SOW v2.0 Confirmed** — Adam Larkin — [Date]
