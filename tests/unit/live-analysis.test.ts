import { describe, expect, it } from 'vitest';
import {
  isWorkingStage,
  LIVE_ANALYSIS_STAGES,
  liveStageLabel,
  liveStageRank,
} from '../../src/domain/live-analysis';

describe('honest live scanner stages', () => {
  it('orders the visible stages by real work', () => {
    expect(LIVE_ANALYSIS_STAGES).toEqual([
      'capture',
      'ocr',
      'visual',
      'catalog',
    ]);
    expect(liveStageRank('capture')).toBe(0);
    expect(liveStageRank('ocr')).toBe(1);
    expect(liveStageRank('visual')).toBe(2);
    expect(liveStageRank('catalog')).toBe(3);
    expect(liveStageRank('ready')).toBe(4);
    expect(liveStageRank('error')).toBe(4);
  });

  it('labels terminal states without inventing confidence', () => {
    expect(liveStageLabel('capture')).toBe('Foto');
    expect(liveStageLabel('ocr')).toBe('Text');
    expect(liveStageLabel('visual')).toBe('Motiv');
    expect(liveStageLabel('catalog')).toBe('Ausgabe');
    expect(liveStageLabel('ready')).toBe('Bereit');
    expect(liveStageLabel('error')).toBe('Prüfen');
    expect(liveStageLabel()).toBe('Foto');
  });

  it('only counts non-terminal stages as active work', () => {
    expect(isWorkingStage('capture')).toBe(true);
    expect(isWorkingStage('ocr')).toBe(true);
    expect(isWorkingStage('visual')).toBe(true);
    expect(isWorkingStage('catalog')).toBe(true);
    expect(isWorkingStage('ready')).toBe(false);
    expect(isWorkingStage('error')).toBe(false);
    expect(isWorkingStage()).toBe(false);
  });
});
