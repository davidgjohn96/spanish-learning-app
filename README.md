# Habla (Spanish learning app)

A small Spanish learning web app: short lessons (dialogues + chunks), spaced repetition review, and progress stored in your browser. Optional email sign-in syncs progress across devices via Supabase.

**Stack:** React, Vite, plain CSS. Supabase (Postgres + magic-link auth) for optional sync.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`). The app works without Supabase credentials — it just stays in local-only mode.

```bash
npm run build   # production build
npm run preview # preview production build
```

## Enabling sign-in / cross-device sync (optional)

1. Create a free Supabase project at https://supabase.com.
2. In the SQL editor, paste and run [supabase/schema.sql](supabase/schema.sql).
3. Project Settings → API → copy the **Project URL** and the **publishable (anon) key**. Never use the **secret** key in this app.
4. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your publishable key>
   ```
5. On Vercel, add the same two env vars (Project → Settings → Environment Variables) and redeploy.
6. Authentication → URL Configuration → add your local + production URLs to "Redirect URLs" so magic links land back in the app.

Before sharing the site widely, configure a real SMTP provider in Supabase (Auth → SMTP) — the default sender is rate-limited to ~4 emails/hour.

## How this was built

This project was built in **[Cursor](https://cursor.com)** using **Agent** mode, **without** a separate planning step upfront. The editor’s **auto** model selection was used for the assistant (no fixed model chosen manually).
