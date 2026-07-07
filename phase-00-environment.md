# Phase 00: Environment Setup
**Project:** QuestTrack Academy
**Spec:** questtrack-spec-v2.md
**Build Plan:** questtrack-buildplan.md
**Prerequisites:** None
**Implements:** Infrastructure scaffolding
**Recommended:** `claude --max-turns 25`

---

## 1. Context

You are executing **Phase 00: Environment Setup** of the QuestTrack Academy build.

**Your scope is strictly this phase.** You are setting up the project skeleton — no application logic, no database schema, no components. Just a compilable, runnable, correctly-structured project.

**Tech Stack:** React 18+ (Vite 5+), Tailwind CSS 3.4+, Lucide React, Google Fonts (Fredoka + Quicksand), Supabase (PostgreSQL), Capacitor 5+ (Android TV), canvas-confetti 1.9+, rrule, @supabase/supabase-js
**Working Directory:** Project root (create a new directory `questtrack-academy/`)
**Spec File:** `questtrack-spec-v2.md` — READ THIS FILE FIRST. Sections 1.2 (stack), 1.3 (deployment), 5.1 (component tree) are your primary references.

### What Already Exists
Nothing. This is a fresh build.

### What You're Building
A Vite + React + Tailwind project scaffold with the complete directory structure from the spec, all npm dependencies installed, Supabase CLI initialized, Capacitor Android shell configured, and dark-theme Tailwind tokens set up. When done, `npm run dev` starts a dev server showing a placeholder page with correct fonts and dark background.

---

## 2. Objective & Deliverables

### Objective
The project compiles, runs on localhost, has the correct directory structure for all future phases, and is connected to a Supabase project.

### Deliverables
1. **Vite + React project** initialized with TypeScript-optional (plain JSX is fine per spec) — Spec §1.2
2. **Tailwind CSS config** with dark theme tokens — Spec §1.2, SOW §5 (Rose-500 primary, deep slate background)
3. **Directory structure** matching spec §5.1 component tree (empty files with TODO comments are fine)
4. **Package dependencies** installed — Spec §1.2
5. **`.env.example`** with Supabase URL + anon key placeholders — Spec §6.1
6. **Supabase CLI** project init and link — Spec §1.2
7. **Capacitor Android project** shell — Spec §1.3, §6.4
8. **Google Fonts** loaded (Fredoka headings, Quicksand body) — Spec §1.2
9. **Base `main.jsx` + `App.jsx`** rendering a placeholder with correct styling

---

## 3. Implementation Instructions

### Task 1: Initialize Vite + React Project
**Spec Reference:** §1.2
**Creates:** `questtrack-academy/` project root

```
npm create vite@latest questtrack-academy -- --template react
cd questtrack-academy
npm install
```

Verify `npm run dev` works before proceeding.

### Task 2: Install All Dependencies
**Spec Reference:** §1.2
**Modifies:** `package.json`

Install production dependencies:
```
npm install @supabase/supabase-js canvas-confetti rrule lucide-react
```

Install dev dependencies:
```
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer
```

Note: bcryptjs is NOT needed client-side — PIN verification is server-side via Edge Function. Client uses Web Crypto API for SHA-256 soft-lock hashing.

### Task 3: Configure Tailwind CSS
**Spec Reference:** §1.2, SOW §5
**Creates:** `tailwind.config.js`, updates `src/index.css`

Configure Tailwind with:
- Dark theme as default (deep slate background: `#0f172a` or similar)
- Custom colors: Rose-500 as primary accent, Amber for Quinn, Purple for Cora, Emerald for Family Hub
- Custom fonts: Fredoka (headings), Quicksand (body)
- Content paths covering all `src/` JSX files

Load Google Fonts in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Task 4: Create Directory Structure
**Spec Reference:** §5.1 (component tree)
**Creates:** All directories and placeholder files

Create the full directory tree from spec §5.1. For each file, create it with a minimal placeholder:

```javascript
// src/components/profiles/ProfileSwitcher.jsx
// TODO: Phase 02 — Kid Profile Switcher with Soft-Lock (F-002)
export default function ProfileSwitcher() {
  return <div>ProfileSwitcher — Phase 02</div>;
}
```

Key directories:
```
src/
├── hooks/          (8 hook files)
├── components/
│   ├── layout/     (4 files)
│   ├── profiles/   (4 files)
│   ├── academy/    (5 files)
│   ├── reading/    (4 files)
│   ├── quests/     (2 files)
│   ├── calendar/   (3 files)
│   ├── shop/       (3 files)
│   ├── admin/      (9 files)
│   ├── onboarding/ (5 files)
│   └── shared/     (4 files)
├── lib/            (5 files)
└── data/           (3 JSON files)
```

For JSON data files, create empty arrays:
```json
[]
```

### Task 5: Configure Environment
**Spec Reference:** §6.1
**Creates:** `.env.example`, `.env` (gitignored)

```
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FAMILY_ID=your-family-uuid
```

Create `.gitignore` with standard React + `.env` exclusions.

### Task 6: Initialize Supabase CLI
**Spec Reference:** §1.2, §2.9
**Creates:** `supabase/` directory

```
npx supabase init
```

This creates the `supabase/` directory structure for migrations and Edge Functions. Do NOT create any migrations yet — that's Phase 01.

If a remote Supabase project exists, link it:
```
npx supabase link --project-ref <project-ref>
```

If no project exists yet, note in completion report that the human needs to create the Supabase project and update `.env`.

### Task 7: Capacitor Android Shell
**Spec Reference:** §1.3, §6.4
**Creates:** `android/` directory

```
npm install @capacitor/core @capacitor/cli
npx cap init "QuestTrack Academy" com.questtrack.academy --web-dir dist
npm install @capacitor/android
npx cap add android
```

Configure `capacitor.config.ts`:
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.questtrack.academy',
  appName: 'QuestTrack Academy',
  webDir: 'dist',
  android: {
    // C1-032: Allow autoplay for YouTube lessons
    webContentsDebuggingEnabled: true,
  },
  server: {
    // For dev: point to Vite dev server
    // For production: uses bundled assets in dist/
  }
};

export default config;
```

Note: `setMediaPlaybackRequiresUserGesture(false)` must be set in the Android native code (`MainActivity.java`) — document this for Phase 09 when the APK is actually built.

### Task 8: Base App Shell
**Spec Reference:** §5.1
**Creates:** `src/main.jsx`, `src/App.jsx`

Create a minimal App shell that:
- Imports Tailwind styles
- Renders the dark background
- Shows "QuestTrack Academy" in Fredoka font
- Shows a placeholder grid of profile cards (Quinn 🦁 in amber, Cora 🦄 in purple, Family Hub in emerald)
- Demonstrates that fonts, colors, and dark theme work

This is a visual proof-of-life — not functional yet.

---

## 4. Acceptance Criteria

### Automated Checks
- [ ] `npm run dev` starts Vite dev server without errors
- [ ] `npm run build` produces production bundle in `dist/`
- [ ] `npm run lint` passes (if ESLint configured) or no errors in console
- [ ] All directories from spec §5.1 exist
- [ ] All placeholder component files export a default function

### Visual Checks
- [ ] Browser shows dark slate background
- [ ] "QuestTrack Academy" renders in Fredoka font
- [ ] Body text renders in Quicksand font
- [ ] Rose-500 accent color visible somewhere
- [ ] Profile color placeholders: amber, purple, emerald visible

### Infrastructure Checks
- [ ] `.env.example` has all 3 variables documented
- [ ] `supabase/` directory exists with config
- [ ] `android/` directory exists (Capacitor shell)
- [ ] `node_modules/` contains: @supabase/supabase-js, canvas-confetti, rrule, lucide-react

---

## 5. Constraints

### Hard Constraints
- **React with plain JSX** (not TypeScript, unless you prefer — spec doesn't mandate either)
- **Vite** as bundler (not Create React App, not Next.js)
- **Tailwind CSS** for styling (no CSS modules, no styled-components)
- **No application logic** — this phase is scaffolding only
- **Do NOT create database migrations** — that's Phase 01
- **Do NOT implement any hooks or components** — just placeholder exports

### Soft Constraints
- Match the spec §5.1 file naming exactly (PascalCase for components, camelCase for hooks/lib)
- Use Lucide React for any placeholder icons

---

## 6. Completion Protocol

When all acceptance criteria pass, provide this structured report:

### Files Created
| File | Purpose | Lines |
|------|---------|-------|
| [path] | [what it does] | [approx lines] |

### Acceptance Criteria Results
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | npm run dev starts | PASS/FAIL | [what you checked] |

### Spec Ambiguities
| Location | Ambiguity | Decision Made | Rationale |
|----------|-----------|---------------|-----------|

### Warnings for Next Phase
[Anything Phase 01 should know — Supabase project status, env var setup needed, etc.]

---

## 7. Execution & Orchestration

### Run Configuration
**Recommended:** `claude --max-turns 25`
This phase should complete in a single session.

### Task Planning
1. Read spec §1.2, §1.3, §5.1
2. Execute Tasks 1-8 in order
3. Verify all acceptance criteria
4. Write completion report

### Resumption Protocol (--continue)
If this session is resumed:
1. Check what already exists in the project directory
2. Skip completed tasks
3. Continue from the first incomplete task

### Progress Tracking
After completing each task, update `PHASE-00-PROGRESS.md`:
```markdown
# Phase 00 Progress
- [x] Task 1: Vite init
- [x] Task 2: Dependencies
- [ ] Task 3: Tailwind config
...
```

## Skills Reference
Before building any UI (Task 8), review:
- `view /mnt/skills/public/frontend-design/SKILL.md` — Follow design principles for the placeholder shell
