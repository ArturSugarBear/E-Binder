let nextField = 0;
export type Child = Node | string | null | undefined | false;
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  for (const child of children)
    if (child !== null && child !== undefined && child !== false)
      element.append(child);
  return element;
}
export function action(
  label: string,
  handler: () => void,
  style = 'secondary',
  iconName?: string,
): HTMLButtonElement {
  const button = el(
    'button',
    `w-button w-button-${style}`,
    iconName ? icon(iconName) : null,
    el('span', '', label),
  );
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}
export function icon(name: string): SVGSVGElement {
  const paths: Record<string, string> = {
    plus: 'M12 5v14M5 12h14',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    cards: 'M5 4h13v16H5zM8 1h13v16',
    binder: 'M5 3h15v18H5zM8 3v18M3 7h4M3 12h4M3 17h4',
    star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
    camera: 'M3 7h5l2-3h4l2 3h5v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    close: 'm6 6 12 12M6 18 18 6',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
    check: 'm5 12 4 4L19 6',
    lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    undo: 'M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
    swap: 'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
    trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name] ?? paths.plus!);
  svg.append(path);
  return svg;
}
export function input(type = 'text', value = ''): HTMLInputElement {
  const element = el('input', 'w-input');
  element.type = type;
  element.value = value;
  return element;
}
export function select(
  options: [string, string][],
  value = '',
): HTMLSelectElement {
  const element = el('select', 'w-input');
  for (const [key, text] of options) {
    const option = el('option', '', text);
    option.value = key;
    element.append(option);
  }
  element.value = value;
  return element;
}
export function field(
  label: string,
  control: HTMLElement,
  help?: string,
): HTMLElement {
  const id = control.id || `w-field-${++nextField}`;
  control.id = id;
  const caption = el('label', 'w-label', label);
  caption.htmlFor = id;
  const description = help ? el('small', 'w-help', help) : undefined;
  if (description) {
    description.id = `${id}-help`;
    control.setAttribute('aria-describedby', description.id);
  }
  return el('div', 'w-field', caption, control, description);
}
export function check(
  label: string,
  checked = false,
): { row: HTMLLabelElement; input: HTMLInputElement } {
  const element = input('checkbox');
  element.checked = checked;
  return {
    row: el('label', 'w-check', element, el('span', '', label)),
    input: element,
  };
}
export function modal(
  title: string,
  wide = false,
): {
  dialog: HTMLDialogElement;
  body: HTMLElement;
  footer: HTMLElement;
  close: () => void;
  onClose: (callback: () => void) => void;
} {
  const opener = document.activeElement;
  const dialog = el('dialog', `w-dialog${wide ? ' w-dialog-wide' : ''}`);
  const heading = el('h2', '', title);
  heading.id = `w-dialog-${++nextField}`;
  dialog.setAttribute('aria-labelledby', heading.id);
  const close = () => dialog.close();
  const closeButton = action('Schließen', close, 'icon', 'close');
  closeButton.setAttribute('aria-label', `${title} schließen`);
  const body = el('div', 'w-dialog-body');
  const footer = el('div', 'w-dialog-footer');
  const alerts = el('div', 'w-dialog-alerts');
  alerts.setAttribute('role', 'alert');
  alerts.hidden = true;
  dialog.append(
    el('header', 'w-dialog-head', heading, closeButton),
    alerts,
    body,
    footer,
  );
  const callbacks: (() => void)[] = [];
  dialog.addEventListener('close', () => {
    callbacks.forEach((callback) => callback());
    dialog.remove();
    if (document.querySelector('.w-dialog[open]')) return;
    if (opener instanceof HTMLElement && opener.isConnected)
      opener.focus({ preventScroll: true });
    else if (opener instanceof HTMLElement && opener.dataset.focus)
      document
        .querySelector<HTMLElement>(
          `[data-focus="${CSS.escape(opener.dataset.focus)}"]`,
        )
        ?.focus({ preventScroll: true });
    else
      document
        .querySelector<HTMLElement>('#workspace-main')
        ?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      close();
  });
  document.body.append(dialog);
  dialog.showModal();
  return {
    dialog,
    body,
    footer,
    close,
    onClose: (callback) => callbacks.push(callback),
  };
}
export const message = (text: string, kind = 'note'): HTMLElement =>
  el('p', `w-message w-message-${kind}`, text);
export function errorText(error: unknown): string {
  if (error instanceof DOMException)
    return error.message || 'Der Browser konnte die Aktion nicht abschließen.';
  return error instanceof Error && !('issues' in error)
    ? error.message
    : 'Die Angaben sind nicht vollständig oder enthalten ungültige Werte. Bitte prüfe sie.';
}
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = el('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
