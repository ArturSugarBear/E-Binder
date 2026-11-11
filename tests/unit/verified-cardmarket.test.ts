import { describe, expect, it } from 'vitest';
import { verifiedCardmarketProduct } from '../../src/data/verified-cardmarket';

const groudon = {
  id: 'me06-111',
  setId: 'me06',
  localId: '111',
  officialCount: 103,
  name: 'Groudon',
  language: 'de',
  normal: true,
};

describe('verified Cardmarket product crosswalk', () => {
  it('binds the rare to the independent product, never the base Groudon', () => {
    const rare = verifiedCardmarketProduct(groudon, Date.parse('2026-11-11T18:00:00Z'));
    expect(rare).toMatchObject({
      productId: 918949,
      observation: { amount: 17.81, basis: 'trend' },
    });
    expect(verifiedCardmarketProduct({ ...groudon, id: 'me06-053', localId: '053' })).toBeUndefined();
  });

  it('never borrows this price for the wrong name, language, set or foil', () => {
    expect(verifiedCardmarketProduct({ ...groudon, name: 'Fukano' })).toBeUndefined();
    expect(verifiedCardmarketProduct({ ...groudon, language: 'ja' })).toBeUndefined();
    expect(verifiedCardmarketProduct({ ...groudon, setId: 'me05' })).toBeUndefined();
    expect(verifiedCardmarketProduct({ ...groudon, normal: false })).toBeUndefined();
  });

  it('expires dated observations without discarding a verified product link', () => {
    const expired = verifiedCardmarketProduct(groudon, Date.parse('2026-11-19T00:00:00Z'));
    expect(expired?.productId).toBe(918949);
    expect(expired?.url).toContain('/Groudon-V2-DLR111');
    expect(expired?.observation).toBeUndefined();
  });
});
