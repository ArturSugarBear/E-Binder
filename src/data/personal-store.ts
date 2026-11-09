import { z } from 'zod';
import {
  emptyState,
  validateState,
  metadataOnlyState,
  type PersonalState,
} from '../domain/personal';

const DATABASE = 'e-binder-personal';
const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('states'))
        db.createObjectStore('states');
      if (db.objectStoreNames.contains('photos'))
        db.deleteObjectStore('photos');
      const cursor = request.transaction!.objectStore('states').openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        try {
          item.update(metadataOnlyState(item.value as PersonalState));
        } catch {
          /* Invalid metadata stays available for recovery; photo storage is still deleted. */
        }
        item.continue();
      };
    };
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          'Schließe andere E-Binder-Tabs und lade neu, damit der alte Fotospeicher entfernt werden kann.',
        ),
      );
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) {
        db.close();
        return;
      }
      resolve(db);
    };
    request.onerror = () =>
      reject(new Error('Der lokale Speicher konnte nicht geöffnet werden.'));
  });
const resultOf = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Lokaler Speicher nicht erreichbar.'));
  });
const completed = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    let failure: DOMException | null = null;
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      failure = (event.target as IDBRequest | null)?.error ?? transaction.error;
    };
    transaction.onabort = () =>
      reject(
        failure ??
          transaction.error ??
          new Error('Speichern wurde abgebrochen.'),
      );
  });
export class PersonalStore {
  constructor(private scope = '') {}
  private key(mode: PersonalState['mode']): string {
    return this.scope && mode !== 'demo' ? `${this.scope}:${mode}` : mode;
  }
  private database = openDatabase();
  private queue: Promise<void> = Promise.resolve();
  private revisions = new Map<string, number>();

  async load(mode: PersonalState['mode']): Promise<PersonalState> {
    const db = await this.database;
    const raw = await resultOf(
      db.transaction('states').objectStore('states').get(this.key(mode)),
    );
    const state =
      raw === undefined
        ? emptyState(mode)
        : metadataOnlyState(validateState(raw));
    if (state.mode !== mode)
      throw new Error('Der gespeicherte Bestand hat einen anderen Modus.');
    this.revisions.set(mode, state.revision);
    return state;
  }
  save(state: PersonalState): Promise<void> {
    const snapshot = metadataOnlyState(state);
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = await this.database;
        const transaction = db.transaction('states', 'readwrite');
        const done = completed(transaction);
        const states = transaction.objectStore('states');
        const current = await resultOf(states.get(this.key(snapshot.mode)));
        if (
          (current?.revision ?? 0) !== (this.revisions.get(snapshot.mode) ?? 0)
        ) {
          transaction.abort();
          await done.catch(() => undefined);
          throw new Error(
            'Der Bestand wurde in einem anderen Tab geändert. Sichere deine Änderungen als Export und lade die Seite neu.',
          );
        }
        states.put(snapshot, this.key(snapshot.mode));
        await done;
        this.revisions.set(snapshot.mode, snapshot.revision);
      });
    this.queue = operation;
    return operation;
  }
}

const photoLine = z
  .object({
    record: z.literal('photo'),
    id: z.string().min(1).max(250),
    mime: z.enum([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]),
    data: z
      .string()
      .max(32000000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine((value) => value.length % 4 === 0, 'Ungültige Base64-Länge'),
  })
  .strict();
const headerLine = z
  .object({
    record: z.literal('manifest'),
    format: z.literal('e-binder'),
    version: z.literal(1),
    mode: z.enum(['personal', 'demo']),
    exportedAt: z.string(),
    revision: z.number().int().nonnegative(),
  })
  .strict();

export async function exportBackup(input: PersonalState): Promise<Blob> {
  const state = metadataOnlyState(input);
  const lines: string[] = [
    JSON.stringify({
      record: 'manifest',
      format: 'e-binder',
      version: 1,
      mode: state.mode,
      exportedAt: new Date().toISOString(),
      revision: state.revision,
    }),
  ];
  for (const [record, items] of [
    ['holding', state.holdings],
    ['binder', state.binders],
    ['wish', state.wishes],
    ['capture', state.captures],
  ] as const)
    for (const data of items) lines.push(JSON.stringify({ record, data }));
  lines.push(
    JSON.stringify({
      record: 'context',
      lastBinderId: state.lastBinderId,
      lastPageId: state.lastPageId,
    }),
  );
  const backup = new Blob([lines.join('\n') + '\n'], {
    type: 'application/x-ndjson',
  });
  if (backup.size > 256000000)
    throw new Error(
      'Die vollständige Sicherung ist größer als 256 MB. Deine Daten bleiben unverändert auf diesem Gerät.',
    );
  return backup;
}
export interface Backup {
  state: PersonalState;
}
export function parseBackup(content: string): Backup {
  if (content.length > 256000000)
    throw new Error('Die Sicherung ist zu groß (maximal 256 MB).');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length > 60000 || !lines.length)
    throw new Error('Keine gültige E-Binder-Sicherung.');
  const header = headerLine.parse(JSON.parse(lines[0]!));
  const raw = emptyState(header.mode);
  raw.revision = header.revision;
  const legacyPhotoIds = new Set<string>();
  for (const line of lines.slice(1)) {
    const value: unknown = JSON.parse(line);
    const record = z.object({ record: z.string() }).parse(value).record;
    if (record === 'photo') {
      const photo = photoLine.parse(value);
      if (legacyPhotoIds.has(photo.id))
        throw new Error(
          'Ein Foto ist mehrfach in der alten Sicherung vorhanden.',
        );
      legacyPhotoIds.add(photo.id);
      // Legacy bytes are validated above, then discarded without decoding or storage.
    } else if (record === 'context') {
      const context = z
        .object({
          record: z.literal('context'),
          lastBinderId: z.string().optional(),
          lastPageId: z.string().optional(),
        })
        .strict()
        .parse(value);
      raw.lastBinderId = context.lastBinderId;
      raw.lastPageId = context.lastPageId;
    } else {
      const envelope = z
        .object({
          record: z.enum(['holding', 'binder', 'wish', 'capture']),
          data: z.unknown(),
        })
        .strict()
        .parse(value);
      const key = {
        holding: 'holdings',
        binder: 'binders',
        wish: 'wishes',
        capture: 'captures',
      } as const;
      (raw[key[envelope.record]] as unknown[]).push(envelope.data);
    }
  }
  return { state: metadataOnlyState(validateState(raw)) };
}
