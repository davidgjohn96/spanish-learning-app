import { getProfile, recordDailyActivity, setProfile } from './profile.js'

function nowMs() {
  return Date.now()
}

function daysToMs(days) {
  return Math.max(0, days) * 24 * 60 * 60 * 1000
}

export function runLesson(lesson) {
  const profile = getProfile()
  const t = nowMs()

  for (const chunk of lesson.chunks) {
    const card = profile.cards[chunk.id]
    if (!card) continue
    if (!card.addedAt) {
      card.addedAt = t
      card.dueAt = t
      card.state = 'learning'
    }
  }

  if (!profile.completedLessonIds.includes(lesson.id)) {
    profile.completedLessonIds.push(lesson.id)
  }

  recordDailyActivity(profile)
  setProfile(profile)
}

export function getReviewQueue({ limit = 10 } = {}) {
  const profile = getProfile()
  const t = nowMs()

  const due = Object.values(profile.cards)
    .filter((c) => c.addedAt && c.dueAt <= t)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, limit)

  return due.map((c) => ({
    cardId: c.id,
    card: { id: c.id, es: c.es, en: c.en },
  }))
}

export function gradeCard(cardId, grade) {
  const profile = getProfile()
  const card = profile.cards[cardId]
  if (!card) return

  const t = nowMs()

  // Simple SM-2-ish: ease adjusts, interval grows; "again" creates a short relearn.
  const easeDelta =
    grade === 'easy' ? 0.15 : grade === 'good' ? 0.0 : grade === 'hard' ? -0.15 : -0.3

  card.ease = clamp(card.ease + easeDelta, 1.3, 3.0)
  card.lastReviewedAt = t

  if (grade === 'again') {
    card.lapses += 1
    card.state = 'learning'
    card.intervalDays = 0
    card.dueAt = t + 10 * 60 * 1000
    recordDailyActivity(profile)
    setProfile(profile)
    return
  }

  card.reps += 1

  const multiplier = grade === 'easy' ? 1.3 : grade === 'hard' ? 0.7 : 1.0

  let nextInterval
  if (card.intervalDays <= 0) nextInterval = 1
  else if (card.intervalDays === 1) nextInterval = 3
  else nextInterval = Math.round(card.intervalDays * card.ease * multiplier)

  card.intervalDays = clamp(nextInterval, 1, 365)
  card.state = 'review'
  card.dueAt = t + daysToMs(card.intervalDays)

  recordDailyActivity(profile)
  setProfile(profile)
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

