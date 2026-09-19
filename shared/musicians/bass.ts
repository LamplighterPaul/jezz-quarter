import { lineQuestions } from './line.ts'

// Bass has its own questions and memory. No pianist-selected root is supplied.
export function bassQuestions(remaining = 4, previous?: number) {
  return lineQuestions(
    'bass',
    'You play the double bass. Your line has its own melodic and rhythmic continuity within the band.',
    remaining,
    previous,
  )
}
