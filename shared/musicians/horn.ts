import { lineQuestions } from './line.ts'

// Horn has its own questions and memory. No scale or contour is preselected.
export function hornQuestions(remaining = 4, previous?: number) {
  return lineQuestions(
    'horn',
    'You play the horn. Your notes and spaces form a phrase that may continue across bar boundaries.',
    remaining,
    previous,
  )
}
