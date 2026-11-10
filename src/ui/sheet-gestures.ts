/**
 * A small touch-only interaction for native <dialog> bottom sheets.
 *
 * Dragging is limited to explicit non-scrollable handles (and optionally
 * artwork). Forms and scrolling content remain native, including Safari
 * rubber-banding and the operating system's back gesture.
 */
export function shouldDismissSheet(
  distance: number,
  elapsedMs: number,
): boolean {
  if (distance < 0) return false;
  return (
    distance >= 110 ||
    (distance >= 55 && elapsedMs > 0 && distance / elapsedMs > 0.65)
  );
}

export function enableSheetDrag(
  dialog: HTMLDialogElement,
  surface: HTMLElement,
  handles: readonly HTMLElement[],
): void {
  type Start = { id: number; x: number; y: number; time: number };
  let start: Start | undefined;
  let active: HTMLElement | undefined;
  let dragging = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const mobile = matchMedia('(max-width: 720px) and (pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const ignore =
    'button, a, input, textarea, select, label, summary, [contenteditable="true"]';

  const reset = () => {
    start = undefined;
    dragging = false;
    active = undefined;
    surface.classList.remove('is-sheet-dragging', 'is-sheet-dismissing');
    surface.style.removeProperty('--sheet-drag-y');
  };

  const down = (event: PointerEvent) => {
    if (
      !dialog.open ||
      !mobile.matches ||
      !event.isPrimary ||
      event.pointerType !== 'touch' ||
      (event.target instanceof Element && event.target.closest(ignore))
    )
      return;
    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
    active = event.currentTarget as HTMLElement;
    dragging = false;
    active.setPointerCapture?.(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id || !active) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!dragging && (dy < 8 || dy < Math.abs(dx) * 1.25)) return;
    dragging = true;
    surface.classList.add('is-sheet-dragging');
    surface.style.setProperty(
      '--sheet-drag-y',
      `${Math.min(460, Math.max(0, dy))}px`,
    );
  };

  const end = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const distance = event.clientY - start.y;
    const elapsed = performance.now() - start.time;
    const wasDragging = dragging;
    reset();
    if (!wasDragging || !shouldDismissSheet(distance, elapsed)) return;
    if (reducedMotion.matches) {
      dialog.close();
      return;
    }
    surface.classList.add('is-sheet-dismissing');
    surface.style.setProperty('--sheet-drag-y', `${window.innerHeight}px`);
    timeout = setTimeout(() => {
      if (dialog.open) dialog.close();
    }, 180);
  };

  const cancel = () => reset();
  for (const handle of handles) {
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', cancel);
  }

  dialog.addEventListener(
    'close',
    () => {
      if (timeout) clearTimeout(timeout);
      reset();
      for (const handle of handles) {
        handle.removeEventListener('pointerdown', down);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', cancel);
      }
    },
    { once: true },
  );
}
