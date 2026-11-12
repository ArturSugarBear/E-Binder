import { cloudClient } from './supabase';

/**
 * Optional beta-photo donations. Local OCR and inventory never depend on uploads.
 * All photos are re-encoded to strip EXIF/location data and sent to a private bucket.
 */
export const BETA_SCAN_CONSENT_VERSION = '2026-11-photo-v1';
const BUCKET = 'beta-scan-donations';
const MAX_UPLOAD_BYTES = 1500000;
const MAX_PER_SESSION = 36;
type DonationState = 'unavailable' | 'loading' | 'off' | 'on';

let accountId = '';
let state: DonationState = 'unavailable';
let submitted = 0;
let statusChanged: (() => void) | undefined;
let generation = 0;

export function betaScanDonationState(): DonationState {
  return state;
}

export async function loadBetaScanConsent(
  userId: string | undefined,
  onChange: () => void,
): Promise<void> {
  const current = ++generation;
  statusChanged = onChange;
  accountId = userId ?? '';
  state = userId && cloudClient ? 'loading' : 'unavailable';
  if (!userId || !cloudClient) return;
  const { data, error } = await cloudClient
    .from('beta_scan_consents')
    .select('enabled, consent_version')
    .eq('user_id', userId)
    .maybeSingle();
  if (current !== generation) return;
  state =
    !error &&
    data?.enabled === true &&
    data.consent_version === BETA_SCAN_CONSENT_VERSION
      ? 'on'
      : 'off';
  statusChanged?.();
}

export async function changeBetaScanConsent(enabled: boolean): Promise<void> {
  if (!accountId || !cloudClient)
    throw new Error('Bitte melde dich zuerst mit deinem Konto an.');
  const userId = accountId;
  const { error } = await cloudClient.from('beta_scan_consents').upsert(
    {
      user_id: userId,
      enabled,
      consent_version: BETA_SCAN_CONSENT_VERSION,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error('Die Beta-Einwilligung konnte nicht gespeichert werden.');
  if (accountId !== userId) return;
  state = enabled ? 'on' : 'off';
  if (!enabled) generation++;
  statusChanged?.();
}

async function compressedJpeg(photo: Blob, kind: 'card' | 'page'): Promise<Blob | null> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    const maxSide = kind === 'page' ? 1800 : 1200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    let output = await encode(0.74);
    if (output && output.size > MAX_UPLOAD_BYTES) output = await encode(0.56);
    if (!output || output.type !== 'image/jpeg' || output.size > MAX_UPLOAD_BYTES)
      return null;
    return output;
  } catch {
    // Unsupported HEIC decoders or insufficient memory must not affect scanning.
    return null;
  } finally {
    bitmap?.close();
  }
}

/** Fire and forget; intentionally does not block camera, OCR or collection saves. */
export async function donateBetaScanPhoto(
  photo: Blob,
  kind: 'card' | 'page',
): Promise<void> {
  if (state !== 'on' || !accountId || !cloudClient || submitted >= MAX_PER_SESSION)
    return;
  const userId = accountId;
  const current = generation;
  submitted++;
  const jpeg = await compressedJpeg(photo, kind);
  if (!jpeg || state !== 'on' || accountId !== userId || generation !== current)
    return;
  const id = crypto.randomUUID();
  const objectPath = userId + '/' + id + '.jpg';
  try {
    const { error: uploadError } = await cloudClient.storage
      .from(BUCKET)
      .upload(objectPath, jpeg, {
        contentType: 'image/jpeg',
        cacheControl: '0',
        upsert: false,
      });
    if (uploadError) return;
    if (state !== 'on' || accountId !== userId || generation !== current) {
      await cloudClient.storage.from(BUCKET).remove([objectPath]);
      return;
    }
    const { error: rowError } = await cloudClient.from('beta_scan_samples').insert({
      id,
      user_id: userId,
      object_path: objectPath,
      source_kind: kind,
      consent_version: BETA_SCAN_CONSENT_VERSION,
      byte_count: jpeg.size,
      review_status: 'pending',
    });
    if (rowError) await cloudClient.storage.from(BUCKET).remove([objectPath]);
  } catch {
    // Network donation is best effort, never a prerequisite for local recognition.
  }
}

/** Remove a user's unreviewed donations, including private Storage objects. */
export async function deletePendingBetaScanPhotos(): Promise<number> {
  if (!accountId || !cloudClient)
    throw new Error('Bitte melde dich zuerst an.');
  let deleted = 0;
  while (true) {
    const { data, error } = await cloudClient
      .from('beta_scan_samples')
      .select('id, object_path')
      .eq('user_id', accountId)
      .eq('review_status', 'pending')
      .limit(100);
    if (error) throw new Error('Deine Testaufnahmen konnten nicht abgerufen werden.');
    if (!data?.length) break;
    const paths = data.map((item) => item.object_path as string);
    const { error: storageError } = await cloudClient.storage
      .from(BUCKET)
      .remove(paths);
    if (storageError) throw new Error('Die Testaufnahmen konnten nicht gelöscht werden.');
    const { error: rowError } = await cloudClient
      .from('beta_scan_samples')
      .delete()
      .in('id', data.map((item) => item.id));
    if (rowError) throw new Error('Die Metadaten konnten nicht gelöscht werden.');
    deleted += data.length;
    if (data.length < 100) break;
  }
  return deleted;
}
