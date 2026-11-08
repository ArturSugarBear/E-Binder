const chapter = document.querySelector('.chapter');
const chapterTitle = chapter.querySelector('h1');
const index = document.querySelector('.index ol');
const sheet = document.querySelector('.sheet');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icon = (step) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${step < 0 ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/></svg>`;

let chapters;
let chapterIndex = -1;
let cardIndex = 0;
let opener;

function imagePath(id) {
  return new URL(`../assets/cards/${id}.webp`, import.meta.url).href;
}

function button(className, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.addEventListener('click', action);
  return element;
}

function textElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function cardImage(card, load = true) {
  const image = document.createElement('img');
  image.className = 'art';
  image.width = 63;
  image.height = 88;
  image.alt = load ? `${card.name}, ${card.set} ${card.number}` : '';
  image.decoding = 'async';
  if (load) image.src = imagePath(card.id);
  return image;
}

function renderIndex() {
  const thumbnails = new IntersectionObserver((entries, observer) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      for (const img of target.querySelectorAll('img')) img.src = img.dataset.src;
      observer.unobserve(target);
    }
  });
  chapters.forEach((entry, position) => {
    const li = document.createElement('li');
    const item = button('idx', () => showChapter(position, { scroll: true, focus: true }));
    const fan = document.createElement('span');
    fan.className = 'fan';
    fan.setAttribute('aria-hidden', 'true');
    for (const id of entry.covers) {
      const image = cardImage(null, false);
      image.dataset.src = imagePath(id);
      fan.append(image);
    }
    item.append(fan, textElement('span', 'idx-n', number(position)), textElement('strong', '', entry.title), textElement('span', 'idx-v', entry.value));
    li.append(item);
    index.append(li);
    thumbnails.observe(fan);
  });
}

function number(position) {
  return String(position + 1).padStart(2, '0');
}

function showChapter(position, { address = true, scroll = false, focus = false } = {}) {
  const entry = chapters[position];
  if (!entry) return;
  if (address) history.replaceState(null, '', `#kapitel-${position + 1}`);
  if (position !== chapterIndex) {
    if (sheet.open) sheet.close();
    chapterIndex = position;
    chapterTitle.textContent = entry.title;
    chapter.querySelector('.desc').textContent = entry.description;
    chapter.querySelector('.meta').textContent = `Kapitel ${position + 1} von ${chapters.length} · Seitenwert ${entry.value}`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    const rows = entry.cards.map((card, i) => {
      const pocket = button('pocket', () => showCard(i, pocket));
      pocket.setAttribute('aria-haspopup', 'dialog');
      pocket.title = card.name;
      pocket.append(cardImage(card));
      grid.append(pocket);

      const row = button('row', () => showCard(i, row));
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
    chapter.querySelector('.grid').replaceWith(grid);
    chapter.querySelector('.inv ol').replaceChildren(...rows);
    renderPager();
    for (const [i, li] of Array.from(index.children).entries()) {
      li.firstElementChild.setAttribute('aria-current', i === position ? 'page' : 'false');
    }
  }
  if (focus) chapterTitle.focus({ preventScroll: true });
  if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'instant' : 'smooth' });
}

function renderPager() {
  const pager = chapter.querySelector('.pager');
  pager.replaceChildren(chapterButton(-1), textElement('span', 'count', `${number(chapterIndex)} / ${chapters.length}`), chapterButton(1));
}

function chapterButton(step) {
  const position = chapterIndex + step;
  const entry = chapters[position];
  const direction = step < 0 ? 'prev' : 'next';
  if (!entry) return textElement('span', `pg ${direction} off`, '');
  const control = button(`pg ${direction}`, () => showChapter(position, { scroll: true, focus: true }));
  const caption = textElement('span', '', '');
  caption.append(textElement('small', '', step < 0 ? 'Zurück' : 'Weiter'), entry.title);
  control.innerHTML = icon(step);
  if (step < 0) control.append(caption);
  else control.prepend(caption);
  return control;
}

const cardControls = [-1, 1].map((step) => {
  const control = button('sn', () => showCard(cardIndex + step));
  const caption = textElement('span', '', step < 0 ? 'Vorherige' : 'Nächste');
  control.innerHTML = icon(step);
  if (step < 0) control.append(caption);
  else control.prepend(caption);
  sheet.querySelector('.sheet-nav').append(control);
  return control;
});

function showCard(position, trigger) {
  const entry = chapters[chapterIndex];
  const card = entry.cards[position];
  if (!card) return;
  cardIndex = position;
  if (trigger) opener = trigger;
  const title = sheet.querySelector('h2');
  const art = sheet.querySelector('.big');
  art.src = imagePath(card.id);
  art.alt = `Kartenbild ${card.name}`;
  title.textContent = card.name;
  sheet.querySelector('.pos').textContent = `${entry.title} · ${position + 1} von ${entry.cards.length}`;
  sheet.querySelector('.nr').textContent = card.number;
  sheet.querySelector('.set-name').textContent = card.set;
  sheet.querySelector('.facts .type').className = `type t-${card.type}`;
  sheet.querySelector('.facts-text').textContent = card.facts;
  sheet.querySelector('.tag strong').textContent = card.price;
  sheet.querySelector('.lowest').textContent = card.lowest;
  sheet.querySelector('.average').textContent = card.average30;
  sheet.querySelector('.market').href = card.cardmarket;
  const focused = document.activeElement;
  cardControls[0].disabled = position === 0;
  cardControls[1].disabled = position === entry.cards.length - 1;
  if (!sheet.open) sheet.showModal();
  else if (cardControls.includes(focused) && focused.disabled) {
    cardControls.find((control) => !control.disabled)?.focus({ preventScroll: true });
  }
  sheet.querySelector('.sheet-body').scrollTop = 0;
}

function enableSwipe(element, navigate) {
  let start;
  let suppressClick = false;
  element.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressClick = false;
  });
  element.addEventListener('pointercancel', () => { start = undefined; });
  element.addEventListener('pointerup', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = undefined;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    suppressClick = true;
    // Let the browser finish the touch sequence before replacing the touched card.
    requestAnimationFrame(() => navigate(dx < 0 ? 1 : -1));
  });
  element.addEventListener('click', (event) => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function fromHash() {
  const match = /^#kapitel-([1-9]\d*)$/.exec(location.hash);
  if (match) showChapter(Number(match[1]) - 1, { address: false, scroll: true });
  if (chapterIndex < 0) showChapter(0, { address: false });
}

function start(data) {
  chapters = data;
  renderIndex();
  fromHash();
  addEventListener('hashchange', fromHash);
  enableSwipe(chapter.querySelector('.sheetpage'), (step) => showChapter(chapterIndex + step));
  enableSwipe(sheet.querySelector('.stage'), (step) => showCard(cardIndex + step));

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    if (sheet.open) showCard(cardIndex + step);
    else showChapter(chapterIndex + step, { scroll: true, focus: true });
  });
  sheet.querySelector('.close').addEventListener('click', () => sheet.close());
  let backdropPress = false;
  sheet.addEventListener('pointerdown', (event) => { backdropPress = event.target === sheet; });
  sheet.addEventListener('click', (event) => {
    if (backdropPress && event.target === sheet) sheet.close();
  });
  sheet.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = undefined;
  });
}

fetch(new URL('./collection.json', import.meta.url))
  .then((response) => {
    if (!response.ok) throw new Error(`Collection request failed (${response.status})`);
    return response.json();
  })
  .then(start)
  .catch((error) => {
    document.querySelector('#load-error').hidden = false;
    console.error(error);
  });
