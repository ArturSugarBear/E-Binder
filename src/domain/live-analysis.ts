/**
 * Honest scanner stages. Each stage is driven by real local work, never by a
 * timer or a fabricated confidence value. `ready` and `error` are terminal.
 */
export type LiveAnalysisStage =
  'capture' | 'ocr' | 'visual' | 'catalog' | 'ready' | 'error';

export const LIVE_ANALYSIS_STAGES = [
  'capture',
  'ocr',
  'visual',
  'catalog',
] as const;

export type LiveAnalysisProgressStage = (typeof LIVE_ANALYSIS_STAGES)[number];

const labels: Record<LiveAnalysisStage, string> = {
  capture: 'Foto',
  ocr: 'Text',
  visual: 'Motiv',
  catalog: 'Ausgabe',
  ready: 'Bereit',
  error: 'Prüfen',
};

/** Position in the visible rail; terminal states keep the last real step. */
export function liveStageRank(stage?: LiveAnalysisStage): number {
  switch (stage) {
    case 'ocr':
      return 1;
    case 'visual':
      return 2;
    case 'catalog':
      return 3;
    case 'ready':
      return 4;
    case 'error':
      return 4;
    case 'capture':
    default:
      return 0;
  }
}

export function liveStageLabel(stage?: LiveAnalysisStage): string {
  return stage ? labels[stage] : labels.capture;
}

/** True only for the non-terminal stages that count as active work. */
export function isWorkingStage(stage?: LiveAnalysisStage): boolean {
  return (
    stage === 'capture' ||
    stage === 'ocr' ||
    stage === 'visual' ||
    stage === 'catalog'
  );
}
