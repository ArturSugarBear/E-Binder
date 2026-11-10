import type { Palette, PersonalCard, PersonalState } from '../domain/personal';
import type { PersonalStore } from './personal-store';
import { catalogEntry, fillCatalogImages, imageLanguage } from './card-catalog';
import { verifiedLocalArt } from './verified-images';

export class CardImages {
  private palettes = new Map<string, Promise<Palette | undefined>>();
  constructor(
    _store: PersonalStore,
    private mode: () => PersonalState['mode'],
  ) {}
  url(card: PersonalCard): Promise<string> {
    return this.remote(card);
  }
  private async remote(card: PersonalCard): Promise<string> {
    if (!card.image && card.source === 'tcgdex' && card.sourceId) {
      try {
        const apiImage = (await catalogEntry(card.sourceId, card.language))
          .card.image;
        if (apiImage) return apiImage;
      } catch {
        // Known, licensed-in-project local artwork still works offline.
      }
      const local = verifiedLocalArt(card);
      if (local) return `${import.meta.env.BASE_URL}${local}`;
      return '';
    }
    return card.image.startsWith('assets/')
      ? `${import.meta.env.BASE_URL}${card.image}`
      : card.image;
  }
  artwork(card: PersonalCard, className = ''): HTMLElement {
    const frame = document.createElement('span');
    frame.className = `card-art ${className}`;
    const fallback = document.createElement('span');
    fallback.className = 'art-fallback';
    fallback.textContent = 'Bild wird geladen …';
    const language = document.createElement('span');
    language.className = 'w-art-language';
    language.hidden = true;
    const labelLanguage = (url: string) => {
      const displayed = imageLanguage(url);
      language.hidden = !displayed || displayed === card.language;
      if (displayed) language.textContent = `Bild: ${displayed.toUpperCase()}`;
    };
    const missing = () => {
      image.hidden = true;
      fallback.hidden = false;
      fallback.textContent = 'Kein Katalogbild verfügbar';
      frame.dataset.imageState = 'unavailable';
    };
    let retried = false;
    let triedLocal = false;
    const localFallback = () => {
      const local = verifiedLocalArt({ ...card, image: '' });
      if (local && !triedLocal) {
        triedLocal = true;
        image.src = `${import.meta.env.BASE_URL}${local}`;
        language.hidden = true;
      } else missing();
    };
    const image = document.createElement('img');
    image.alt = `${card.name}, ${card.setName} ${card.number}`;
    image.width = 63;
    image.height = 88;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => {
      fallback.hidden = true;
      frame.dataset.imageState = 'loaded';
    });
    image.addEventListener('error', () => {
      if (
        retried ||
        card.language !== 'de' ||
        card.source !== 'tcgdex' ||
        imageLanguage(image.src) === 'en'
      ) {
        localFallback();
        return;
      }
      retried = true;
      void fillCatalogImages([
        {
          id: card.sourceId,
          localId: card.number.split('/')[0]!,
          name: card.name,
          language: card.language,
        },
      ])
        .then((cards) => {
          const url = cards[0]?.image;
          if (!url) {
            localFallback();
            return;
          }
          image.src = `${url}/high.webp`;
          labelLanguage(image.src);
        })
        .catch(localFallback);
    });
    frame.append(fallback, image, language);
    frame.dataset.imageState = 'loading';
    void this.url(card)
      .then((url) => {
        if (url) {
          image.src = url;
          labelLanguage(url);
        } else missing();
      })
      .catch(missing);
    return frame;
  }
  palette(card: PersonalCard): Promise<Palette | undefined> {
    if (card.palette) return Promise.resolve(card.palette);
    const key = `${this.mode()}:${card.image}`;
    if (!this.palettes.has(key)) this.palettes.set(key, this.measure(card));
    return this.palettes.get(key)!;
  }
  private async measure(card: PersonalCard): Promise<Palette | undefined> {
    try {
      const url = await this.url(card);
      if (!url) return undefined;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          image.onload = null;
          image.onerror = null;
          image.src = '';
          reject(new Error('Bild lädt zu lange.'));
        }, 10000);
        image.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        image.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Bild nicht auswertbar.'));
        };
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return undefined;
      context.drawImage(
        image,
        image.width * 0.06,
        image.height * 0.15,
        image.width * 0.88,
        image.height * 0.43,
        0,
        0,
        32,
        32,
      );
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let x = 0,
        y = 0,
        saturation = 0,
        lightness = 0,
        count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index]! / 255,
          g = pixels[index + 1]! / 255,
          b = pixels[index + 2]! / 255;
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min;
        const sat = max ? delta / max : 0;
        lightness += (max + min) / 2;
        if (sat < 0.2 || max < 0.15 || max > 0.95) continue;
        const angle =
          ((delta === 0
            ? 0
            : max === r
              ? ((g - b) / delta + 6) % 6
              : max === g
                ? (b - r) / delta + 2
                : (r - g) / delta + 4) *
            Math.PI) /
          3;
        x += sat * Math.cos(angle);
        y += sat * Math.sin(angle);
        saturation += sat;
        count++;
      }
      if (!count || Math.hypot(x, y) < 0.001) return undefined;
      return {
        hue: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
        saturation: saturation / count,
        lightness: lightness / (pixels.length / 4),
      };
    } catch {
      return undefined;
    }
  }
}
