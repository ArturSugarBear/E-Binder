import { swipeDirection } from '../domain/navigation';

export function enableSwipe(
  element: HTMLElement,
  navigate: (step: number) => void,
) {
  let start: { id: number; x: number; y: number } | undefined;
  let suppressClick = false;
  element.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick = false;
  });
  element.addEventListener('pointercancel', () => {
    start = undefined;
  });
  element.addEventListener('pointerup', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = undefined;
    const direction = swipeDirection(dx, dy);
    if (!direction) return;
    suppressClick = true;
    // Let the browser finish the touch sequence before replacing the touched card.
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
