export function query<T extends HTMLElement = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const result = root.querySelector<T>(selector);
  if (!result) throw new Error(`Required UI element is missing: ${selector}`);
  return result;
}

export function button(
  className: string,
  action: () => void,
): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.addEventListener('click', action);
  return element;
}

export function textElement(
  tag: string,
  className: string,
  text: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

export const number = (position: number): string =>
  String(position + 1).padStart(2, '0');
export const icon = (step: number): string =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${step < 0 ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/></svg>`;

export const imagePath = (id: string): string =>
  `${import.meta.env.BASE_URL}assets/cards/${id}.webp`;
