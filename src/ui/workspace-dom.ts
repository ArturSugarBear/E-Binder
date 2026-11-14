import { enableSheetDrag } from './sheet-gestures';

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
    external: 'M14 3h7v7m0-7L10 14M11 3H3v18h18v-8',
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
/** Native radio semantics, including arrow keys; state belongs to the caller. */
export function choices(
  label: string,
  items: [string, string][],
  initial: string,
  focusKey?: string,
) {
  const name = `w-choice-${++nextField}`;
  const element = el('fieldset', 'w-choices');
  const legend = el('legend', 'w-label', label);
  const list = el('div', 'w-choice-list');
  const options = items.map(([value, caption]) => {
    const radio = input('radio');
    radio.name = name;
    radio.value = value;
    radio.checked = value === initial;
    if (focusKey) radio.dataset.focus = `${focusKey}-${value}`;
    list.append(el('label', 'w-choice', radio, el('span', '', caption)));
    return radio;
  });
  element.append(legend, list);
  return {
    element,
    options,
    get value() {
      return options.find((option) => option.checked)?.value ?? '';
    },
    set value(value: string) {
      for (const option of options) option.checked = option.value === value;
    },
    addEventListener: (type: string, listener: () => void) =>
      element.addEventListener(type, listener),
  };
}
export function field(
  label: string,
  control: HTMLElement,
  help?: string,
): HTMLElement {
  if (
    control instanceof HTMLInputElement &&
    control.type === 'text' &&
    control.required &&
    !control.pattern
  )
    control.pattern = '.*\\S.*';
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
  options: { guard?: boolean } = {},
): {
  dialog: HTMLDialogElement;
  body: HTMLElement;
  footer: HTMLElement;
  close: () => void;
  onClose: (callback: () => void) => void;
} {
  // User-initiated dismissal (drag, backdrop, Escape) never silently
  // discards typed input. Programmatic sheet.close() stays unguarded.
  const guard = options.guard !== false;
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
  const header = el(
    'header',
    'w-dialog-head',
    el('span', 'w-sheet-grabber'),
    heading,
    closeButton,
  );
  header.querySelector('.w-sheet-grabber')!.setAttribute('aria-hidden', 'true');
  dialog.append(header, alerts, body, footer);
  let dismissConfirmOpen = false;
  const requestDismiss = (dismiss: () => void) => {
    if (dismissConfirmOpen) return;
    if (guard && dialogHasDirtyFields(dialog)) {
      dismissConfirmOpen = true;
      void confirmSheet(
        'Ungespeicherte Eingaben verwerfen?',
        'In diesem Dialog wurden Felder bearbeitet. Beim Schließen gehen diese Änderungen verloren.',
        'Verwerfen',
        { danger: true },
      ).then((confirmed) => {
        dismissConfirmOpen = false;
        if (confirmed) dismiss();
      });
      return;
    }
    dismiss();
  };
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
      requestDismiss(close);
  });
  dialog.addEventListener('cancel', (event) => {
    if (guard && dialogHasDirtyFields(dialog)) {
      event.preventDefault();
      requestDismiss(close);
    }
  });
  // Some fields (e.g. type=search) consume Escape for their own default
  // action, so the native cancel event never fires. Guard on keydown too.
  dialog.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      if (!guard || !dialogHasDirtyFields(dialog)) return;
      event.preventDefault();
      event.stopPropagation();
      requestDismiss(close);
    },
    true,
  );
  document.body.append(dialog);
  // The content is appended after modal() returns. Keep refreshing the
  // initial-value snapshot on focus movement until the first real edit
  // (input/change), so pre-filled or untouched forms never count as dirty
  // while every subsequent user change does.
  let userEdited = false;
  dialog.addEventListener(
    'input',
    () => {
      userEdited = true;
    },
    { capture: true },
  );
  dialog.addEventListener(
    'change',
    () => {
      userEdited = true;
    },
    { capture: true },
  );
  dialog.addEventListener(
    'focusin',
    () => {
      if (!userEdited) snapshotDialogFields(dialog);
    },
    { capture: true },
  );
  dialog.showModal();
  enableSheetDrag(dialog, dialog, [header], { requestDismiss });
  return {
    dialog,
    body,
    footer,
    close,
    onClose: (callback) => callbacks.push(callback),
  };
}

const dirtySnapshotKey = Symbol('w-dirty-snapshot');
type FieldSnapshot = {
  values: WeakMap<Element, string>;
  checked: WeakMap<Element, boolean>;
};

/**
 * Snapshot all form-control values of a dialog as the reference for dirty
 * detection. Programmatically pre-filled forms (edition selects, quantity
 * fields) never count as edited until the collector changes them.
 */
export function snapshotDialogFields(dialog: HTMLDialogElement): void {
  const values = new WeakMap<Element, string>();
  const checked = new WeakMap<Element, boolean>();
  for (const field of dialog.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input, textarea, select')) {
    values.set(field, field.value);
    if (field instanceof HTMLInputElement) checked.set(field, field.checked);
  }
  (dialog as unknown as Record<symbol, FieldSnapshot | undefined>)[
    dirtySnapshotKey
  ] = { values, checked };
}

/**
 * A dialog counts as dirty when any form control differs from the snapshot
 * taken at the first check (after the caller has built the content). The
 * first check only creates the reference and never reports dirty.
 */
export function dialogHasDirtyFields(dialog: HTMLDialogElement): boolean {
  const holder = dialog as unknown as Record<symbol, FieldSnapshot | undefined>;
  let snapshot = holder[dirtySnapshotKey];
  if (!snapshot) {
    snapshotDialogFields(dialog);
    return false;
  }
  for (const field of dialog.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >('input, textarea, select')) {
    if (field instanceof HTMLInputElement) {
      if (field.type === 'radio' || field.type === 'checkbox') {
        if (field.checked !== snapshot.checked.get(field)) return true;
        continue;
      }
    }
    if (field.value !== snapshot.values.get(field)) return true;
  }
  return false;
}

/**
 * The app's own confirmation sheet; replaces window.confirm. Resolves with
 * the collector's explicit choice and never blocks the main thread.
 */
export function confirmSheet(
  title: string,
  copy: string,
  confirmLabel = 'Bestätigen',
  options: { danger?: boolean } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const sheet = modal(title, false, { guard: false });
    sheet.dialog.classList.add('w-confirm-sheet');
    sheet.body.append(el('p', 'w-confirm-copy', copy));
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      sheet.close();
      resolve(value);
    };
    const primary = action(
      confirmLabel,
      () => settle(true),
      options.danger ? 'danger' : 'primary',
      options.danger ? 'trash' : 'check',
    );
    sheet.footer.append(
      action('Abbrechen', () => settle(false), 'secondary'),
      primary,
    );
    sheet.onClose(() => settle(false));
    primary.focus({ preventScroll: true });
  });
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
