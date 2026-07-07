# Phase 05: AI Quiz Engine
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 03 (Quest Board & Economy) + Phase 04 (Video & Curriculum)
**Implements:** F-009, F-016 (Early Bird logic)
**Recommended:** `claude --max-turns 50`

---

## 1. Context

You are executing **Phase 05: AI Quiz Engine** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the AI-powered quiz generation system — the Edge Function that proxies Anthropic, the quiz UI with loading/fallback states, the submit_quiz RPC integration that awards coins/XP with Early Bird and daily cap, and the retry/partial credit mechanics. You are NOT building the reading guild (Phase 06), parent admin (Phase 07), or any chore features.

**⚠️ CRITICAL INTEGRATION POINT:** This phase is the convergence of the economy (Phase 03) and the curriculum (Phase 04). The quiz UI plugs into Phase 04's lesson player (quiz unlock button), and the rewards flow through Phase 03's economy hooks (submit_quiz RPC → coin/XP → HeroStatsHUD). Read both phases' completion reports before starting.

**Tech Stack:** React, Tailwind, Supabase Edge Functions (Deno), Anthropic API (Haiku 4.5), Supabase RPCs
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 2.4 (submit_quiz RPC), 4.2 (generate-quiz Edge Function, AI prompt requirements), 5.1 (component tree), 6.2 (Anthropic integration), 7.1 (error handling) are your primary references.

### What Already Exists
- Phase 01: `submit_quiz` RPC (handles Early Bird server-side, daily XP cap, idempotency, level-up), `fallback_questions` table (~200 questions seeded), `quiz_attempts` table, `processed_mutations` table
- Phase 02: useSupabase, Toast system, LevelUpModal event queue, ConfettiCanvas, offlineCache with mutation queue, useDeviceType, constants.js (DAILY_XP_CAP, EARLY_BIRD hours)
- Phase 03: useEconomy hook (pattern for RPC calls with mutation_ids), EarlyBirdBanner (display-only — you wire the logic), daily-reset cron (resets daily_xp_earned)
- Phase 04: ModuleGrid, LessonPlayer with quiz unlock button at ≥85% watch time, `skippedVideo` flag, navigation flow (module → lesson → player → quiz). Check `PHASE-04-COMPLETION.md` for integration points: how the quiz unlock button signals "start quiz", where `lessonId` is stored, the `skippedVideo` flag location.

### What You're Building
After a kid watches ≥85% of a lesson video, they press "Quiz Unlocked!" and enter the quiz. The app shows "Summoning Quiz..." with a magical loading animation, calls the generate-quiz Edge Function (which proxies Anthropic Haiku), and serves 3-5 fresh multiple-choice questions. If Anthropic times out (4s), fallback questions from the database load seamlessly. The kid answers, gets encouraging feedback, can retry up to 2 times per question (then the answer is revealed with partial credit), and earns coins/XP via the atomic submit_quiz RPC — with Early Bird bonus if it's morning. Every attempt is persisted for parent analytics.

---

## 2. Objective & Deliverables

### Objective
AI-generated quizzes serve fresh questions per session, fall back seamlessly on timeout, award coins/XP atomically with Early Bird and daily cap enforcement, persist all attempts for parent review, and provide encouraging, never-punitive feedback.

### Deliverables
1. **`generate-quiz` Edge Function** — Anthropic proxy with 4s timeout + fallback — Spec §4.2
2. **`QuizEngine.jsx`** — Quiz flow orchestrator (loading → questions → results) — Spec §5.1
3. **`QuizQuestion.jsx`** — Single MC question with retry cap and feedback — Spec §5.1
4. **`LoadingQuiz.jsx`** — "Summoning Quiz..." blocker with cancel button — Spec §5.1
5. **Submit flow** — Wire submit_quiz RPC with Early Bird, daily cap, idempotency — Spec §2.4
6. **Early Bird logic wiring** — Connect EarlyBirdBanner to submit_quiz response — Spec §5.1

---

## 3. Implementation Instructions

### Task 1: generate-quiz Edge Function
**Spec Reference:** §4.2, §6.2
**Creates:** `supabase/functions/generate-quiz/index.ts`

Supabase Edge Function that proxies quiz generation to Anthropic.

**Request shape:**
```json
{
  "kid_id": "uuid",
  "lesson_id": "uuid",
  "difficulty": "bronze",
  "question_count": 3,
  "device_type": "tv",
  "mutation_id": "uuid"
}
```

**Logic flow:**
1. **Idempotency check:** Query `processed_mutations` for `mutation_id`. If found, return cached quiz from `quiz_attempts`.
2. **Fetch context:** Query `lessons` + `modules` to get lesson name, module name, subject, standard codes.
3. **Call Anthropic Haiku** with strict system prompt (see below). **4-second AbortController timeout.**
4. **On success:** Parse response, validate structure (must have questions array with correct shape), return to client.
5. **On timeout/error (Tier 1 fallback):** Query `fallback_questions` table for this module. Select `question_count` random questions. Return with `{ source: 'fallback' }` flag.
6. **On Supabase fallback failure (Tier 2):** Return `{ source: 'client_fallback' }` — client loads from bundled JSON.

**Anthropic API call:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4000);

try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: QUIZ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildQuizUserPrompt(lesson, module, difficulty, questionCount) }],
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  // ... parse response
} catch (err) {
  clearTimeout(timeout);
  // Fallback to database
}
```

**AI System Prompt (C1-026 — CRITICAL TONE REQUIREMENTS):**
```
You are a friendly quiz creator for 3rd grade students (age 8-9). 

RULES:
- Reading level: 3rd grade (simple vocabulary, short sentences)
- Tone: encouraging, curious, celebratory. Use phrases like "Great thinking!", "Almost there!", "You're learning so much!"
- NEVER use: "wrong", "incorrect", "failed", "you should have known", "that's not right"
- Instead say: "Not quite!", "Let's try again!", "Close! Here's a hint..."
- Each question: 4 options (A, B, C, D), exactly one correct
- Explanation for correct answer: max 2 sentences, age-appropriate, positive
- Questions must align with the provided NYS standard code
- Difficulty: bronze (basic recall), silver (application), gold (analysis)
- All questions MUST be multiple choice — no open response, no fill-in-the-blank

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "...",
      "standard_code": "NY-3.OA.1"
    }
  ]
}
```

**User prompt builder:**
```
Generate ${questionCount} ${difficulty}-level multiple choice questions about "${lesson.lesson_name}" for the "${module.module_name}" module.
Subject: ${module.subject}
NYS Standard: ${module.standard_codes.join(', ')}
```

Deploy: `supabase functions deploy generate-quiz`

Set secrets:
```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Task 2: LoadingQuiz — "Summoning Quiz..." Blocker
**Spec Reference:** §5.1, C1-026
**Creates:** `src/components/shared/LoadingQuiz.jsx`

Full-screen overlay during quiz generation. Blocks D-pad navigation (no `.tv-focusable` elements behind it).

- Animated magical loading: spinning sparkles, pulsing orb, or similar whimsical animation
- Text: "Summoning Quiz..." in Fredoka font
- **Cancel/back button** (`.tv-focusable`) — "← Back to Lesson". Aborts the request and returns to the lesson player.

The cancel button uses the client-side AbortController:
```javascript
const abortRef = useRef(new AbortController());

const onCancel = () => {
  abortRef.current.abort();
  navigateBackToLesson();
};
```

### Task 3: QuizEngine — Quiz Flow Orchestrator
**Spec Reference:** §5.1
**Creates:** `src/components/academy/QuizEngine.jsx`

Manages the full quiz lifecycle:

```
States: loading → active → results
```

**Loading state:**
1. Show LoadingQuiz overlay
2. Generate mutation_id via `crypto.randomUUID()`
3. Call generate-quiz Edge Function with **client-side 6-7s AbortController** (wraps the full round trip, not just Anthropic's 4s server timeout — C1-028)
4. **In-flight ref guard (C1-028):** If a request is already in-flight, don't send another. Prevents double-tap on "Quiz Unlocked!" button.

```javascript
const inFlightRef = useRef(false);

const startQuiz = async (lessonId) => {
  if (inFlightRef.current) return; // Guard
  inFlightRef.current = true;
  
  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), 7000); // 7s client timeout
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-quiz`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid_id, lesson_id: lessonId, difficulty: 'bronze', question_count: 3, device_type: deviceType, mutation_id }),
      signal: controller.signal,
    });
    clearTimeout(clientTimeout);
    
    const data = await response.json();
    
    if (data.source === 'client_fallback') {
      // Tier 2: load from bundled JSON
      const fallbacks = await loadClientFallback(moduleId);
      setQuestions(fallbacks);
    } else {
      setQuestions(data.questions);
    }
    setState('active');
  } catch (err) {
    clearTimeout(clientTimeout);
    // Client-side fallback (Tier 2)
    const fallbacks = await loadClientFallback(moduleId);
    setQuestions(fallbacks);
    setState('active');
  } finally {
    inFlightRef.current = false;
  }
};
```

**Client fallback loader (Tier 2):**
```javascript
import fallbackBank from '../../data/fallbackQuizBank.json';

function loadClientFallback(moduleId) {
  const moduleQuestions = fallbackBank.filter(q => q.module_id === moduleId);
  // Shuffle and take 3
  return shuffleArray(moduleQuestions).slice(0, 3);
}
```

**Active state:** Render QuizQuestion components one at a time. Track answers, scores, retries.

**Results state:** Show summary — score, XP earned, coins earned, Early Bird bonus (if applicable). Confetti on good performance. "Back to Lessons" button.

### Task 4: QuizQuestion — Single Question with Retry
**Spec Reference:** §5.1, §4.2
**Creates:** `src/components/academy/QuizQuestion.jsx`

Renders one MC question at a time. 4 option buttons (A-D), all `.tv-focusable`.

**Retry mechanics:**
- Wrong answer (attempt 1): Show encouraging feedback — "Not quite! Try again! 💪" with explanation hint. Options reshuffled visually (not the correct_index — just the display order). The wrong answer is NOT dimmed (kid can try it again if they want).
- Wrong answer (attempt 2): Reveal correct answer — "The answer is [X]! [explanation]". Award 50% partial XP. Auto-advance to next question after 3 seconds (or Enter to advance).
- Correct answer (any attempt): "🎉 Amazing!" + explanation. Award full XP. Confetti burst. Auto-advance after 2 seconds.

Track per-question: `{ questionIndex, attempts, selectedIndex, isCorrect }`

**Tone enforcement (C1-026):**
- NEVER display "Wrong!" or "Incorrect!" or ❌
- Use: "Not quite!", "Almost!", "Let's try again!", "Close!"
- Correct: "🎉 Amazing!", "You got it! 🌟", "Great thinking! ⭐"
- Revealed answer: "Here's the answer! [explanation]" — always positive

### Task 5: Submit Quiz Results
**Spec Reference:** §2.4
**Creates:** Part of `QuizEngine.jsx` (results handler)

After all questions answered, call `submit_quiz` RPC via Supabase:

```javascript
const submitResults = async () => {
  const mutationId = crypto.randomUUID();
  const score = answers.filter(a => a.isCorrect).length;
  const maxScore = questions.length;
  
  const { data, error } = await supabase.rpc('submit_quiz', {
    p_kid_id: activeKid.id,
    p_lesson_id: selectedLesson.id,
    p_answers: JSON.stringify(answers),
    p_questions: JSON.stringify(questions),
    p_score: score,
    p_max_score: maxScore,
    p_difficulty_tier: 'bronze',
    p_mutation_id: mutationId,
  });
  
  if (data?.status === 'success') {
    setResults({
      score,
      maxScore,
      xpAwarded: data.xp_awarded,
      coinsAwarded: data.coins_awarded,
      earlyBirdActive: data.early_bird_active,
      leveledUp: data.leveled_up,
    });
    
    if (data.leveled_up) {
      // Trigger level-up modal via event system from Phase 02
    }
    
    // Fire confetti if score > 50%
    if (score > maxScore / 2) {
      fireConfetti(resultsCardRef.current);
    }
    
    setState('results');
  }
};
```

**Offline handling:** If offline, queue the submission in offlineCache with mutation_id. Show optimistic results (calculate locally). The mutation replays on reconnect, and the RPC's idempotency guard prevents duplicates.

**Reduced rewards for skipped video:** If `skippedVideo` flag is true (from Phase 04), apply a multiplier comment in the results display. The actual reward amount is calculated server-side in the RPC based on score — the skip-video penalty could be implemented as passing a reduced `p_score` or a flag. Mark with `// SPEC-AMBIGUITY: skipped-video reward reduction — applying 50% score penalty client-side` unless the spec defines the exact mechanism.

### Task 6: Early Bird Integration
**Spec Reference:** §2.4, §5.1
**Creates:** Updates to EarlyBirdBanner and quiz results display

The `submit_quiz` RPC already handles Early Bird server-side (checks `now() AT TIME ZONE 'America/New_York'`). This task wires the UI:

1. **EarlyBirdBanner** (from Phase 03): Already displays during the window. No changes needed.
2. **Quiz results screen:** If `data.early_bird_active === true`, show a special "🌅 Early Bird Bonus!" callout with the boosted amounts.
3. **No offline Early Bird (C1-017):** If the quiz was submitted while offline, the optimistic results show base rewards only. When the mutation replays online, the RPC determines the actual Early Bird eligibility. If the replay happens outside the window, no bonus. This is the intended behavior — the clean rule is "offline = base rewards."

### Task 7: Wire into Phase 04 Lesson Player
**Spec Reference:** §5.1
**Modifies:** `src/components/academy/LessonPlayer.jsx` (Phase 04)

Connect the quiz unlock button to QuizEngine:

1. Read Phase 04's integration points from `PHASE-04-COMPLETION.md`
2. When "Quiz Unlocked!" is pressed → transition to QuizEngine with `lessonId`, `moduleId`, `skippedVideo` flag
3. When quiz completes → "Back to Lessons" returns to the lesson list view
4. Update lesson completion indicator (checkmark) after successful quiz

Navigation flow update:
```
LessonPlayer → [Quiz Unlocked!] → LoadingQuiz → QuizEngine → [Results] → [Back to Lessons] → Lesson List
```

---

## 4. Acceptance Criteria

### Quiz Generation
- [ ] Quiz generates 3-5 unique MC questions per session
- [ ] Questions include standard_code matching the lesson's module
- [ ] Questions have exactly 4 options (A-D) with one correct
- [ ] Each question has an explanation (≤2 sentences)

### Timeout & Fallback
- [ ] Anthropic responds within 4s → fresh questions served
- [ ] Anthropic times out at 4s → fallback_questions table queried seamlessly (no error visible to kid)
- [ ] Supabase fallback fails → client JSON bank loaded (Tier 2)
- [ ] Total client timeout at 7s handles slow network gracefully
- [ ] Transition from loading → questions is seamless regardless of source

### Quiz UX
- [ ] "Summoning Quiz..." loading screen blocks D-pad behind it
- [ ] Cancel button on loading screen returns to lesson
- [ ] 4 answer options rendered, all `.tv-focusable`
- [ ] Wrong answer (attempt 1): encouraging message, no reveal
- [ ] Wrong answer (attempt 2): correct answer revealed + explanation + 50% partial XP
- [ ] Correct answer: celebration + explanation + full XP + confetti
- [ ] Tone: NO instances of "wrong", "incorrect", "failed" anywhere in quiz UI

### Economy Integration
- [ ] Quiz completion calls submit_quiz RPC with correct parameters
- [ ] Coins and XP update in HeroStatsHUD after quiz
- [ ] Daily XP cap: after 200 XP total today, quiz awards 0 additional XP (coins still awarded)
- [ ] Duplicate submission (same mutation_id): 'already_processed', no double-award
- [ ] Level-up triggered: modal fires via Phase 02 event system

### Early Bird
- [ ] Quiz at 6:30 AM ET: submit_quiz returns `early_bird_active: true`, doubled XP + 20 bonus coins
- [ ] Quiz at 10:00 AM ET: base rewards only
- [ ] Offline quiz: base rewards shown optimistically, no Early Bird
- [ ] Results screen shows "🌅 Early Bird Bonus!" callout when active

### In-Flight Guard
- [ ] Double-tap "Quiz Unlocked!": only one request fires
- [ ] Request in progress: second press is ignored

---

## 5. Constraints

### Hard Constraints
- Anthropic API key MUST be in Edge Function env vars — never in client code
- Quiz questions MUST be multiple-choice only (no open-response, even on mobile — C1-006 defers this)
- Timeout: 4s server-side (Anthropic), 6-7s client-side (full round trip)
- Retry cap: exactly 2 attempts per question, then reveal
- Partial credit: exactly 50% XP on revealed answer
- All quiz attempts MUST be persisted to quiz_attempts table via submit_quiz RPC
- Early Bird MUST be determined server-side only — no local clock trust
- Do NOT implement reading checkpoints — that's Phase 06 (similar pattern, different Edge Function)
- Do NOT implement PIN or admin features

### Soft Constraints
- AI prompt: follow §4.2 tone requirements exactly
- Difficulty tier defaults to 'bronze' for v1 (adaptive difficulty is F-051, deferred to v2)
- Loading animation should be whimsical and kid-friendly (magical theme matches "Summoning Quiz...")
- Question order within a quiz can be randomized

---

## 6. Completion Protocol

### Files Created
| File | Purpose | Lines |

### Files Modified
| File | Changes | Why |

### Edge Functions Deployed
| Function | Status | Secrets Required |
|----------|--------|-----------------|
| generate-quiz | deployed | ANTHROPIC_API_KEY |

### Acceptance Criteria Results
| # | Criterion | Result | Evidence |

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |

### Warnings for Next Phase
[Phase 06 (Reading Guild) follows the same AI Edge Function pattern — generate-checkpoint mirrors generate-quiz. Note: shared patterns, prompt differences, chapter summary context injection.]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 50`
Edge Function + quiz UI + fallback logic. Should complete in 1-2 sessions.

### Task Planning
1. Read spec §2.4, §4.2, §5.1, §6.2
2. Read `PHASE-03-COMPLETION.md` (economy hooks, EarlyBirdBanner)
3. Read `PHASE-04-COMPLETION.md` (quiz unlock integration points)
4. Task 1 (Edge Function) first — deploy and test independently
5. Tasks 2-4 (UI components) — build and test with mock data
6. Tasks 5-6 (economy + Early Bird) — wire to real RPCs
7. Task 7 (integration) — connect to Phase 04 lesson player

### Resumption Protocol (--continue)
1. Check `PHASE-05-PROGRESS.md`
2. Check if generate-quiz Edge Function is deployed (`supabase functions list`)
3. Check which UI components are implemented
4. Resume from first incomplete task

### Progress Tracking
Update `PHASE-05-PROGRESS.md` after each task.

## Skills Reference
Before building UI:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Design for quiz cards, loading screen
- `view /mnt/skills/public/product-self-knowledge/SKILL.md` — Verify Anthropic API model string and SDK patterns
