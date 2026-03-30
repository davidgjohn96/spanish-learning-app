import { spanishLessons } from '../content/es/index.js'
import { loadProfile, saveProfile } from './storage.js'

const PROFILE_VERSION = 2

function nowMs() {
  return Date.now()
}

/** YYYY-MM-DD in local timezone */
export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const listeners = new Set()
let profileVersion = 0

export function subscribeProfile(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function bumpProfileVersion() {
  profileVersion++
  listeners.forEach((fn) => fn())
}

/** For useSyncExternalStore — changes whenever profile is saved. */
export function getProfileVersion() {
  return profileVersion
}

function emptyCardFromChunk(c) {
  return {
    id: c.id,
    es: c.es,
    en: c.en,
    state: 'new',
    ease: 2.5,
    intervalDays: 0,
    dueAt: nowMs(),
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    addedAt: null,
  }
}

function seedAllLessonCards(profile) {
  for (const lesson of spanishLessons) {
    for (const c of lesson.chunks) {
      if (!profile.cards[c.id]) {
        profile.cards[c.id] = emptyCardFromChunk(c)
      }
    }
  }
}

/** Add any missing cards when new lessons ship (idempotent). */
function ensureAllLessonCards(profile) {
  let changed = false
  for (const lesson of spanishLessons) {
    for (const c of lesson.chunks) {
      if (!profile.cards[c.id]) {
        profile.cards[c.id] = emptyCardFromChunk(c)
        changed = true
      }
    }
  }
  if (changed) {
    saveProfile(profile)
    bumpProfileVersion()
  }
}

function migrateIfNeeded(profile) {
  if (!profile.version || profile.version < PROFILE_VERSION) {
    profile.version = PROFILE_VERSION
    profile.activeLanguage = profile.activeLanguage ?? 'es'
    profile.completedLessonIds = profile.completedLessonIds ?? []
    profile.streakCount = profile.streakCount ?? 0
    profile.lastActivityDate = profile.lastActivityDate ?? null
    seedAllLessonCards(profile)
    saveProfile(profile)
    bumpProfileVersion()
  }
}

export function initProfileIfNeeded() {
  const existing = loadProfile()
  if (existing) {
    migrateIfNeeded(existing)
    ensureAllLessonCards(existing)
    return existing
  }

  const profile = {
    version: PROFILE_VERSION,
    createdAt: nowMs(),
    activeLanguage: 'es',
    completedLessonIds: [],
    streakCount: 0,
    lastActivityDate: null,
    cards: {},
  }

  seedAllLessonCards(profile)
  saveProfile(profile)
  bumpProfileVersion()
  return profile
}

export function getProfile() {
  return initProfileIfNeeded()
}

export function setProfile(next) {
  saveProfile(next)
  bumpProfileVersion()
}

/** First calendar day of activity starts / continues streak (lesson or review). */
export function recordDailyActivity(profile) {
  const today = localDateString()
  if (profile.lastActivityDate === today) {
    return
  }

  const yesterday = localDateString(new Date(Date.now() - 86400000))

  if (!profile.lastActivityDate) {
    profile.streakCount = 1
  } else if (profile.lastActivityDate === yesterday) {
    profile.streakCount = (profile.streakCount ?? 0) + 1
  } else {
    profile.streakCount = 1
  }

  profile.lastActivityDate = today
}

export function getDueCount() {
  const profile = getProfile()
  const t = nowMs()
  return Object.values(profile.cards).filter(
    (c) => c.addedAt && c.dueAt <= t,
  ).length
}

export function getCardsInRotationCount() {
  const profile = getProfile()
  return Object.values(profile.cards).filter((c) => c.addedAt).length
}

export function getProgressStats() {
  const profile = getProfile()
  const completedLessonIds = profile.completedLessonIds ?? []
  return {
    dueCount: getDueCount(),
    streak: profile.streakCount ?? 0,
    completedLessons: completedLessonIds.length,
    completedLessonIds,
    cardsInRotation: getCardsInRotationCount(),
    activeLanguage: profile.activeLanguage ?? 'es',
  }
}

export function setActiveLanguage(code) {
  const profile = getProfile()
  profile.activeLanguage = code
  setProfile(profile)
}

export function isLessonUnlocked(lessonId) {
  const profile = getProfile()
  const order = spanishLessons.map((l) => l.id)
  const idx = order.indexOf(lessonId)
  if (idx <= 0) return true
  const prevId = order[idx - 1]
  return profile.completedLessonIds?.includes(prevId) ?? false
}
