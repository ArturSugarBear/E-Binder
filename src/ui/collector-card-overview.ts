import type { PersonalCard } from '../domain/personal';
import { localizedCardName } from '../data/japanese-catalog';
import type { WorkspaceContext } from './workspace-context';
import { el } from './workspace-dom';
import '../collector-card-sheet.css';

/**
 * The modern workspace counterpart of archive.html / card-dialog.ts.
 * One consistent card-first presentation for owned and discovered cards.
 * Price, ownership and editing are intentionally supplied by their callers.
 */
export function collectorCardOverview(
  ctx: WorkspaceContext,
  card: PersonalCard,
  subtitle = '',
): HTMLElement {
  const stage = el(
    'div',
    'w-collector-card-stage w-card-swipe-zone',
    ctx.images.artwork(card),
  );
  const info = el(
    'div',
    'w-collector-card-heading',
    el('h3', '', localizedCardName(card)),
    el(
      'p',
      'w-collector-card-set',
      el('span', 'w-collector-card-number', card.number),
      el('span', '', card.setName),
    ),
    el(
      'p',
      'w-collector-card-subtitle',
      [subtitle, card.artist ? `Illustration: ${card.artist}` : '']
        .filter(Boolean)
        .join(' · '),
    ),
  );
  return el('section', 'w-collector-card-overview', stage, info);
}

/** Advanced collector operations are always optional, never the first screen. */
export function collectorCardExtras(
  label: string,
  ...content: HTMLElement[]
): HTMLDetailsElement {
  const details = el(
    'details',
    'w-collector-card-extras',
    el('summary', '', label),
    ...content,
  );
  return details;
}
