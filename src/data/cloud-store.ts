import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PersonalStore, allPhotoIds } from './personal-store';
import {
  emptyState,
  validateState,
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
export class CloudStore extends PersonalStore {
  syncError = '';
  conflict = false;
  private version = 0;
  private remoteQueue = Promise.resolve();
  private uploaded = new Set<string>();
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
      this.version = remote?.version ?? 0;
      if (!force && cached.revision !== previous.revision) {
        this.version = previous.version;
        if ((remote?.version ?? 0) !== previous.version) {
          this.conflict = true;
          throw new Error(
            'Auf einem anderen Gerät gibt es einen neueren Cloudstand. Dein lokaler Stand bleibt erhalten. Sichere ihn und wähle im Konto „Cloudstand laden“.',
          );
        }
        await this.push(cached);
        return cached;
      }
      const state = remote
        ? validateState(remote.state)
        : emptyState('personal');
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
  save(state: PersonalState, photos = new Map<string, Blob>()): Promise<void> {
    const snapshot = structuredClone(state);
    const local = super.save(snapshot, photos);
    const operation = this.remoteQueue
      .catch(() => undefined)
      .then(async () => {
        await local;
        if (snapshot.mode !== 'personal') return;
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
    return operation;
  }
  private path(id: string): string {
    return `${this.userId}/${encodeURIComponent(id)}`;
  }
  async photo(
    mode: PersonalState['mode'],
    id: string,
  ): Promise<Blob | undefined> {
    const local = await super.photo(mode, id);
    if (local || mode === 'demo') return local;
    const { data, error } = await this.client.storage
      .from('originals')
      .download(this.path(id));
    if (error)
      throw new Error(
        'Das Originalfoto konnte nicht aus deinem Konto geladen werden.',
      );
    await super.putPhoto(mode, id, data);
    this.uploaded.add(id);
    return data;
  }
  private async push(state: PersonalState): Promise<void> {
    if (this.conflict) throw new Error('WORKSPACE_CONFLICT');
    for (const id of allPhotoIds(state)) {
      if (this.uploaded.has(id)) continue;
      const photo = await this.photo('personal', id);
      if (!photo)
        throw new Error(
          'Ein Originalfoto fehlt. Der Cloudstand wurde nicht ersetzt.',
        );
      const { error } = await this.client.storage
        .from('originals')
        .upload(this.path(id), photo, {
          upsert: false,
          contentType: photo.type,
        });
      if (error && String(error.statusCode) !== '409')
        throw new Error('Ein Originalfoto konnte nicht gesichert werden.');
      this.uploaded.add(id);
    }
    const { data, error } = await this.client.rpc('save_workspace', {
      p_state: state,
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
