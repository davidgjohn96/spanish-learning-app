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

- `src/engine/` — pure JS, no React. Owns SRS scheduling, profile shape, persistence, auth, and the local↔server sync layer.
- `src/content/<lang>/` — plain-data lesson modules (dialogue lines + chunks). Currently only `es/`. `src/content/es/index.js` exports an ordered `spanishLessons` array — lesson order in that array defines the unlock sequence.
- `src/App.jsx` — single-file UI with a tiny `route` state machine (`home` | `lesson` | `review`). No router library.
- `src/hooks/useProfileSync.js` + `src/hooks/useAuth.js` — bridge the engine's pub/sub stores to React.
- `supabase/schema.sql` — DDL to paste into the Supabase SQL editor.

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

## Auth + server sync (Supabase)

Sign-in is **anonymous-first**: visitors can use the app immediately, and only sign in (magic link, no password) when they want to save progress across devices. localStorage stays canonical for the current session; Supabase Postgres is canonical across devices.

- `src/engine/supabase.js` — single-client wrapper. Returns `null` if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, so dev works without env vars (the app silently runs in local-only mode).
- `src/engine/auth.js` — session state + pub/sub (`subscribeAuth`/`getAuthVersion`), `signInWithEmail`, `signOut`. `initAuth` is idempotent and called once from `useAuth`.
- `src/engine/sync.js` — pull/push/merge. `startBackgroundSync()` runs once at module load and subscribes to `subscribeProfile`, so every profile mutation triggers a debounced push (500ms) when the user is signed in.
- `src/hooks/useAuth.js` — bridges auth state to React via `useSyncExternalStore`, kicks `initAuth()` once on mount.

**Merge rule (on sign-in, runs once):**
- Profile-level: streak = `max(local, server)`, `lastActivityDate` = latest, `completedLessonIds` = union, `activeLanguage` from server if present.
- Per-card: latest `last_reviewed_at` wins. Local cards without `addedAt` (never put into rotation) are ignored.
- Server cards always overwrite if local has no `addedAt` for that id.

**Push rule (after sign-in):** debounced full-profile upsert on every change. Cards without `addedAt` are not pushed (they're just seeded chunks, not in rotation).

**Circular import note:** `auth.js` and `sync.js` import from each other. This is safe because neither side calls the other during module initialization — both invocations happen later via callbacks. Live ESM bindings handle the rest.

**Schema:** see [supabase/schema.sql](supabase/schema.sql). Two tables (`profiles`, `cards`), RLS policies restricting every row to `auth.uid() = user_id`. Card *content* (es/en/note) is **not** stored server-side — only the chunk id + SRS state. Content is bundled in the front-end and joined client-side.

**Env vars:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the publishable / anon key, not the secret/service-role key). Anon key is safe in the front-end bundle because RLS gates row access at the database level. Secret key must NEVER be in env vars with `VITE_` prefix, in committed files, or in any front-end code — it bypasses RLS.

**Email deliverability:** Supabase's built-in email service is rate-limited to ~4/hr per project and is for testing only. Before sending magic links to real users, configure a real SMTP provider (Resend, Postmark) in the Supabase dashboard → Auth → SMTP.
