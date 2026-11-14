import { swipeDirection, swipeOffset } from '../domain/navigation';

export function enableSwipe(
  element: HTMLElement,
  navigate: (step: number) => void,
  options: { onDrag?: (offset: number | null) => void } = {},
) {
  let start: { id: number; x: number; y: number } | undefined;
  let horizontal = false;
  let suppressClick = false;
  const reset = () => {
    start = undefined;
    horizontal = false;
    element.classList.remove('is-swiping');
    options.onDrag?.(null);
  };
  element.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    horizontal = false;
    suppressClick = false;
  });
  element.addEventListener('pointermove', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!horizontal) {
      // Only claim the gesture once the direction is clearly horizontal.
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      horizontal = true;
      element.classList.add('is-swiping');
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a progressive enhancement.
      }
    }
    options.onDrag?.(swipeOffset(dx));
  });
  element.addEventListener('pointercancel', reset);
  element.addEventListener('pointerup', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const shouldNavigate = horizontal;
    reset();
    if (!shouldNavigate) return;
    const direction = swipeDirection(dx, dy);
    if (!direction) return;
    suppressClick = true;
    // Let the browser finish the touch sequence before replacing the card.
    requestAnimationFrame(() => navigate(direction));
  });
  element.addEventListener(
    'click',
    (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
