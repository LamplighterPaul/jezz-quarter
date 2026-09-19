import type { Questions, Seat } from '../types.ts'

/** Every question is isolated at TypeSafe. Repeat the seat and exact task, not
 * another question's answer. State contains observed choices, not a lead sheet. */
export function forMusician(seat: Seat, questions: Questions): Questions {
  return Object.fromEntries(
    Object.entries(questions).map(([id, question]) => [
      id,
      {
        ...question,
        instructions: `You are choosing the NEXT gesture for the ${seat} in a live improvising jazz quartet. This is a musical recommendation, not a classification of the old gesture. Read self, recent_bars, repetition and audience in the state. Listen to the other players' previous gestures; answer, contrast, develop, or leave space. A long rest is an invitation to re-enter; a repeated phrase may develop rather than loop unchanged. Audience cheers approve the recent passage; boos invite a fresh approach. There is no fixed chart, key, leader, or mandatory progression. ${question.instructions}`,
      },
    ]),
  )
}
