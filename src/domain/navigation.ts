import type { Collection } from './collection';

/** Non-chapter anchors retain the current chapter; invalid chapter links fall back safely. */
export function resolveChapter(
  hash: string,
  chapters: Collection,
  current = 0,
): number {
  if (hash === '') return 0;
  if (hash === '#greninja')
    return Math.max(
      0,
      chapters.findIndex((entry) => entry.theme === 'greninja'),
    );
  const match = /^#kapitel-([1-9]\d*)$/.exec(hash);
  if (match) {
    const position = Number(match[1]) - 1;
    return position < chapters.length ? position : 0;
  }
  if (hash.startsWith('#kapitel-')) return 0;
  return current >= 0 && current < chapters.length ? current : 0;
}

export function chapterHash(position: number): string {
  return `#kapitel-${position + 1}`;
}

export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  return Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4
    ? 0
    : dx < 0
      ? 1
      : -1;
}

/** Bounded visual follow for a page/card drag, so it cannot leave the screen. */
export function swipeOffset(dx: number, limit = 120): number {
  return Math.max(-limit, Math.min(limit, dx * 0.35));
}
