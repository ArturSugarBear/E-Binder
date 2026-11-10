import { describe, expect, it } from 'vitest';
import { anniversaryEnergyFromText } from '../../src/domain/anniversary-energy';

describe('30th-anniversary printed energy codes', () => {
  it('recognizes the photographed MEE 016 holo Metall-Energie without guessing a catalogue image', () => {
    const found = anniversaryEnergyFromText(
      'Basis-Energie\nMEE 016\n30 Jahre',
      'de',
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      name: 'Basis-Metall-Energie',
      setName: '30 Jahre',
      number: 'MEE 016',
      language: 'de',
      source: 'manual',
      image: '',
      finishes: ['holo'],
    });
  });

  it('keeps the 30th print separate from ordinary MEE 001–008 cards', () => {
    expect(anniversaryEnergyFromText('MEE 008', 'de')).toEqual([]);
    expect(anniversaryEnergyFromText('MEE 017', 'de')).toEqual([]);
    expect(anniversaryEnergyFromText('Nur Energie', 'de')).toEqual([]);
    expect(anniversaryEnergyFromText('AMMEE 016', 'de')).toEqual([]);
    expect(anniversaryEnergyFromText('MEE 016/128', 'de')).toEqual([]);
  });

  it('supports printed leading-zero OCR substitutions without fabricating Japanese editions', () => {
    const found = anniversaryEnergyFromText('MEE O16', 'en');
    expect(found[0]).toMatchObject({
      name: 'Basic Metal Energy',
      number: 'MEE 016',
      language: 'en',
    });
    expect(anniversaryEnergyFromText('MEE 016', 'ja')).toEqual([]);
  });

  it('deduplicates repeated printing observations and keeps different energy types separate', () => {
    expect(
      anniversaryEnergyFromText('MEE 009\nMEE 016\nMEE 016', 'de').map(
        (card) => card.number,
      ),
    ).toEqual(['MEE 009', 'MEE 016']);
  });
});
