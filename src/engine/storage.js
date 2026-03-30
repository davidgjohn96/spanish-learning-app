const STORAGE_KEY = 'habla.profile.v1'

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveProfile(profile) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

