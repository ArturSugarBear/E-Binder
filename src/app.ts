import type { Card, Collection } from './domain/collection';
import { chapterHash, resolveChapter } from './domain/navigation';
import { button, textElement, imagePath, number, icon, query } from './ui/dom';
import { createCardDialog } from './ui/card-dialog';
import { renderIndex } from './ui/chapter-index';
import { enableSwipe } from './ui/swipe';

export function mountBinder(chapters: Collection): void {
  const chapter = query('.chapter');
  const chapterTitle = query('h1', chapter);
  const index = query('.index ol');
  const dialog = createCardDialog(query<HTMLDialogElement>('.sheet'));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let chapterIndex = -1;
  function cardImage(card: Card) {
    const image = document.createElement('img');
    image.className = 'art';
    image.width = 63;
    image.height = 88;
    image.alt = `${card.name}, ${card.set} ${card.number}`;
    image.decoding = 'async';
    image.src = imagePath(card.id);
    return image;
  }

  function showChapter(
    position: number,
    { address = true, scroll = false, focus = false } = {},
  ) {
    const entry = chapters[position];
    if (!entry) return;
    if (address && location.hash !== chapterHash(position))
      history.pushState(null, '', chapterHash(position));
    if (position !== chapterIndex) {
      dialog.close();
      chapterIndex = position;
      chapter.dataset.theme = entry.theme ?? '';
      const edition = query('.edition', chapter);
      edition.hidden = !entry.edition;
      if (entry.edition) {
        query('.edition-number', edition).textContent = entry.edition;
        const [name, series] = entry.title.split(' · ');
        chapterTitle.replaceChildren(
          name ?? entry.title,
          textElement('span', 'edition-series', ` · ${series}`),
        );
      } else {
        chapterTitle.textContent = entry.title;
      }
      query('.desc', chapter).textContent = entry.description;
      const summary = entry.value
        ? `Seitenwert ${entry.value}`
        : `${entry.cards.length} Karten`;
      query('.meta', chapter).textContent =
        `Kapitel ${position + 1} von ${chapters.length} · ${summary}`;
      const grid = document.createElement('div');
      grid.className = 'grid';
      const rows = entry.cards.map((card, i) => {
        const pocket = button('pocket', () => dialog.open(entry, i, pocket));
        pocket.setAttribute('aria-haspopup', 'dialog');
        pocket.title = card.name;
        pocket.append(cardImage(card));
        grid.append(pocket);

        const row = button('row', () => dialog.open(entry, i, row));
        row.setAttribute('aria-haspopup', 'dialog');
        row.append(
          textElement('span', `type t-${card.type}`, ''),
          textElement('span', 'row-name', card.name),
          textElement('span', 'row-nr', card.number),
          textElement('span', 'row-price', card.price),
        );
        const li = document.createElement('li');
        li.append(row);
        return li;
      });
      query('.grid', chapter).replaceWith(grid);
      query('.inv ol', chapter).replaceChildren(...rows);
      renderPager();
      for (const [i, li] of Array.from(index.children).entries()) {
        li.firstElementChild?.setAttribute(
          'aria-current',
          i === position ? 'page' : 'false',
        );
      }
    }
    if (focus) chapterTitle.focus({ preventScroll: true });
    if (scroll)
      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? 'instant' : 'smooth',
      });
  }

  function renderPager() {
    const pager = query('.pager', chapter);
    pager.replaceChildren(
      chapterButton(-1),
      textElement(
        'span',
        'count',
        `${number(chapterIndex)} / ${chapters.length}`,
      ),
      chapterButton(1),
    );
  }

  function chapterButton(step: number) {
    const position = chapterIndex + step;
    const entry = chapters[position];
    const direction = step < 0 ? 'prev' : 'next';
    if (!entry) return textElement('span', `pg ${direction} off`, '');
    const control = button(`pg ${direction}`, () =>
      showChapter(position, { scroll: true, focus: true }),
    );
    const caption = textElement('span', '', '');
    caption.append(
      textElement('small', '', step < 0 ? 'Zurück' : 'Weiter'),
      entry.title,
    );
    control.innerHTML = icon(step);
    if (step < 0) control.append(caption);
    else control.prepend(caption);
    return control;
  }

  function fromHash() {
    const position = resolveChapter(location.hash, chapters, chapterIndex);
    showChapter(position, {
      address: false,
      scroll:
        location.hash.startsWith('#kapitel-') || location.hash === '#greninja',
    });
  }
  const totalCards = chapters.reduce(
    (total, entry) => total + entry.cards.length,
    0,
  );
  document.title = `Kartenarchiv · ${totalCards} Pokémon-Karten in ${chapters.length} Kapiteln`;
  query('.collection-count').textContent =
    `${totalCards} Karten in ${chapters.length} Kapiteln`;
  query('.to-greninja').hidden = !chapters.some(
    (entry) => entry.theme === 'greninja',
  );
  renderIndex(chapters, index, (position) =>
    showChapter(position, { scroll: true, focus: true }),
  );
  fromHash();
  addEventListener('hashchange', fromHash);
  addEventListener('popstate', fromHash);
  enableSwipe(query('.sheetpage', chapter), (step) =>
    showChapter(chapterIndex + step),
  );
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable ||
        event.target.closest('input, textarea, select'))
    )
      return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    if (dialog.isOpen) dialog.step(step);
    else showChapter(chapterIndex + step, { scroll: true, focus: true });
  });
}
