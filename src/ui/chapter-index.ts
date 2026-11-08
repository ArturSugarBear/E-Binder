import type { Collection } from '../domain/collection';
import { button, textElement, imagePath, number } from './dom';

export function renderIndex(
  chapters: Collection,
  index: HTMLElement,
  select: (position: number) => void,
) {
  const thumbnails = new IntersectionObserver((entries, observer) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      for (const img of target.querySelectorAll('img'))
        img.src = img.dataset.src ?? '';
      observer.unobserve(target);
    }
  });
  chapters.forEach((entry, position) => {
    const li = document.createElement('li');
    const item = button('idx', () => select(position));
    const fan = document.createElement('span');
    fan.className = 'fan';
    fan.setAttribute('aria-hidden', 'true');
    for (const id of entry.covers) {
      const image = document.createElement('img');
      image.className = 'art';
      image.alt = '';
      image.width = 63;
      image.height = 88;
      image.decoding = 'async';
      image.dataset.src = imagePath(id);
      fan.append(image);
    }
    if (entry.theme) item.dataset.theme = entry.theme;
    item.append(
      fan,
      textElement('span', 'idx-n', number(position)),
      textElement('strong', '', entry.title),
      textElement(
        'span',
        'idx-v',
        entry.value ?? `${entry.cards.length} Karten`,
      ),
    );
    li.append(item);
    index.append(li);
    thumbnails.observe(fan);
  });
}
