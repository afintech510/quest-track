# QuestTrack Academy

A habit and quest tracking app for students, built as a React web app that also
ships to Android through Capacitor. Recurring quests are scheduled with real
calendar recurrence rules rather than naive intervals.

## Stack

React · Vite · TypeScript · Supabase (auth + Postgres) · Capacitor for the Android
build · `rrule` for recurrence · Vitest and Playwright for tests

## What's interesting here

- **Real recurrence handling.** Quests repeat using iCalendar `RRULE` semantics via
  the `rrule` library, so "every other Tuesday" and month-end edge cases behave
  correctly instead of drifting.
- **One codebase, two targets.** The same React app runs in the browser and as a
  native Android shell via Capacitor.
- **Built in documented phases.** `PHASE-00` through `PHASE-06` progress and
  completion notes track the build as it happened.

## Development

```bash
npm install
cp .env.example .env      # Supabase URL and anon key
npm run dev
```

```bash
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end (Playwright)
```

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```
