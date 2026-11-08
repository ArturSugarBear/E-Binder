import { z } from 'zod';
import {
  emptyState,
  validateState,
  type PersonalState,
} from '../domain/personal';

const DATABASE = 'e-binder-personal';
const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('states');
      request.result.createObjectStore('photos');
    };
    request.onsuccess = () => resolve(request.result);
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
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Speichern fehlgeschlagen.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Speichern wurde abgebrochen.'));
  });
export class PersonalStore {
  private database = openDatabase();
  private queue: Promise<void> = Promise.resolve();
  private revisions = new Map<string, number>();

  async load(mode: PersonalState['mode']): Promise<PersonalState> {
    const db = await this.database;
    const raw = await resultOf(
      db.transaction('states').objectStore('states').get(mode),
    );
    const state = raw === undefined ? emptyState(mode) : validateState(raw);
    if (state.mode !== mode)
      throw new Error('Der gespeicherte Bestand hat einen anderen Modus.');
    this.revisions.set(mode, state.revision);
    return state;
  }
  save(
    state: PersonalState,
    photos: Map<string, Blob> = new Map(),
  ): Promise<void> {
    const snapshot = structuredClone(state);
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = await this.database;
        const transaction = db.transaction(['states', 'photos'], 'readwrite');
        const done = completed(transaction);
        const states = transaction.objectStore('states');
        const current = await resultOf(states.get(snapshot.mode));
        if (
          (current?.revision ?? 0) !== (this.revisions.get(snapshot.mode) ?? 0)
        ) {
          transaction.abort();
          await done.catch(() => undefined);
          throw new Error(
            'Der Bestand wurde in einem anderen Tab geändert. Sichere deine Änderungen als Export und lade die Seite neu.',
          );
        }
        for (const [id, photo] of photos)
          transaction
            .objectStore('photos')
            .put(photo, `${snapshot.mode}:${id}`);
        states.put(snapshot, snapshot.mode);
        await done;
        this.revisions.set(snapshot.mode, snapshot.revision);
      });
    this.queue = operation;
    return operation;
  }
  async putPhoto(
    mode: PersonalState['mode'],
    id: string,
    blob: Blob,
  ): Promise<void> {
    const db = await this.database;
    const transaction = db.transaction('photos', 'readwrite');
    const done = completed(transaction);
    transaction.objectStore('photos').put(blob, `${mode}:${id}`);
    await done;
  }
  async photo(
    mode: PersonalState['mode'],
    id: string,
  ): Promise<Blob | undefined> {
    const db = await this.database;
    return resultOf(
      db.transaction('photos').objectStore('photos').get(`${mode}:${id}`),
    ) as Promise<Blob | undefined>;
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
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
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

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () =>
      reject(new Error('Ein Foto konnte nicht gesichert werden.'));
    reader.readAsDataURL(blob);
  });
}
export async function exportBackup(
  state: PersonalState,
  store: PersonalStore,
): Promise<Blob> {
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
  const ids = allPhotoIds(state);
  for (const id of ids) {
    const photo = await store.photo(state.mode, id);
    if (!photo)
      throw new Error(
        'Ein Originalfoto fehlt im lokalen Speicher. Die Sicherung wurde nicht als vollständig ausgegeben.',
      );
    lines.push(
      JSON.stringify({
        record: 'photo',
        id,
        mime: photo.type,
        data: await base64(photo),
      }),
    );
  }
  const backup = new Blob([lines.join('\n') + '\n'], {
    type: 'application/x-ndjson',
  });
  if (backup.size > 256000000)
    throw new Error(
      'Die vollständige Sicherung ist größer als 256 MB. Deine Daten bleiben unverändert auf diesem Gerät.',
    );
  return backup;
}
export function allPhotoIds(state: PersonalState): Set<string> {
  return new Set([
    ...state.captures.map((capture) => capture.photoId),
    ...state.captures.flatMap((capture) =>
      capture.candidates.flatMap((card) =>
        card.photoId ? [card.photoId] : [],
      ),
    ),
    ...state.holdings.flatMap((holding) =>
      holding.card.photoId ? [holding.card.photoId] : [],
    ),
    ...state.wishes.flatMap((wish) =>
      wish.card.photoId ? [wish.card.photoId] : [],
    ),
    ...state.binders.flatMap((binder) =>
      binder.pages.flatMap((page) =>
        page.slots.flatMap((slot) =>
          slot?.kind === 'planned' && slot.card.photoId
            ? [slot.card.photoId]
            : [],
        ),
      ),
    ),
  ]);
}
export interface Backup {
  state: PersonalState;
  photos: Map<string, Blob>;
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
  const photos = new Map<string, Blob>();
  for (const line of lines.slice(1)) {
    const value: unknown = JSON.parse(line);
    const record = z.object({ record: z.string() }).parse(value).record;
    if (record === 'photo') {
      const photo = photoLine.parse(value);
      if (photos.has(photo.id))
        throw new Error('Ein Foto ist mehrfach in der Sicherung vorhanden.');
      const binary = atob(photo.data);
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      );
      photos.set(photo.id, new Blob([bytes], { type: photo.mime }));
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
  const state = validateState(raw);
  for (const id of allPhotoIds(state))
    if (!photos.has(id))
      throw new Error(
        'In dieser Sicherung fehlt ein referenziertes Originalfoto.',
      );
  return { state, photos };
}
