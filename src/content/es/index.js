import { starterLesson } from './starterLesson.js'
import { lesson2 } from './lesson2.js'
import { lesson3 } from './lesson3.js'

/** Ordered path for Spanish MVP (lesson 1 → 2 → 3). */
export const spanishLessons = [starterLesson, lesson2, lesson3]

export function getSpanishLessonById(lessonId) {
  return spanishLessons.find((l) => l.id === lessonId) ?? null
}
