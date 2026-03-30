# Claude Code Instructions

I'm a product manager with limited coding experience who's looking to learn to become more technical. When you're coding and doing your work, please share tips that explain the tech architecture and any changes that you're making and why.

## About this project

- **Stack:** React + Vite (frontend only for now).
- **Architecture:** Keep **learning engine** code (`src/engine/`) separate from **language content** (`src/content/<lang>/`). The engine handles SRS scheduling, profile storage, and review flows; content is lesson text, chunks, and future media paths. That split makes it easier to add more languages later without rewriting core logic.
- **Persistence:** User progress lives in **browser `localStorage`** (see `src/engine/storage.js`). It is not synced to a server unless we add one.
- **Product focus:** Evidence-based learning where it fits the MVP—active recall, spaced repetition, short comprehensible input. Prefer small vertical slices over large refactors.
