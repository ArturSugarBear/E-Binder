import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PersonalStore } from './personal-store';
import {
  emptyState,
  validateState,
  metadataOnlyState,
  type PersonalState,
} from '../domain/personal';

const marker = z.object({
  version: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
});
const rowSchema = z.object({
  version: z.number().int().positive(),
  state: z.unknown(),
});
/** Compare validated snapshots independent of JSONB object-key ordering.
 * An interrupted same-device sync may commit remotely before its marker is
 * written. Equal snapshots are safe to reconcile; divergent ones are not.
 */
function sameSnapshot(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length &&
      a.every((value, index) => sameSnapshot(value, b[index]))
    );
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]),
    )
  );
}
export class CloudStore extends PersonalStore {
  syncError = '';
  conflict = false;
  pendingSyncCount = 0;
  onSyncStatusChange?: () => void;
  private version = 0;
  private remoteQueue = Promise.resolve();
  private markerKey: string;
  constructor(
    private client: SupabaseClient,
    readonly userId: string,
  ) {
    super(`account:${userId}`);
    this.markerKey = `e-binder-sync:${userId}`;
  }
  private remember(state: PersonalState): void {
    localStorage.setItem(
      this.markerKey,
      JSON.stringify({ version: this.version, revision: state.revision }),
    );
  }
  async load(mode: PersonalState['mode']): Promise<PersonalState> {
    const cached = await super.load(mode);
    if (mode === 'demo') return cached;
    try {
      const meta = marker.safeParse(
        JSON.parse(localStorage.getItem(this.markerKey) ?? 'null'),
      );
      const previous = meta.success ? meta.data : { version: 0, revision: 0 };
      const force = localStorage.getItem(`${this.markerKey}:reload`) === 'yes';
      const { data, error } = await this.client
        .from('user_workspaces')
        .select('version,state')
        .eq('user_id', this.userId)
        .maybeSingle();
      if (error) throw error;
      const remote = data ? rowSchema.parse(data) : null;
      const remoteState = remote ? validateState(remote.state) : null;
      this.version = remote?.version ?? 0;
      if (!force && cached.revision !== previous.revision) {
        this.version = previous.version;
        if ((remote?.version ?? 0) !== previous.version) {
          // Last cloud RPC may have committed before its local marker did.
          // Equal complete snapshots prove there is no competing change;
          // revision equality alone is never enough evidence.
          if (
            remoteState?.mode === 'personal' &&
            sameSnapshot(metadataOnlyState(cached), metadataOnlyState(remoteState))
          ) {
            this.version = remote!.version;
            this.remember(cached);
            this.conflict = false;
            this.syncError = '';
            return cached;
          }
          this.conflict = true;
          throw new Error(
            'Auf einem anderen Gerät gibt es einen neueren Cloudstand. Dein lokaler Stand bleibt erhalten. Sichere ihn und wähle im Konto „Cloudstand laden“.',
          );
        }
        await this.push(cached);
        return cached;
      }
      const state = remoteState ?? emptyState('personal');
      if (state.mode !== 'personal')
        throw new Error('Ungültiger Cloudbestand.');
      await super.save(state);
      this.remember(state);
      localStorage.removeItem(`${this.markerKey}:reload`);
      this.syncError = '';
      return state;
    } catch (error) {
      this.syncError =
        this.conflict && error instanceof Error
          ? error.message
          : 'Cloud nicht erreichbar. Dein gespeicherter Stand auf diesem Gerät bleibt verfügbar.';
      return cached;
    }
  }
  private notifySyncStatus(): void {
    try {
      this.onSyncStatusChange?.();
    } catch {
      // Rendering must never interrupt local or remote persistence.
    }
  }
  save(state: PersonalState): Promise<void> {
    const snapshot = structuredClone(state);
    const local = super.save(snapshot);
    if (snapshot.mode !== 'personal') return local;
    this.pendingSyncCount++;
    this.notifySyncStatus();
    const operation = this.remoteQueue
      .catch(() => undefined)
      .then(async () => {
        await local;
        try {
          await this.push(snapshot);
        } catch (error) {
          this.conflict ||=
            error instanceof Error &&
            error.message.includes('WORKSPACE_CONFLICT');
          this.syncError = this.conflict
            ? 'Cloudkonflikt: Dein Stand wurde lokal gesichert. Exportiere ihn und lade den Cloudstand über „Konto“, bevor du weiter synchronisierst.'
            : 'Auf diesem Gerät gespeichert. Cloud-Sicherung ausstehend; bitte Verbindung prüfen und erneut synchronisieren.';
        }
      });
    this.remoteQueue = operation;
    const settled = () => {
      this.pendingSyncCount = Math.max(0, this.pendingSyncCount - 1);
      this.notifySyncStatus();
    };
    void operation.then(settled, settled);
    // The next scan only awaits local IndexedDB durability, not cloud latency.
    return local;
  }
  private async push(state: PersonalState): Promise<void> {
    if (this.conflict) throw new Error('WORKSPACE_CONFLICT');
    const { data, error } = await this.client.rpc('save_workspace', {
      p_state: metadataOnlyState(state),
      p_expected_version: this.version,
    });
    if (error) throw new Error(error.message);
    this.version = z.number().int().positive().parse(data);
    this.remember(state);
    this.syncError = '';
  }
  useRemoteOnNextLoad(): void {
    localStorage.setItem(`${this.markerKey}:reload`, 'yes');
  }
}
