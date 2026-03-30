/**
 * Normalize typed Spanish for comparison (case, spacing, common punctuation, accents).
 */
export function normalizeAnswer(s) {
  if (!s || typeof s !== 'string') return ''
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[?!.,;:¿¡"'«»()[\]]/g, '')
}

export function answersMatch(expected, typed) {
  return normalizeAnswer(expected) === normalizeAnswer(typed)
}
