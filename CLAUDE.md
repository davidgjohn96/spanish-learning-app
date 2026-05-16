# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working with this user

The repo owner is a product manager with limited coding experience who wants to grow more technical. When making changes, briefly explain what the change does and *why* (architecture, trade-offs, the React/JS concept at play) — not just the diff.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm run lint       # ESLint over the repo
```

There is no test runner configured.

## Architecture

The codebase deliberately splits **learning engine** from **language content** so additional languages can be added without rewriting core logic.

- `src/engine/` — pure JS, no React. Owns SRS scheduling, profile shape, persistence, and the review/lesson flow.
- `src/content/<lang>/` — plain-data lesson modules (dialogue lines + chunks). Currently only `es/`. `src/content/es/index.js` exports an ordered `spanishLessons` array — lesson order in that array defines the unlock sequence.
- `src/App.jsx` — single-file UI with a tiny `route` state machine (`home` | `lesson` | `review`). No router library.
- `src/hooks/useProfileSync.js` — bridges the engine to React.

### Profile + persistence

A single profile object lives at `localStorage` key `habla.profile.v1` (`src/engine/storage.js`). Shape (see `initProfileIfNeeded` in `src/engine/profile.js`):

```
{ version, createdAt, activeLanguage, completedLessonIds[],
  streakCount, lastActivityDate, cards: { [chunkId]: Card } }
```

A `Card` mirrors a content chunk plus SRS state (`state`, `ease`, `intervalDays`, `dueAt`, `reps`, `lapses`, `addedAt`). Cards are **seeded for every chunk in every lesson on profile init**, but only enter the review rotation once `addedAt` is set — that happens in `runLesson` when the user finishes a lesson. `getReviewQueue` and `getDueCount` both filter on `addedAt`, so newly-seeded cards don't pollute the queue.

`PROFILE_VERSION` + `migrateIfNeeded` handle schema upgrades on load. When adding fields, bump `PROFILE_VERSION` and extend `migrateIfNeeded` rather than assuming the field exists.

### Reactivity model (important)

The engine is **not** React state. Instead it exposes a tiny pub/sub:

- `subscribeProfile` / `getProfileVersion` (in `profile.js`) back a `useSyncExternalStore` hook in `useProfileSync.js`.
- Any engine function that mutates the profile must call `setProfile(...)` (which calls `saveProfile` then `bumpProfileVersion`) so subscribed components re-render.

If you add a new write path in the engine, route it through `setProfile` — otherwise the UI will silently go stale until a route change.

### SRS algorithm

`gradeCard` in `src/engine/session.js` is an intentionally simple SM-2 variant:

- Ease starts at 2.5, clamped to `[1.3, 3.0]`. Grade deltas: easy +0.15, good 0, hard −0.15, again −0.3.
- "Again" → relearn in 10 minutes, interval reset to 0, `lapses++`.
- Otherwise interval grows: 0→1d, 1→3d, then `round(interval × ease × multiplier)` where multiplier is 1.3/1.0/0.7 for easy/good/hard. Clamped to `[1, 365]` days.
- `recordDailyActivity` handles streaks based on local-date comparison (`localDateString`); calling it on the same calendar day is a no-op.

Keep the algorithm here readable over clever — the product preference is small evidence-based pieces (active recall, spacing, comprehensible input), not a full SRS rewrite.

### Answer checking

`src/engine/answerCheck.js` strips accents (NFD + combining-mark removal), lowercases, collapses whitespace, and removes common punctuation including `¿¡`. When adding languages, double-check this normalization isn't dropping characters that are semantically meaningful in that language.

## Adding a new lesson (Spanish)

1. Add a `lessonN.js` in `src/content/es/` that exports `{ id, title, dialogue: { lines: [...] }, chunks: [...] }`. Each `chunk.id` is the card key in storage — **must be globally unique across all lessons**, since `profile.cards` is a flat map.
2. Append it to `spanishLessons` in `src/content/es/index.js`. Its position there sets the unlock order (see `isLessonUnlocked`).
3. No migration needed — `ensureAllLessonCards` adds cards for new chunks on next load.

## Adding a new language

The UI hints at this (`LANGUAGES` in `App.jsx` with `enabled: false` for fr/de/ja). Doing it properly is more than flipping the flag: `App.jsx`, `profile.js`, and `session.js` currently import `spanishLessons` directly. A real multi-language switch needs a content registry keyed by `activeLanguage` and per-language card namespaces — flag this before implementing.
