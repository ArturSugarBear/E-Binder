export type PocketDecision = 'pending' | 'card' | 'empty' | 'skip';

/** A page import needs an explicit decision for all nine physical pockets. */
export function binderReviewComplete(decisions: PocketDecision[]): boolean {
  return (
    decisions.length === 9 &&
    decisions.some((decision) => decision === 'card') &&
    decisions.every((decision) => decision !== 'pending')
  );
}
