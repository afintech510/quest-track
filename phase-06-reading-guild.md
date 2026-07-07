# Phase 06: Reading Guild
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** Phase 05 (AI Quiz Engine)
**Implements:** F-010, F-011
**Recommended:** `claude --max-turns 50`

---

## 1. Context

You are executing **Phase 06: Reading Guild** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are building the book library, reading progress tracking, AI-generated chapter checkpoints, book reflections, and the book assignment workflow. You are NOT building the parent PIN system (Phase 07), admin dashboard, or any chore/quiz features.

**This phase closely mirrors Phase 05's patterns.** The generate-checkpoint Edge Function follows the same architecture as generate-quiz (Anthropic proxy, 4s timeout, fallback). The key difference: checkpoint prompts include the book's pre-written chapter summaries for AI context accuracy, and questions are scoped to what the kid just read.

**Tech Stack:** React, Tailwind, Supabase Edge Functions (Deno), Anthropic API (Haiku 4.5), Supabase RPCs
**Working Directory:** `questtrack-academy/`
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE. Sections 2.1 (books, book_progress, reading_checkpoints tables), 4.2 (generate-checkpoint Edge Function), 5.1 (component tree) are your primary references.

### What Already Exists
- Phase 01: `books` table (20 seeded with metadata + placeholder chapter_summaries), `book_progress` table (UNIQUE on kid_id+book_id, 1 starter book assigned per kid), `reading_checkpoints` table. `submit_quiz` RPC pattern for reference.
- Phase 02: Core UI shell, useSupabase, Toast, ConfettiCanvas, useDeviceType, offlineCache
- Phase 04: LessonPlayer patterns (video → quiz flow) as reference for the chapter → checkpoint flow
- Phase 05: generate-quiz Edge Function (reference architecture), QuizEngine/QuizQuestion patterns (reusable for checkpoint questions), AI prompt structure, fallback loading pattern

### What You're Building
The reading experience. Kids browse their assigned books in a tiered library, see their "Currently Reading" shelf, log chapter progress with "I finished Chapter X," take AI-generated comprehension checkpoints at designated intervals, and optionally write reflections (mobile/web only). Parents assign books from their phone and get auto-suggestions on completion. Reading streaks and badges track consistency.

---

## 2. Objective & Deliverables

### Objective
Kids can browse assigned books, log chapter progress, take AI-generated comprehension checkpoints that use the book's stored chapter summaries for accuracy, earn XP/coins for reading, and build reading streaks. Parents can assign books and see reading progress. TV shows MC-only checkpoints; reflections are mobile/web only.

### Deliverables
1. **`BookLibrary.jsx`** — Tiered book grid + "Currently Reading" shelf — Spec §5.1
2. **`BookDetail.jsx`** — Progress display + "I finished Chapter X" button — Spec §5.1
3. **`ChapterCheckpoint.jsx`** — AI comprehension questions (MC on TV) — Spec §5.1
4. **`BookReflection.jsx`** — Star rating + reflection text (mobile/web only) — Spec §5.1
5. **`generate-checkpoint` Edge Function** — Anthropic proxy with chapter summaries — Spec §4.2
6. **`BookAssigner.jsx`** — Parent mobile/web, assign + auto-suggest — Spec §5.1
7. **`assign-book` Edge Function** — Parent-write, creates book_progress — Spec §4.2
8. **Reading badges + streak tracking** — Spec §5.1

---

## 3. Implementation Instructions

### Task 1: BookLibrary — Tiered Grid with Currently Reading
**Spec Reference:** §5.1, C1-014
**Creates:** `src/components/reading/BookLibrary.jsx`

Fetch all books from Supabase. Display in sections:

**"Currently Reading" shelf (top, prominent):**
- Query `book_progress` WHERE `kid_id = activeKid.id AND status = 'reading'`
- Join with `books` for metadata
- Large cards showing cover, title, author, current chapter / total chapters, progress bar
- If empty: "No books in progress. Check your assigned books below!"

**Book Library by tier:**
- **Tier 1** (Beginner): books WHERE tier = 1
- **Tier 2** (Intermediate): books WHERE tier = 2
- **Tier 3** (Advanced): books WHERE tier = 3

Each book card shows: cover placeholder (use a colored gradient with first letter), title, author, tier badge, page count, genre. Cards are `.tv-focusable`.

**Status indicators per book:**
- No book_progress for this kid → "Not assigned" (dimmed)
- status = 'assigned' → "📖 Assigned!" badge
- status = 'reading' → progress bar showing current_chapter / total_chapters
- status = 'completed' → "✅ Completed!" with star rating if present

Enter on a book → navigate to BookDetail.

### Task 2: BookDetail — Progress & Chapter Logging
**Spec Reference:** §5.1
**Creates:** `src/components/reading/BookDetail.jsx`

Full detail view for a selected book:

**Header:** Book title, author, genre, tier, lexile, page count, cover

**Progress section:**
- "Chapter [X] of [Y]"
- Visual chapter progress bar
- Reading streak indicator: "🔥 [N] day streak!"

**"I finished Chapter X" button:**
- `.tv-focusable`, prominent call-to-action
- Shows the NEXT chapter number the kid would complete
- On press:
  1. Update `book_progress.current_chapter` via Supabase
  2. Check if this chapter is a checkpoint interval (from `books.checkpoint_chapters` JSONB array)
  3. If checkpoint: navigate to ChapterCheckpoint
  4. If not checkpoint: show "Great reading! 📚" toast, update streak
  5. If final chapter: transition book_progress.status to 'completed', trigger completion celebration

**Reading streak logic:**
- Compare `kids.last_read_date` with today
- If today: streak already counted
- If yesterday: increment `kids.reading_streak`, update `last_read_date`
- If older: reset streak to 1, update `last_read_date`
- Update via Supabase (direct update on kids table — this is a kid-initiated write that's safe because it only affects their own read date/streak, not economy values)

**Book completion flow:**
- Final chapter logged → status = 'completed'
- Show completion celebration: confetti + "📖 Book Complete!" modal
- Award XP/coins (define amounts in constants: e.g., 50 XP, 30 coins per book completion)
- Prompt for reflection (BookReflection) if on mobile
- Toast on TV: "Book finished! Add a review on your phone or tablet."
- Trigger auto-suggest for next book (stored in state, consumed by BookAssigner)

### Task 3: ChapterCheckpoint — AI Comprehension Questions
**Spec Reference:** §5.1, §4.2, C1-006
**Creates:** `src/components/reading/ChapterCheckpoint.jsx`

Reuses patterns from Phase 05's QuizEngine/QuizQuestion. Key differences:

**Device-aware question types (C1-006):**
- **TV (`useDeviceType() === 'tv'`):** MC-only questions. Same 4-option format as quizzes.
- **Mobile:** MC-only for v1 (open-response deferred to v1.5 per spec §12 backlog)

**Question types to request from AI:**
- Recall: "What happened when...?"
- Inference: "Why do you think the character...?"
- Vocabulary: "What does the word [X] mean in this story?"
- Prediction: "What might happen next?" (MC format — 4 options)
- Curriculum connection: "This is like what you learned in [module]..."

**Flow:**
```
ChapterCheckpoint
  ├── Loading ("Preparing questions about Chapter X...")
  ├── Questions (3-5 MC questions, same retry/partial credit as QuizQuestion)
  └── Results (XP/coins earned, "Keep reading!" encouragement)
```

Award XP/coins for checkpoint completion. Use a simplified version of submit_quiz or a direct Supabase insert to `reading_checkpoints` + update kids XP/coins via an RPC. If no dedicated checkpoint RPC exists, use `submit_quiz` with a flag or create a lightweight checkpoint-specific insert.

**Note:** The spec's `submit_quiz` RPC is lesson-specific (requires `p_lesson_id`). For reading checkpoints, you may need to either:
- Create a `complete_checkpoint` RPC (preferred — mirrors the pattern), or
- Insert directly into `reading_checkpoints` and update kids XP/coins via a simpler mechanism

Mark whichever approach you choose with a `// SPEC-AMBIGUITY: checkpoint reward mechanism` comment.

### Task 4: generate-checkpoint Edge Function
**Spec Reference:** §4.2
**Creates:** `supabase/functions/generate-checkpoint/index.ts`

Mirrors generate-quiz architecture. Key difference: **chapter summaries provide AI context.**

**Request:**
```json
{
  "kid_id": "uuid",
  "book_id": "uuid",
  "chapter_number": 6,
  "kid_name": "Cora",
  "device_type": "tv"
}
```

**Logic:**
1. Fetch book from DB, extract `chapter_summaries` JSONB for the given chapter range
2. Build Anthropic prompt with the chapter summary as context
3. Same 4s timeout + fallback pattern as generate-quiz
4. Fallback: pull from a generic set of reading comprehension questions (or from fallback_questions with a reading-specific module)

**AI System Prompt:**
```
You are a friendly reading companion for 3rd grade students (age 8-9).

You are generating comprehension questions about a chapter from "${bookTitle}" by ${bookAuthor}.

CHAPTER SUMMARY (use this as your ONLY source of truth — do NOT make up plot details):
${chapterSummary}

RULES:
- Questions MUST be answerable from the chapter summary above
- Do NOT reference events, characters, or details not in the summary
- Reading level: 3rd grade
- Tone: encouraging, curious. "What did you notice about...?", "Can you remember when...?"
- NEVER use: "wrong", "incorrect", "failed"
- All questions multiple choice with 4 options (A-D)
- Mix: 1 recall, 1 inference, 1 vocabulary or prediction
- Explanations: max 2 sentences, positive

Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "...",
      "question_type": "recall|inference|vocabulary|prediction|connection"
    }
  ]
}
```

The chapter summary injection is the key anti-hallucination defense — the AI can only ask about what's in the summary.

Deploy: `supabase functions deploy generate-checkpoint`

### Task 5: BookReflection — Star Rating & Text (Mobile/Web Only)
**Spec Reference:** §5.1, C1-006
**Creates:** `src/components/reading/BookReflection.jsx`

**Mobile/web only** — hidden when `useDeviceType() === 'tv'`.

After book completion:
- 5-star rating selector (tap/click stars)
- Text area for reflection: "What did you think of this book?"
- Submit button saves to `book_progress.star_rating` and `book_progress.reflection_text`

On TV: book completion shows the celebration but skips the reflection form. Toast: "You can add a review from your phone or tablet!"

### Task 6: BookAssigner — Parent Book Assignment
**Spec Reference:** §5.1, C1-014
**Creates:** `src/components/admin/BookAssigner.jsx`

**Mobile/web only** — parent admin component.

Shows:
- **Per kid:** Currently reading, completed books, assigned-but-not-started
- **Unassigned books:** filterable by tier and genre
- **Assign button:** Creates `book_progress` record (status='assigned') via `assign-book` Edge Function

**Auto-suggest on completion (C1-014):**
When a kid completes a book:
- Find unread books from the same tier or one tier up
- Prioritize same genre, then different genre for variety
- Show top 3 suggestions with "Assign" button

**assign-book Edge Function:**
```typescript
// supabase/functions/assign-book/index.ts
// Creates book_progress with status='assigned'
// Handles UNIQUE constraint violation gracefully (book already assigned)
// TODO Phase 07: Add session token validation
```

**TV notification:** When a parent assigns a book, real-time subscription delivers the change. Show toast on TV: "📚 New book assigned: [Title]!"

### Task 7: Reading Badges & Streak Display
**Spec Reference:** §5.1
**Creates:** Badge logic in BookLibrary or HeroStatsHUD

Define badges:
- 📖 **First Chapter** — Complete first chapter checkpoint
- 📚 **Bookworm** — Complete 1 book
- 🏆 **Reading Champion** — Complete 5 books
- 🔥 **Week Streak** — 7-day reading streak
- ⭐ **Critic** — Write 3 book reflections

Store badges as a JSONB array on kids table, or compute from data (preferred — no schema change needed):
```javascript
function computeBadges(bookProgress, readingCheckpoints, kid) {
  const badges = [];
  if (readingCheckpoints.length > 0) badges.push({ id: 'first_chapter', name: 'First Chapter', icon: '📖' });
  const completed = bookProgress.filter(bp => bp.status === 'completed');
  if (completed.length >= 1) badges.push({ id: 'bookworm', name: 'Bookworm', icon: '📚' });
  if (completed.length >= 5) badges.push({ id: 'reading_champion', name: 'Reading Champion', icon: '🏆' });
  if (kid.reading_streak >= 7) badges.push({ id: 'week_streak', name: 'Week Streak', icon: '🔥' });
  const reflections = completed.filter(bp => bp.reflection_text);
  if (reflections.length >= 3) badges.push({ id: 'critic', name: 'Critic', icon: '⭐' });
  return badges;
}
```

Display badges in BookLibrary header or HeroStatsHUD. New badge earned → confetti + toast.

### Task 8: Wire into App Shell
**Spec Reference:** §5.1
**Modifies:** `src/App.jsx` (Reading Guild tab content)

Replace the EmptyBookLibrary placeholder in the Reading Guild tab with the real BookLibrary component. Navigation flow:

```
Reading Guild Tab
  ├── BookLibrary (default — Currently Reading shelf + tiered grid)
  │     └── [Select book] → BookDetail
  │           ├── [I finished Chapter X] → ChapterCheckpoint (if checkpoint interval)
  │           │     └── [Complete checkpoint] → Back to BookDetail
  │           └── [Final chapter] → Completion celebration → BookReflection (mobile)
  └── [Back] at any level → returns to parent view
```

---

## 4. Acceptance Criteria

### Book Library
- [ ] 20 books render across 3 tiers
- [ ] "Currently Reading" shelf shows assigned-in-progress books prominently
- [ ] Book cards show status: not assigned / assigned / reading / completed
- [ ] All book cards `.tv-focusable`
- [ ] Selecting a book navigates to BookDetail

### Chapter Logging & Checkpoints
- [ ] "I finished Chapter X" button logs progress
- [ ] Checkpoint chapter → AI checkpoint questions generate using chapter summary
- [ ] Checkpoint questions on TV: MC-only (no text input fields)
- [ ] Wrong answers: encouraging feedback (same tone as quiz — C1-026)
- [ ] Checkpoint completion awards XP/coins
- [ ] Non-checkpoint chapter: toast "Great reading!" + streak update

### Reading Streak
- [ ] Consecutive daily chapter logs increment streak
- [ ] Missing a day resets streak to 1
- [ ] Streak displays in BookDetail and/or HeroStatsHUD

### Book Completion
- [ ] Final chapter: book_progress status → 'completed'
- [ ] Celebration: confetti + completion modal
- [ ] XP/coins awarded for completion
- [ ] On mobile: BookReflection (star rating + text) appears
- [ ] On TV: toast "Add a review from your phone!"

### Book Assignment
- [ ] Parent assigns book on mobile → book_progress created (status='assigned')
- [ ] Duplicate assignment: graceful error (unique constraint), not crash
- [ ] TV shows toast "📚 New book assigned: [Title]!" via real-time
- [ ] Auto-suggest: on completion, parent sees recommended next books

### Badges
- [ ] Badges compute correctly from data (First Chapter, Bookworm, etc.)
- [ ] New badge earned → confetti + toast

### Edge Function
- [ ] generate-checkpoint deployed and accessible
- [ ] Chapter summary injected into AI prompt (verify in Edge Function logs)
- [ ] 4s timeout → fallback questions served
- [ ] assign-book deployed (no session token yet — Phase 07 adds it)

---

## 5. Constraints

### Hard Constraints
- Chapter summaries are the SOLE source of truth for AI questions — the prompt must enforce this
- TV: MC-only checkpoints — no text input, no reflection form
- BookReflection: mobile/web only (`useDeviceType` check)
- BookAssigner: mobile/web only
- Unique constraint on book_progress(kid_id, book_id) — handle ON CONFLICT gracefully
- Do NOT implement PIN authentication or analytics dashboard
- Edge Functions: `// TODO Phase 07: session token validation`

### Soft Constraints
- Reuse QuizQuestion component for checkpoint questions if possible (same MC format)
- Badge definitions are suggestions — adjust names/thresholds if better options emerge
- Chapter summary quality depends on Phase 09 content — placeholder summaries are fine for testing
- Reading streak resets are forgiving (resets to 1, not 0)

---

## 6. Completion Protocol

### Files Created / Modified / Edge Functions Deployed
[Standard tables]

### Acceptance Criteria Results
[Standard table]

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |
[Especially note the checkpoint reward mechanism choice]

### Warnings for Next Phase
[Phase 07 (Parent Control) wraps all Edge Functions with PIN session tokens. List: assign-book and any other parent-write functions created. Note which components are parent-admin vs kid-facing.]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 50`
Mirrors Phase 05 patterns closely. Should complete in 1-2 sessions.

### Task Planning
1. Read spec §2.1 (books/book_progress/reading_checkpoints), §4.2 (generate-checkpoint), §5.1
2. Read `PHASE-05-COMPLETION.md` — reuse quiz patterns
3. Task 4 (Edge Function) can be built and tested independently
4. Tasks 1-3 (UI) build on Phase 02 shell
5. Task 6 (BookAssigner) is a parent-admin component
6. Task 8 (wiring) last

### Resumption Protocol (--continue)
1. Check `PHASE-06-PROGRESS.md`
2. Check generate-checkpoint deployment status
3. Resume from first incomplete task

### Progress Tracking
Update `PHASE-06-PROGRESS.md` after each task.

## Skills Reference
Before building UI:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Design for book cards, library layout, checkpoint flow
