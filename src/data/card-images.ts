import { normalize, numberKey } from '../domain/personal';
import type { Palette, PersonalCard, PersonalState } from '../domain/personal';
import type { PersonalStore } from './personal-store';
import {
  catalogEntry,
  fillCatalogImages,
  imageLanguage,
  catalogArtworkUrl,
} from './card-catalog';
import { secondaryCardArt } from './artwork-fallbacks';
import { verifiedLocalArt } from './verified-images';

export class CardImages {
  private palettes = new Map<string, Promise<Palette | undefined>>();
  private resources = new Map<
    string,
    { until: number; value: Promise<string>; loaded?: boolean }
  >();
  constructor(
    _store: PersonalStore,
    private mode: () => PersonalState['mode'],
  ) {}
  url(card: PersonalCard): Promise<string> {
    const key = this.resourceKey(card);
    const cached = this.resources.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    const resource = { until: Date.now() + 300_000, value: this.remote(card) };
    this.remember(key, resource);
    void resource.value.then(
      (url) => {
        if (!url && this.resources.get(key) === resource)
          resource.until = Date.now() + 30_000;
      },
      () => {
        if (this.resources.get(key) === resource) this.resources.delete(key);
      },
    );
    return resource.value;
  }
  private remember(
    key: string,
    resource: { until: number; value: Promise<string>; loaded?: boolean },
  ): void {
    if (!this.resources.has(key) && this.resources.size >= 500)
      this.resources.delete(this.resources.keys().next().value!);
    this.resources.set(key, resource);
  }
  private resourceKey(card: PersonalCard): string {
    return JSON.stringify([
      this.mode(),
      card.source,
      card.sourceId,
      card.setId,
      card.number,
      card.language,
      card.image,
      card.name,
      card.finishes,
    ]);
  }
  private async remote(card: PersonalCard): Promise<string> {
    if (
      card.source === 'tcgdex' &&
      card.sourceId &&
      !exactPrimaryArtwork(card)
    ) {
      try {
        const resolved = (await catalogEntry(card.sourceId, card.language))
          .card;
        const apiImage =
          resolved.setId === card.setId &&
          numberKey(resolved.number) === numberKey(card.number) &&
          normalize(resolved.name) === normalize(card.name)
            ? resolved.image
            : '';
        if (apiImage) return apiImage;
      } catch {
        // Known, licensed-in-project local artwork still works offline.
      }
      const art = await secondaryCardArt(card);
      if (art) return art.url;
      const local = verifiedLocalArt({ ...card, image: '' });
      if (local) return `${import.meta.env.BASE_URL}${local}`;
      return '';
    }
    return card.image.startsWith('assets/')
      ? `${import.meta.env.BASE_URL}${card.image}`
      : card.image;
  }
  artwork(card: PersonalCard, className = ''): HTMLElement {
    const resourceKey = this.resourceKey(card);
    const frame = document.createElement('span');
    frame.className = `card-art ${className}`;
    const fallback = document.createElement('span');
    fallback.className = 'art-fallback';
    fallback.textContent = 'Bild wird geladen …';
    const language = document.createElement('span');
    language.className = 'w-art-language';
    language.hidden = true;
    const labelLanguage = (url: string) => {
      const displayed =
        (card.language === 'ja' || /^(?:M1L|M1S)$/i.test(card.setId)) &&
        url.startsWith('https://tcgplayer-cdn.tcgplayer.com/product/')
          ? 'ja'
          : imageLanguage(url);
      language.hidden = !displayed || displayed === card.language;
      if (displayed) language.textContent = `Bild: ${displayed.toUpperCase()}`;
    };
    const missing = () => {
      image.hidden = true;
      fallback.hidden = false;
      fallback.replaceChildren();
      const message = document.createElement('span');
      message.className = 'w-art-fallback-title';
      message.textContent = 'Bild noch nicht verfügbar';
      const identity = document.createElement('strong');
      identity.className = 'w-art-fallback-card';
      identity.textContent = card.name;
      const edition = document.createElement('small');
      edition.className = 'w-art-fallback-edition';
      edition.textContent = `${card.setName} · ${card.number}`;
      fallback.append(message, identity, edition);
      frame.dataset.imageState = 'unavailable';
      frame.dataset.imageReason ??= 'no-verified-exact-artwork';
    };
    let retried = false;
    let triedLocal = false;
    let triedSecondary = false;
    const secondaryFallback = () => {
      if (triedSecondary) {
        missing();
        return;
      }
      triedSecondary = true;
      void secondaryCardArt(card)
        .then((art) => {
          if (!art) {
            missing();
            return;
          }
          frame.dataset.imageSource = 'secondary';
          image.src = art.url;
          language.hidden = art.language === card.language;
          language.textContent = `Bild: ${art.language.toUpperCase()}`;
        })
        .catch(missing);
    };
    const localFallback = () => {
      const local = verifiedLocalArt({ ...card, image: '' });
      if (local && !triedLocal) {
        triedLocal = true;
        image.src = `${import.meta.env.BASE_URL}${local}`;
        language.hidden = true;
        frame.dataset.imageSource = 'local';
      } else secondaryFallback();
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
      delete frame.dataset.imageReason;
      // Reuse a successful exact-print fallback on the next page visit.
      this.remember(resourceKey, {
        until: Date.now() + 300_000,
        value: Promise.resolve(image.src),
        loaded: true,
      });
    });
    image.addEventListener('error', () => {
      frame.dataset.imageReason = 'asset-load-failed';
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
          image.src = catalogArtworkUrl(url);
          labelLanguage(image.src);
        })
        .catch(localFallback);
    });
    frame.append(fallback, image, language);
    frame.dataset.imageState = 'loading';
    frame.dataset.imageSource = 'primary';
    void this.url(card)
      .then((url) => {
        if (url) {
          if (
            /^https:\/\/(?:images\.(?:pokemontcg\.io|scrydex\.com)|tcgplayer-cdn\.tcgplayer\.com)\//.test(
              url,
            )
          )
            frame.dataset.imageSource = 'secondary';
          image.src = url;
          labelLanguage(url);
          if (this.resources.get(resourceKey)?.loaded) fallback.hidden = true;
        } else localFallback();
      })
      .catch(localFallback);
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

/** Stored URLs are hints, never permission to display another printing. */
export function exactPrimaryArtwork(card: PersonalCard): boolean {
  try {
    const url = new URL(card.image);
    const parts = url.pathname.split('/');
    const local = card.sourceId.slice(card.setId.length + 1);
    const assetSet = card.setId === 'swsh12.5gg' ? 'swsh12.5' : card.setId;
    return (
      url.protocol === 'https:' &&
      url.hostname === 'assets.tcgdex.net' &&
      card.sourceId.startsWith(`${card.setId}-`) &&
      numberKey(local) === numberKey(card.number).split('/')[0] &&
      parts[3] === assetSet &&
      numberKey(parts[4] ?? '') === numberKey(local) &&
      (parts[1] === card.language ||
        (card.language === 'de' && parts[1] === 'en'))
    );
  } catch {
    return false;
  }
}
