import { describe, expect, it } from 'vitest';
import { priceLooksMisassigned } from '../../src/domain/price-integrity';

describe('Cardmarket product mapping integrity', () => {
  it('rejects 4 cent secret illustration rare values reused from base cards', () => {
    for (const localId of ['106', '111']) {
      expect(priceLooksMisassigned({
        localId,
        setOfficialCount: 103,
        amountEur: 0.04,
        tcgplayerMarketUsd: 20,
      })).toBe(true);
    }
  });

  it('keeps legitimate low-value main-set commons without inventing a rarity premium', () => {
    expect(priceLooksMisassigned({
      localId: '053',
      setOfficialCount: 103,
      amountEur: 0.04,
    })).toBe(false);
  });

  it('accepts plausible independent EUR data even for a secret printing', () => {
    expect(priceLooksMisassigned({
      localId: '111',
      setOfficialCount: 103,
      amountEur: 18.41,
      tcgplayerMarketUsd: 22.67,
    })).toBe(false);
  });

  it('withholds implausible USD/EUR disagreement without converting currencies', () => {
    expect(priceLooksMisassigned({
      localId: '049',
      setOfficialCount: 103,
      amountEur: 0.10,
      tcgplayerMarketUsd: 30,
    })).toBe(true);
  });

  it('rejects invalid and zero prices', () => {
    expect(priceLooksMisassigned({
      localId: '001',
      setOfficialCount: 103,
      amountEur: 0,
    })).toBe(true);
    expect(priceLooksMisassigned({
      localId: '001',
      setOfficialCount: 103,
      amountEur: Number.NaN,
    })).toBe(true);
  });
});
