import { getSupabase } from './supabase.js'
import { getCurrentUser } from './auth.js'
import {
  getProfile,
  setProfile,
  subscribeProfile,
} from './profile.js'

/**
 * Sync model (see CLAUDE.md):
 *  - localStorage is the canonical store for the current device/session.
 *  - The server is canonical across devices.
 *  - On sign-in: pull server state, merge into local using "latest
 *    last_reviewed_at wins per card", push merged result back.
 *  - On every local change while signed-in: push (debounced) to server.
 *    Failures are silently ignored — local still has the truth, and the
 *    next sync-on-open will reconcile.
 *
 * Card content (es/en/note) is NOT round-tripped. The server stores card
 * ids + SRS state only; content is bundled in the front-end.
 */

const PUSH_DEBOUNCE_MS = 500
let pushTimer = null
let pushInFlight = false
let pushQueued = false
let syncStarted = false

export function startBackgroundSync() {
  if (syncStarted) return
  syncStarted = true
  subscribeProfile(schedulePush)
}

function schedulePush() {
  const user = getCurrentUser()
  if (!user) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    runPush(user.id)
  }, PUSH_DEBOUNCE_MS)
}

async function runPush(userId) {
  if (pushInFlight) {
    pushQueued = true
    return
  }
  pushInFlight = true
  try {
    await pushFullProfile(userId, getProfile())
  } catch {
    // Network/offline — local still has the truth.
  } finally {
    pushInFlight = false
    if (pushQueued) {
      pushQueued = false
      runPush(userId)
    }
  }
}

export async function syncOnSignIn(userId) {
  const sb = getSupabase()
  if (!sb) return

  const [profileResp, cardsResp] = await Promise.all([
    sb.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('cards').select('*').eq('user_id', userId),
  ])

  if (profileResp.error) throw profileResp.error
  if (cardsResp.error) throw cardsResp.error

  const local = getProfile()
  const merged = mergeProfiles(local, profileResp.data, cardsResp.data || [])

  // Write merged to local first (fast, reactive), then push.
  setProfile(merged)
  await pushFullProfile(userId, merged)
}

function mergeProfiles(local, serverProfile, serverCards) {
  const merged = {
    ...local,
    cards: { ...local.cards },
    completedLessonIds: [...(local.completedLessonIds ?? [])],
  }

  if (serverProfile) {
    // Union of completed lessons — completing on either device counts.
    const set = new Set(merged.completedLessonIds)
    for (const id of serverProfile.completed_lesson_ids ?? []) set.add(id)
    merged.completedLessonIds = Array.from(set)

    // Streak: take the higher count, latest activity date wins.
    merged.streakCount = Math.max(
      local.streakCount ?? 0,
      serverProfile.streak_count ?? 0,
    )

    const localDate = local.lastActivityDate ?? null
    const serverDate = serverProfile.last_activity_date ?? null
    merged.lastActivityDate =
      localDate && serverDate
        ? localDate > serverDate
          ? localDate
          : serverDate
        : localDate || serverDate

    merged.activeLanguage =
      serverProfile.active_language ?? local.activeLanguage ?? 'es'
  }

  for (const sc of serverCards) {
    const lc = merged.cards[sc.card_id]
    const serverReviewed = sc.last_reviewed_at
      ? new Date(sc.last_reviewed_at).getTime()
      : null
    const localReviewed = lc?.lastReviewedAt ?? null

    const serverIsNewer =
      !lc?.addedAt ||
      (serverReviewed !== null &&
        (localReviewed === null || serverReviewed > localReviewed))

    if (serverIsNewer) {
      merged.cards[sc.card_id] = {
        id: sc.card_id,
        // Preserve any content the local card already has (bundled content).
        es: lc?.es ?? '',
        en: lc?.en ?? '',
        state: sc.state,
        ease: Number(sc.ease),
        intervalDays: sc.interval_days,
        dueAt: new Date(sc.due_at).getTime(),
        reps: sc.reps,
        lapses: sc.lapses,
        lastReviewedAt: serverReviewed,
        addedAt: new Date(sc.added_at).getTime(),
      }
    }
  }

  return merged
}

async function pushFullProfile(userId, profile) {
  const sb = getSupabase()
  if (!sb) return

  const profileRow = {
    user_id: userId,
    active_language: profile.activeLanguage ?? 'es',
    streak_count: profile.streakCount ?? 0,
    last_activity_date: profile.lastActivityDate ?? null,
    completed_lesson_ids: profile.completedLessonIds ?? [],
  }

  const cardRows = Object.values(profile.cards ?? {})
    .filter((c) => c.addedAt)
    .map((c) => cardToRow(userId, c))

  const ops = [sb.from('profiles').upsert(profileRow)]
  if (cardRows.length > 0) {
    ops.push(sb.from('cards').upsert(cardRows))
  }

  const results = await Promise.all(ops)
  for (const r of results) {
    if (r.error) throw r.error
  }
}

function cardToRow(userId, c) {
  return {
    user_id: userId,
    card_id: c.id,
    state: c.state,
    ease: c.ease,
    interval_days: c.intervalDays,
    due_at: new Date(c.dueAt).toISOString(),
    reps: c.reps,
    lapses: c.lapses,
    last_reviewed_at: c.lastReviewedAt
      ? new Date(c.lastReviewedAt).toISOString()
      : null,
    added_at: new Date(c.addedAt).toISOString(),
  }
}
