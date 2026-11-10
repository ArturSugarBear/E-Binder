import { animate } from 'motion';
import { el } from './workspace-dom';

type Phase =
  'ready' | 'capture' | 'recognize' | 'review' | 'error' | 'cancelled';
/** One scanner language: active work is indeterminate, completed pockets are counted. */
export function scanProgress(total = 1) {
  const element = el('section', 'w-scan-progress');
  element.setAttribute('aria-label', 'Scanfortschritt');
  const indicator = el('div', 'w-scan-progress-track');
  indicator.setAttribute('aria-hidden', 'true');
  const cells = Array.from({ length: total }, (_, index) =>
    el('span', 'w-scan-progress-cell', total > 1 ? String(index + 1) : ''),
  );
  indicator.append(...cells);
  const label = el('strong', 'w-scan-progress-label', 'Bereit für deine Karte');
  label.setAttribute('role', 'status');
  const steps = el(
    'ol',
    'w-scan-progress-steps',
    ...['Aufnehmen', 'Erkennen', 'Prüfen'].map((text) => el('li', '', text)),
  );
  element.append(indicator, label, steps);
  let completed = 0;
  function update(phase: Phase, text: string, done = completed) {
    element.dataset.phase = phase;
    element.setAttribute(
      'aria-busy',
      String(phase === 'capture' || phase === 'recognize'),
    );
    label.textContent = text;
    const active = phase === 'review' ? 2 : phase === 'recognize' ? 1 : 0;
    [...steps.children].forEach((step, index) => {
      step.setAttribute('aria-current', index === active ? 'step' : 'false');
      step.classList.toggle('is-complete', index < active);
    });
    cells.forEach((cell, index) => {
      cell.dataset.state =
        index < done
          ? 'done'
          : index === done && phase === 'recognize'
            ? 'active'
            : 'pending';
      if (
        index >= completed &&
        index < done &&
        !matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        animate(
          cell,
          { opacity: [0.55, 1], scale: [0.94, 1] },
          { duration: 0.22 },
        );
      }
    });
    completed = done;
  }
  update(
    'ready',
    total === 9 ? 'Neun Fächer. Eine Seite.' : 'Bereit für deine Karte',
    0,
  );
  return { element, update };
}
