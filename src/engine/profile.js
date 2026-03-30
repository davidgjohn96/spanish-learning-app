import { loadProfile, saveProfile } from './storage.js'
import { starterLesson } from '../content/es/starterLesson.js'

function nowMs() {
  return Date.now()
}

export function initProfileIfNeeded() {
  const existing = loadProfile()
  if (existing) return existing

  const profile = {
    version: 1,
    createdAt: nowMs(),
    language: 'es',
    cards: {},
  }

  // Seed all starter cards as "new" (due immediately once added by the lesson).
  for (const c of starterLesson.chunks) {
    profile.cards[c.id] = {
      id: c.id,
      es: c.es,
      en: c.en,
      state: 'new', // new | learning | review
      ease: 2.5,
      intervalDays: 0,
      dueAt: nowMs(),
      reps: 0,
      lapses: 0,
      lastReviewedAt: null,
      addedAt: null,
    }
  }

  saveProfile(profile)
  return profile
}

export function getProfile() {
  return initProfileIfNeeded()
}

export function setProfile(next) {
  saveProfile(next)
}

export function getDueCount() {
  const profile = getProfile()
  const t = nowMs()
  return Object.values(profile.cards).filter(
    (c) => c.addedAt && c.dueAt <= t,
  ).length
}

