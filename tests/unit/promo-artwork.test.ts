import { describe, expect, it } from 'vitest';
// @ts-expect-error Build-time JavaScript has no declaration file.
import * as promo from '../../scripts/promo-artwork.mjs';
const { promoArtwork, promoGroup, validatePromoGroup } = promo;
const card = {
  id: 'mep-080',
  localId: '080',
  name: 'Fennekin',
  set: { id: 'mep' },
  pricing: { tcgplayer: { holofoil: { productId: 694694 } } },
};
const product = {
  ...promoGroup,
  productId: 694694,
  name: 'Fennekin - 080',
  imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/694694_200w.jpg',
  extendedData: [{ name: 'Number', value: '080' }],
};
describe('promo artwork product contract', () => {
  it('requires the exact known group and a unique authoritative product join', () => {
    expect(validatePromoGroup([promoGroup])).toBe(true);
    expect(validatePromoGroup([{ ...promoGroup, name: 'Different set' }])).toBe(
      false,
    );
    expect(validatePromoGroup([promoGroup, promoGroup])).toBe(false);
    const stamped = {
      ...product,
      productId: 694695,
      name: 'Fennekin - 080 (Pokemon Center Exclusive)',
      imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/694695_200w.jpg',
    };
    expect(promoArtwork(card, [stamped, product])).toMatchObject({
      providerId: 'tcgplayer:694694',
      language: 'en',
    });
    expect(promoArtwork(card, [stamped])).toBeUndefined();
    expect(promoArtwork(card, [product, product])).toBeUndefined();
    expect(promoArtwork({ ...card, pricing: null }, [product])).toBeUndefined();
  });
  it('accepts reviewed missing-ID previews and the explicit unnumbered jumbo mapping', () => {
    const treecko = {
      ...card,
      id: 'mep-055',
      localId: '055',
      name: 'Treecko',
      pricing: null,
    };
    const treeckoProduct = {
      ...product,
      productId: 709969,
      name: 'Treecko -  055',
      imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/709969_200w.jpg',
      extendedData: [{ name: 'Number', value: '055' }],
    };
    expect(promoArtwork(treecko, [treeckoProduct])?.providerId).toBe(
      'tcgplayer:709969',
    );
    const museum = {
      id: 'mep-Museum',
      localId: 'Museum',
      name: 'Pikachu at the Museum',
      set: { id: 'mep' },
      variants_detailed: [{ size: 'jumbo', thirdParty: { tcgplayer: 678659 } }],
    };
    const jumbo = {
      ...product,
      productId: 678659,
      groupId: 1528,
      name: museum.name,
      imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/678659_200w.jpg',
      extendedData: [],
    };
    expect(promoArtwork(museum, [jumbo])?.providerId).toBe('tcgplayer:678659');
    expect(
      promoArtwork({ ...museum, variants_detailed: [] }, [jumbo]),
    ).toBeUndefined();
    expect(
      promoArtwork(museum, [{ ...jumbo, groupId: 24451 }]),
    ).toBeUndefined();
  });
  it.each([
    { groupId: 1 },
    { categoryId: 1 },
    { name: 'Fennekin V - 080' },
    { extendedData: [{ name: 'Number', value: '081' }] },
    { imageUrl: 'https://evil.example/694694_200w.jpg' },
    { imageUrl: 'https://tcgplayer-cdn.tcgplayer.com/product/694695_200w.jpg' },
    { imageUrl: 'http://tcgplayer-cdn.tcgplayer.com/product/694694_200w.jpg' },
  ])('rejects mismatched print data: %j', (patch) => {
    expect(promoArtwork(card, [{ ...product, ...patch }])).toBeUndefined();
  });
  it('allows a qualifier only with the exact product ID, number and set', () => {
    expect(
      promoArtwork(card, [{ ...product, name: 'Fennekin (Cosmos Holo)' }]),
    ).toBeDefined();
    expect(
      promoArtwork({ ...card, set: { id: 'other' } }, [product]),
    ).toBeUndefined();
    expect(promoArtwork({ ...card, id: 'mep-081' }, [product])).toBeUndefined();
  });
});
