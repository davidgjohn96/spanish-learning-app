import { useMemo, useSyncExternalStore } from 'react'
import { getProfileVersion, getProgressStats, subscribeProfile } from '../engine/profile.js'

/** Re-render when local profile changes (SRS, lessons, streak). */
export function useProgressStats() {
  const version = useSyncExternalStore(
    subscribeProfile,
    getProfileVersion,
    getProfileVersion,
  )
  return useMemo(() => getProgressStats(), [version])
}
