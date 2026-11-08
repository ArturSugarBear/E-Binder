import type { Chapter } from '../domain/collection';
import { button, textElement, icon, imagePath, query } from './dom';
import { enableSwipe } from './swipe';

export function createCardDialog(sheet: HTMLDialogElement) {
  let currentChapter: Chapter | undefined;
  let cardIndex = 0;
  let opener: HTMLElement | undefined;
  const cardControls = [-1, 1].map((step) => {
    const control = button('sn', () => showCard(cardIndex + step));
    const caption = textElement('span', '', step < 0 ? 'Vorherige' : 'Nächste');
    control.innerHTML = icon(step);
    if (step < 0) control.append(caption);
    else control.prepend(caption);
    query('.sheet-nav', sheet).append(control);
    return control;
  });

  function showCard(position: number, trigger?: HTMLElement) {
    const entry = currentChapter;
    if (!entry) return;
    const card = entry.cards[position];
    if (!card) return;
    cardIndex = position;
    if (trigger) opener = trigger;
    const title = query('h2', sheet);
    const art = query<HTMLImageElement>('.big', sheet);
    sheet.dataset.theme = entry.theme ?? '';
    art.src = imagePath(card.id);
    art.alt = `Kartenbild ${card.name}`;
    title.textContent = card.name;
    query('.pos', sheet).textContent =
      `${entry.title} · ${position + 1} von ${entry.cards.length}`;
    query('.nr', sheet).textContent = card.number;
    query('.set-name', sheet).textContent = card.set;
    query('.facts .type', sheet).className = `type t-${card.type}`;
    query('.facts-text', sheet).textContent = card.facts;
    const priceLabel = query('.tag-label', sheet);
    query('.price-label', priceLabel).textContent = entry.priceDate
      ? 'Cardmarket-Preistrend'
      : 'Richtpreis Near Mint';
    query('small', priceLabel).textContent = entry.priceDate
      ? 'ohne Filter für Sprache oder Zustand'
      : 'günstigste Ausgabe, Deutsch oder Englisch';
    query('.tag strong', sheet).textContent = card.price;
    query('.lowest', sheet).textContent = card.lowest;
    query('.average', sheet).textContent = card.average30;
    query('.note', sheet).textContent =
      `Stand ${entry.priceDate ?? '7. November 2026'}. Das günstigste Angebot kann auch andere Sprachen oder schlechtere Zustände betreffen.`;
    query<HTMLAnchorElement>('.market', sheet).href = card.cardmarket;
    const focused = document.activeElement;
    cardControls[0]!.disabled = position === 0;
    cardControls[1]!.disabled = position === entry.cards.length - 1;
    if (!sheet.open) sheet.showModal();
    else if (
      focused instanceof HTMLButtonElement &&
      cardControls.includes(focused) &&
      focused.disabled
    ) {
      cardControls
        .find((control) => !control.disabled)
        ?.focus({ preventScroll: true });
    }
    query('.sheet-body', sheet).scrollTop = 0;
  }

  query('.close', sheet).addEventListener('click', () => sheet.close());
  let backdropPress = false;
  sheet.addEventListener('pointerdown', (event) => {
    backdropPress = event.target === sheet;
  });
  sheet.addEventListener('click', (event) => {
    if (backdropPress && event.target === sheet) sheet.close();
  });
  sheet.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = undefined;
  });
  enableSwipe(query('.stage', sheet), (step) => showCard(cardIndex + step));
  return {
    open(entry: Chapter, position: number, trigger?: HTMLElement) {
      currentChapter = entry;
      showCard(position, trigger);
    },
    step(step: number) {
      showCard(cardIndex + step);
    },
    close() {
      if (sheet.open) sheet.close();
    },
    get isOpen() {
      return sheet.open;
    },
  };
}
