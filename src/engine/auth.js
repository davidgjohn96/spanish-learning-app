import { getSupabase, isSupabaseConfigured } from './supabase.js'
import { syncOnSignIn } from './sync.js'

const listeners = new Set()
let currentSession = null
let authVersion = 0
let initialized = false
let initializing = false

function bumpAuthVersion() {
  authVersion++
  listeners.forEach((fn) => fn())
}

export function subscribeAuth(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthVersion() {
  return authVersion
}

export function getCurrentUser() {
  return currentSession?.user ?? null
}

export function isAuthReady() {
  return initialized
}

/**
 * Idempotent boot. Reads any persisted session from localStorage (via the
 * Supabase client) and subscribes to future auth-state changes. Triggers
 * the one-time profile/cards merge the first time a user signs in.
 */
export async function initAuth() {
  if (initialized || initializing) return
  if (!isSupabaseConfigured()) {
    initialized = true
    bumpAuthVersion()
    return
  }

  initializing = true
  const sb = getSupabase()

  const { data } = await sb.auth.getSession()
  currentSession = data.session ?? null
  initialized = true
  initializing = false
  bumpAuthVersion()

  if (currentSession?.user) {
    // Returning user — pull/merge from server.
    triggerSync(currentSession.user.id)
  }

  sb.auth.onAuthStateChange((_event, session) => {
    const wasSignedIn = Boolean(currentSession?.user)
    const isSignedIn = Boolean(session?.user)
    const prevUserId = currentSession?.user?.id
    currentSession = session
    bumpAuthVersion()

    if (isSignedIn && session.user.id !== prevUserId) {
      // Just signed in (or switched users). Pull/merge.
      triggerSync(session.user.id)
    } else if (!isSignedIn && wasSignedIn) {
      // Just signed out. Clear is handled by the auth UI; we just emit.
    }
  })
}

function triggerSync(userId) {
  // Live ESM bindings handle the auth ↔ sync circular import safely
  // because neither side calls the other during module init.
  syncOnSignIn(userId).catch(() => {
    // swallow — localStorage still has the truth
  })
}

export async function signInWithEmail(email) {
  const sb = getSupabase()
  if (!sb) throw new Error('Sign-in is not configured.')
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  const sb = getSupabase()
  if (!sb) return
  await sb.auth.signOut()
}
