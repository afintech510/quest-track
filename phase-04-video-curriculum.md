# Phase 04: Video & Curriculum
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 02 (Core UI Shell)
**Implements:** F-004, F-005, F-006, F-007, F-008
**Recommended:** `claude --max-turns 50`
**⚡ Can run in parallel with Phase 03 (Quest Board & Economy)**

---

## 1. Context

You are executing **Phase 04: Video & Curriculum** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the curriculum browser and video lesson player. Kids navigate a module grid, select a lesson, watch an embedded YouTube video, and unlock the quiz after ≥85% watch time. You are NOT building the quiz engine (Phase 05), chore system (Phase 03), reading features (Phase 06), or admin tools (Phase 07).

**⚠️ TV FOCUS ISOLATION:** The YouTube IFrame API will try to capture D-pad focus. The transparent overlay div is the critical defense — without it, arrow keys navigate inside YouTube instead of the app. Test this thoroughly.

**Tech Stack:** React, Tailwind, YouTube IFrame API, Capacitor (WebView settings)
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 5.1 (component tree), 6.3 (YouTube integration), 6.4 (Capacitor config) are your primary references.

### What Already Exists
- Phase 00: Project scaffold, all dependencies, Capacitor Android shell
- Phase 01: Complete DB schema. Tables: `modules` (17 rows seeded), `lessons` (73 rows seeded with placeholder video IDs). Each lesson has `video_id`, `fallback_video_id`, `video_type`, `duration_seconds`.
- Phase 02: Core UI shell — useSpatialNav, useSupabase (with real-time subscriptions), ProfileSwitcher, HeroStatsHUD, Toast, useDeviceType, empty states. The app boots, profiles work, spatial nav works.

**Note:** This phase runs in parallel with Phase 03. Do NOT import or depend on anything from Phase 03 (no useEconomy, no chore components, no Edge Functions from Phase 03). The only shared dependency is Phase 02's core shell.

### What You're Building
The curriculum experience. A kid opens the Academy tab, sees a grid of 17 modules organized by subject (Math, ELA, Science, Social Studies). They select a module, pick a lesson, and watch an embedded YouTube video. The video is locked down — no escape to related videos, no YouTube UI interaction, no keyboard shortcuts inside the player. A progress bar tracks watch time, and the quiz unlock button appears only after ≥85% of the video has been watched. If YouTube fails, there's a fallback video and a skip-to-quiz option with reduced rewards.

---

## 2. Objective & Deliverables

### Objective
Kids can browse the NYS 3rd Grade curriculum by subject, select modules and lessons, watch embedded YouTube videos that are fully D-pad isolated, and unlock quiz access after watching ≥85% of the video duration. YouTube failures fall back gracefully.

### Deliverables
1. **`ModuleGrid.jsx`** — 4-subject grid with module cards — Spec §5.1
2. **`LessonPlayer.jsx`** — YouTube IFrame embed with overlay, progress tracking, and quiz unlock — Spec §5.1, §6.3
3. **MP4 fallback player** — For self-hosted video content — Spec §6.3
4. **Capacitor WebView config note** — `setMediaPlaybackRequiresUserGesture(false)` documentation — Spec §6.4
5. **Lesson selection flow** — Module → lesson list → player navigation

---

## 3. Implementation Instructions

### Task 1: Module Grid
**Spec Reference:** §5.1
**Creates:** `src/components/academy/ModuleGrid.jsx`

Fetch modules from Supabase (via useSupabase from Phase 02). Group by `subject` field:
- **Math** (5 modules): Multiply & Divide Quest, Place Value Power, Fraction Explorers, Measure & Graph Lab, Shape Builders
- **ELA** (4 modules): Story Detectives, Word Wizards, Compare & Connect, Fluency Builders
- **Science** (4 modules): Force & Motion Lab, Life Cycles & Traits, Habitats & History, Weather Watch
- **Social Studies** (4 modules): World Geography Explorer, Communities & Cultures, Government & Citizenship, Economics & Resources

Display as a grid of cards, organized by subject header. Each card shows:
- Module icon (from `module_icon` field)
- Module name
- Standard codes (from `standard_codes` text array)
- Number of lessons in the module

All module cards are `.tv-focusable`. Enter on a card navigates to the lesson list for that module.

Subject sections should use color coding:
- Math: blue/indigo accent
- ELA: green/teal accent
- Science: orange/amber accent
- Social Studies: purple/violet accent

### Task 2: Lesson List View
**Spec Reference:** §5.1
**Creates:** Part of `ModuleGrid.jsx` or a sub-component

When a module is selected, show its lessons as a vertical list:
- Lesson name
- Duration (formatted as MM:SS from `duration_seconds`)
- Standard code
- Completion status indicator (checkmark if quiz completed — query `quiz_attempts` for this kid + lesson)

Each lesson row is `.tv-focusable`. Enter on a lesson opens the LessonPlayer. Back/Escape returns to the module grid.

Implement a Back button (`.tv-focusable`) at the top of the lesson list. On TV, the Back button is the primary way to navigate up the hierarchy.

### Task 3: YouTube IFrame Embed with Overlay
**Spec Reference:** §6.3
**Creates:** `src/components/academy/LessonPlayer.jsx`

This is the most technically sensitive component in the phase. The YouTube player must be fully contained — no focus escape, no user interaction with YouTube UI.

**IFrame Setup:**
```javascript
// YouTube IFrame API parameters
const playerParams = {
  controls: 0,        // Hide player controls
  rel: 0,             // No related videos
  modestbranding: 1,  // Minimal YouTube branding
  disablekb: 1,       // Disable keyboard shortcuts inside player
  fs: 0,              // Disable fullscreen button
  iv_load_policy: 3,  // Hide video annotations
  origin: window.location.origin,
};
```

**Transparent Overlay (CRITICAL):**
Place a transparent `<div>` absolutely positioned over the entire IFrame. This div:
- Has `z-index` above the IFrame
- Is `pointer-events: auto` (captures all mouse events)
- Prevents the IFrame from receiving focus or keyboard input
- Does NOT have `.tv-focusable` class — it's invisible to spatial nav

```jsx
<div className="relative w-full aspect-video">
  <iframe
    id="yt-player"
    src={`https://www.youtube.com/embed/${videoId}?${new URLSearchParams(playerParams)}`}
    className="absolute inset-0 w-full h-full"
    allow="autoplay"
    tabIndex={-1}  // Prevent tab-focus into iframe
  />
  {/* Transparent overlay blocks all iframe interaction */}
  <div className="absolute inset-0 z-10" />
</div>
```

**YouTube IFrame API (for progress tracking and play/pause control):**

Load the YouTube IFrame API script dynamically:
```javascript
useEffect(() => {
  if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }
  window.onYouTubeIframeAPIReady = () => {
    playerRef.current = new window.YT.Player('yt-player', {
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  };
}, []);
```

**Custom Play/Pause Controls:**
Since the overlay blocks the IFrame, provide custom control buttons:
- Play/Pause button (`.tv-focusable`) — calls `player.playVideo()` / `player.pauseVideo()`
- Progress bar (visual only, not interactive — no scrubbing)
- Time display: current / total

### Task 4: Progress Tracking & Quiz Unlock Gate
**Spec Reference:** §6.3
**Creates:** Part of `LessonPlayer.jsx`

Poll `player.getCurrentTime()` every 5 seconds via `setInterval`:

```javascript
useEffect(() => {
  if (!playerRef.current) return;
  
  const interval = setInterval(() => {
    const current = playerRef.current.getCurrentTime?.();
    const duration = playerRef.current.getDuration?.();
    if (current && duration) {
      setWatchedSeconds(prev => Math.max(prev, current));
      const percentWatched = (watchedSeconds / duration) * 100;
      setProgress(percentWatched);
      
      if (percentWatched >= 85) {
        setQuizUnlocked(true);
      }
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [playerRef.current, watchedSeconds]);
```

**Anti-scrub protection:** Track `watchedSeconds` as the HIGH WATERMARK of `getCurrentTime()` — not the instantaneous value. If a kid scrubs to the end, `getCurrentTime()` jumps but `watchedSeconds` only advances based on actual sequential watching. The 85% gate uses `watchedSeconds / duration`, not the current playback position.

**Quiz unlock UI:**
- Before 85%: "Keep watching! [X]% complete" with progress bar
- At 85%: "🎯 Quiz Unlocked!" button appears (`.tv-focusable`, glowing animation)
- Enter on quiz button → navigates to quiz (placeholder in this phase — Phase 05 wires it)
- Store a `quizReady` callback that Phase 05 will consume

### Task 5: Fallback Video Support
**Spec Reference:** §6.3, C1-022
**Creates:** Part of `LessonPlayer.jsx`

**YouTube failure detection:**
1. Start a 10-second timeout when the IFrame loads
2. Listen for `onPlayerReady` event from YouTube API
3. If 10s passes without `onPlayerReady`:
   - If `fallback_video_id` exists on the lesson → swap to the fallback YouTube ID
   - If fallback also fails → show "Video unavailable" message

**Skip-to-quiz option:**
When video is unavailable, show:
- "📺 Video unavailable"
- "Skip to Quiz (reduced rewards)" button (`.tv-focusable`)
- Pressing this sets a flag `skippedVideo: true` that Phase 05 will use to apply reduced reward multiplier

### Task 6: Self-Hosted MP4 Fallback Player
**Spec Reference:** §6.3
**Creates:** Part of `LessonPlayer.jsx`

For lessons where `video_type === 'mp4'`:
- Render a standard HTML5 `<video>` element instead of YouTube IFrame
- Same progress tracking logic (poll `video.currentTime` every 5s)
- Same 85% gate
- No overlay needed (HTML5 video doesn't capture focus like YouTube)
- Custom play/pause controls (same pattern as YouTube custom controls)

```jsx
{lesson.video_type === 'mp4' ? (
  <video
    ref={videoRef}
    src={lesson.video_url}
    className="w-full aspect-video"
    tabIndex={-1}
  />
) : (
  <YouTubeEmbed videoId={lesson.video_id} ... />
)}
```

### Task 7: Capacitor WebView Configuration
**Spec Reference:** §6.4, C1-032
**Creates:** Documentation note + config update

For YouTube autoplay to work on Android TV WebView, the following must be set in the native Android code:

```java
// In android/app/src/main/java/.../MainActivity.java
// Add to onCreate or the WebView configuration:
webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
```

**For this phase:** Add a comment in `capacitor.config.ts` documenting this requirement. The actual native code modification happens in Phase 09 when the APK is built.

```typescript
// capacitor.config.ts
// NOTE: Android TV requires WebSettings.setMediaPlaybackRequiresUserGesture(false)
// for YouTube autoplay. This must be set in MainActivity.java during Phase 09 APK build.
```

### Task 8: Navigation Flow & Integration
**Spec Reference:** §5.1
**Modifies:** `src/App.jsx` (Academy tab content)

Wire the Academy tab (from Phase 02's tab bar) to render the curriculum flow:

```
Academy Tab
  ├── ModuleGrid (default view)
  │     └── [Select module] → Lesson List
  │           └── [Select lesson] → LessonPlayer
  │                 └── [85% watched] → Quiz Unlock button
  │                       └── [Enter] → Quiz placeholder (Phase 05)
  └── [Back] at any level → returns to parent view
```

Manage navigation state within the Academy tab:
```javascript
const [academyView, setAcademyView] = useState('modules'); // modules | lessons | player
const [selectedModule, setSelectedModule] = useState(null);
const [selectedLesson, setSelectedLesson] = useState(null);
```

Back navigation: provide a visible Back button at every non-root level. On TV, this is essential — there's no browser back button.

---

## 4. Acceptance Criteria

### Module Grid
- [ ] 17 modules render across 4 subject sections
- [ ] Each module card shows name, icon, standard codes, lesson count
- [ ] All module cards are `.tv-focusable` and navigable via D-pad
- [ ] Selecting a module shows its lesson list

### Lesson List
- [ ] Lessons for selected module render with name, duration, standard code
- [ ] Lessons show completion indicator (checkmark) if quiz_attempts exist for this kid + lesson
- [ ] Back button returns to module grid
- [ ] All lesson rows are `.tv-focusable`

### Video Player — YouTube
- [ ] YouTube video embeds with restrictive parameters (controls=0, rel=0, etc.)
- [ ] Transparent overlay prevents IFrame from receiving focus
- [ ] D-pad arrow keys navigate the app, NOT YouTube's internal controls
- [ ] Custom Play/Pause button works via YouTube JS API
- [ ] Progress bar fills based on watch time

### 85% Watch Time Gate
- [ ] At 84% watched: quiz button NOT visible
- [ ] At 85% watched: "Quiz Unlocked!" button appears with animation
- [ ] Scrubbing to end does NOT bypass the gate (high watermark tracking)
- [ ] Progress percentage shown to the kid

### Fallback & Error Handling
- [ ] YouTube fails to load within 10s → tries fallback_video_id
- [ ] Both YouTube IDs fail → "Video unavailable" + skip-to-quiz option
- [ ] Skip-to-quiz sets `skippedVideo: true` flag
- [ ] MP4 lesson (`video_type === 'mp4'`) renders HTML5 video player
- [ ] MP4 player has same 85% gate and progress tracking

### Navigation
- [ ] Module → Lesson → Player → Back works cleanly at every level
- [ ] Focus state is correct after navigation (first element in new view is focused)
- [ ] Back button is `.tv-focusable` at every non-root level

---

## 5. Constraints

### Hard Constraints
- YouTube IFrame MUST have a transparent overlay div blocking focus capture
- YouTube params MUST include: `controls=0, rel=0, modestbranding=1, disablekb=1, fs=0`
- IFrame MUST have `tabIndex={-1}` to prevent tab-focus
- Watch time gate uses HIGH WATERMARK of `getCurrentTime()`, not instantaneous position
- 85% threshold is non-negotiable — not 80%, not 90%
- Do NOT implement quiz UI or quiz generation — that's Phase 05
- Do NOT import anything from Phase 03 (this phase runs in parallel)
- Do NOT create Edge Functions in this phase

### Soft Constraints
- Video IDs in seed data are placeholders — the player should work with any valid YouTube ID
- Color coding for subjects is a design suggestion — follow frontend-design skill principles
- MP4 player can be minimal — it's a fallback for custom AI-generated content

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

### Blocked Items
| Task | Blocker | Required From |

### Integration Points for Phase 05
Document these so the Quiz Engine phase can wire in cleanly:
- How does the quiz unlock button signal "start quiz"? (callback, state, route)
- Where is `skippedVideo` stored? (state variable name, context)
- How does Phase 05 access the current `lessonId` from the player?
- What's the navigation pattern to return from quiz to lesson list?

### Warnings for Next Phase
[Phase 05 builds the quiz engine that plugs into the quiz unlock button. Note the integration seam.]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 50`
Focused scope — YouTube embed is the main complexity. Should complete in 1-2 sessions.

### Task Planning
1. Read spec §5.1, §6.3, §6.4
2. Check Phase 02 completion: verify useSupabase, useSpatialNav, Tab navigation
3. Tasks 1-2 are data display (safe). Task 3 is the critical YouTube embed. Test Task 3 thoroughly before proceeding.
4. Tasks 4-6 are player features. Task 7 is documentation. Task 8 is wiring.

### Resumption Protocol (--continue)
1. Check `PHASE-04-PROGRESS.md`
2. Check which components are implemented
3. Test YouTube embed if Task 3 is marked complete — verify overlay works
4. Resume from first incomplete task

### Progress Tracking
Update `PHASE-04-PROGRESS.md` after each task.

## Skills Reference
Before building UI components:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Design principles for module grid and player UI
