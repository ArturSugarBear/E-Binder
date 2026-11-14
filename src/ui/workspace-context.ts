import type { Collection } from '../domain/collection';
import type { PersonalCard, PersonalState } from '../domain/personal';
import type { CardImages } from '../data/card-images';
import type { PersonalStore } from '../data/personal-store';

export interface AddOptions {
  browse?: boolean;
  artist?: string;
  setId?: string;
  language?: string;
  card?: PersonalCard;
  captureId?: string;
  photos?: boolean;
  live?: boolean;
  /** Captures buffered by the standalone live-scanner flow, reviewed after capture. */
  liveCaptures?: { file: File; aligned: boolean }[];
  correctHoldingId?: string;
}
export interface WorkspaceContext {
  account?: { id: string; username: string };
  state: PersonalState;
  catalog: PersonalCard[];
  chapters: Collection;
  store: PersonalStore;
  images: CardImages;
  filters: { query: string; kind: string; order: string };
  commit: (
    label: string,
    operation: (state: PersonalState) => PersonalState,
    options?: { undo?: boolean; notify?: boolean },
  ) => boolean;
  notify: (text: string, error?: boolean) => void;
  render: () => void;
  navigate: (route: string) => void;
  openAdd: (options?: AddOptions) => void;
  /** Open the live card scanner directly; review/filing opens only after capture. */
  openLiveScan: () => void;
  openPageScan: (binderId?: string) => void;
  openHolding: (id: string) => void;
  openBackup: () => void;
  switchMode: (mode: PersonalState['mode']) => Promise<void>;
  restore: (state: PersonalState) => Promise<boolean>;
}
