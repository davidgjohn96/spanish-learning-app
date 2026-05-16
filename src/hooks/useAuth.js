import { useEffect, useSyncExternalStore } from 'react'
import {
  getAuthVersion,
  getCurrentUser,
  initAuth,
  isAuthReady,
  subscribeAuth,
} from '../engine/auth.js'

let bootStarted = false

/**
 * Subscribes to auth state. Triggers the one-time auth bootstrap on first
 * mount. Returns the current Supabase user (or null), plus a `ready` flag
 * so the UI can wait out the brief session-restore window without
 * flickering "Sign in" → "user@example.com".
 */
export function useAuth() {
  useSyncExternalStore(subscribeAuth, getAuthVersion, getAuthVersion)

  useEffect(() => {
    if (!bootStarted) {
      bootStarted = true
      initAuth()
    }
  }, [])

  return { user: getCurrentUser(), ready: isAuthReady() }
}
