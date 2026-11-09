/**
 * Hide the mobile dock only when a software keyboard actually occupies
 * the visual viewport. Focus alone must not move the dock during a tap:
 * doing so can steal pointerup from the control being activated.
 */
export function initMobileKeyboard(): void {
  const refresh = () => {
    const active = document.activeElement;
    const editing =
      active instanceof HTMLElement &&
      active.matches(
        'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]',
      );
    const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
    const keyboardVisible = editing && window.innerHeight - visibleHeight > 130;
    document.documentElement.classList.toggle(
      'w-soft-keyboard',
      keyboardVisible,
    );
  };
  window.visualViewport?.addEventListener('resize', refresh);
  document.addEventListener('focusin', refresh);
  document.addEventListener('focusout', refresh);
  refresh();
}
