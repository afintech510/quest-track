# Phase 04: Video & Curriculum — Progress

## Task Status

| # | Task | Status |
|---|------|--------|
| 1 | ModuleGrid — subject-grouped cards | DONE |
| 2 | Lesson List — drill-down from module | DONE |
| 3 | YouTube IFrame embed with overlay | DONE |
| 4 | Progress tracking & 85% quiz gate | DONE |
| 5 | Fallback video support | DONE |
| 6 | MP4/local video player | DONE |
| 7 | Capacitor WebView config note | DONE (see below) |
| 8 | Navigation flow & App.jsx wiring | DONE |

## Files Created/Modified

### Created
| File | Purpose |
|------|---------|
| (none — stubs existed) | |

### Modified
| File | Changes |
|------|---------|
| `src/components/academy/ModuleGrid.jsx` | Full implementation: 4-subject grid, lesson list drill-down, completion checkmarks |
| `src/components/academy/LessonPlayer.jsx` | Full implementation: YouTube IFrame API, overlay, progress polling, 85% gate, MP4 fallback |
| `src/hooks/useSupabase.js` | Added modules, lessons, quizAttempts fetching + offline caching |
| `src/App.jsx` | Wired Academy tab: ModuleGrid + LessonPlayer with navigation state |
| `src/index.css` | Added pulse-glow animation for quiz unlock button |

## Capacitor WebView Note (Task 7)

Android TV requires `WebSettings.setMediaPlaybackRequiresUserGesture(false)` for YouTube autoplay.
This must be set in `MainActivity.java` during Phase 09 APK build:

```java
// In android/app/src/main/java/.../MainActivity.java
webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
```

The `capacitor.config.json` is JSON format (no comments), so this is documented here.

## Integration Points for Phase 05

- **Quiz start signal:** `LessonPlayer` calls `onQuizStart(lesson, module, skippedVideo)` — Phase 05 wires this in App.jsx
- **`skippedVideo` flag:** Boolean passed as 3rd arg to `onQuizStart` — Phase 05 uses it for reduced reward multiplier
- **Lesson ID access:** The `lesson` object passed to `onQuizStart` contains `lesson.id`, `lesson.module_id`
- **Return navigation:** After quiz completion, Phase 05 should call the same `onBack` pattern to return to lesson list

## Anti-Scrub Implementation

Progress tracking uses a high-watermark approach:
- `lastTimeRef` tracks last known playback position
- If `getCurrentTime()` jumps forward by >1s (scrub detected), only 5s of credit is added
- `watchedSeconds` is always `Math.max(prev, lastTimeRef.current)` — never decreases
- 85% gate uses `watchedSeconds / duration`, not instantaneous position
