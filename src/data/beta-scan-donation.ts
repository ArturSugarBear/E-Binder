import { cloudClient, guestBetaClient } from './supabase';

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
let guestIdentity = false;
let ownerClient: typeof cloudClient;
let state: DonationState = 'unavailable';
let submitted = 0;
let statusChanged: (() => void) | undefined;
let generation = 0;

export function betaScanDonationState(): DonationState {
  return state;
}

/**
 * Resolve existing consent without ever signing in anonymously on page load.
 * Guest collection data still uses the local PersonalStore. Anonymous Auth
 * is created only in response to the explicit consent button.
 */
export async function loadBetaScanConsent(
  userId: string | undefined,
  onChange: () => void,
): Promise<void> {
  const current = ++generation;
  statusChanged = onChange;
  ownerClient = userId ? cloudClient : guestBetaClient;
  guestIdentity = !userId;
  accountId = userId ?? '';
  if (!ownerClient) {
    state = 'unavailable';
    statusChanged?.();
    return;
  }
  state = 'loading';
  statusChanged?.();

  let ownerId = userId;
  if (!ownerId) {
    // Reuse a previously explicitly consented guest identity, if present.
    const { data, error } = await ownerClient.auth.getSession();
    if (current !== generation) return;
    if (!error && data.session?.user.is_anonymous)
      ownerId = data.session.user.id;
    else {
      state = 'off';
      statusChanged?.();
      return;
    }
  }
  const { data, error } = await ownerClient
    .from('beta_scan_consents')
    .select('enabled, consent_version')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (current !== generation) return;
  accountId = ownerId;
  state =
    !error &&
    data?.enabled === true &&
    data.consent_version === BETA_SCAN_CONSENT_VERSION
      ? 'on'
      : 'off';
  statusChanged?.();
}

export async function changeBetaScanConsent(enabled: boolean): Promise<void> {
  let selected = ownerClient;
  if (!selected) throw new Error('Beta-Foto-Speicherung ist nicht verfügbar.');
  if (state === 'loading')
    throw new Error('Bitte die bestehende Beta-Einstellung zuerst laden.');

  if (!accountId && enabled && guestIdentity) {
    // No password, email or CloudStore: only a private, disposable identity
    // scoped to a separate auth storage key for the beta-photo bucket.
    const { data, error } = await selected.auth.signInAnonymously();
    if (error || !data.user?.is_anonymous) {
      throw new Error(
        'Gast-Fotobeiträge sind momentan nicht verfügbar. Die Anmeldung für anonyme Testidentitäten muss im Supabase-Projekt aktiviert sein. Dein Scan funktioniert weiterhin lokal.',
      );
    }
    accountId = data.user.id;
  }
  if (!accountId) {
    if (!enabled) {
      state = 'off';
      statusChanged?.();
      return;
    }
    throw new Error('Keine gültige Beta-Identität.');
  }
  const userId = accountId;
  const { error } = await selected.from('beta_scan_consents').upsert(
    {
      user_id: userId,
      enabled,
      consent_version: BETA_SCAN_CONSENT_VERSION,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    throw new Error(
      'Die Beta-Einwilligung konnte nicht gespeichert werden. Es werden keine Fotos hochgeladen.',
    );
  }
  if (accountId !== userId) return;
  state = enabled ? 'on' : 'off';
  if (!enabled) generation++;
  statusChanged?.();
}

async function compressedJpeg(
  photo: Blob,
  kind: 'card' | 'page',
): Promise<Blob | null> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    const maxSide = kind === 'page' ? 1800 : 1200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext('2d')
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality: number) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
    let output = await encode(0.74);
    if (output && output.size > MAX_UPLOAD_BYTES) output = await encode(0.56);
    if (
      !output ||
      output.type !== 'image/jpeg' ||
      output.size > MAX_UPLOAD_BYTES
    )
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
  captureKey?: string,
): Promise<void> {
  if (
    state !== 'on' ||
    !accountId ||
    !ownerClient ||
    submitted >= MAX_PER_SESSION
  )
    return;
  const userId = accountId;
  const client = ownerClient;
  if (!client) return;
  const current = generation;
  submitted++;
  const jpeg = await compressedJpeg(photo, kind);
  if (!jpeg || state !== 'on' || accountId !== userId || generation !== current)
    return;
  const id = crypto.randomUUID();
  const objectPath = userId + '/' + id + '.jpg';
  try {
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(objectPath, jpeg, {
        contentType: 'image/jpeg',
        cacheControl: '0',
        upsert: false,
      });
    if (uploadError) return;
    if (state !== 'on' || accountId !== userId || generation !== current) {
      await client.storage.from(BUCKET).remove([objectPath]);
      return;
    }
    const { error: rowError } = await client
      .from('beta_scan_samples')
      .insert({
        id,
        user_id: userId,
        object_path: objectPath,
        source_kind: kind,
        consent_version: BETA_SCAN_CONSENT_VERSION,
        byte_count: jpeg.size,
        capture_key:
          captureKey &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(captureKey)
            ? captureKey
            : null,
        review_status: 'pending',
      });
    if (rowError) await client.storage.from(BUCKET).remove([objectPath]);
  } catch {
    // Network donation is best effort, never a prerequisite for local recognition.
  }
}

/**
 * Capture the user's deliberate printing choice as PROVISIONAL evidence.
 * It is never a verified training label. No OCR text or photo leaves here.
 * The separately donated JPEG is joined by owner+capture UUID during private
 * independent review, even when upload and feedback arrive out of order.
 */
export async function recordBetaScanConfirmation(
  captureKey: string,
  selectedPrinting: string,
): Promise<void> {
  const client = ownerClient;
  const userId = accountId;
  const checkpoint = generation;
  if (
    !client ||
    state !== 'on' ||
    !userId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(captureKey) ||
    !/^tcgdex:(de|en|ja):[A-Za-z0-9_.+-]{3,160}$/.test(selectedPrinting)
  )
    return;
  if (state !== 'on' || accountId !== userId || checkpoint !== generation)
    return;
  try {
    await client.from('beta_scan_feedback').insert({
      user_id: userId,
      capture_key: captureKey,
      selected_printing: selectedPrinting,
    });
  } catch {
    // Optional feedback must never block collection or change a stored label.
  }
}

/** Delete all of this account's donations, including private Storage objects. */
export async function deleteBetaScanPhotos(): Promise<number> {
  if (!accountId || !ownerClient)
    throw new Error('Keine aktive Foto-Beta-Identität auf diesem Gerät.');
  // Stop new uploads and invalidate in-flight donations before deletion.
  if (state === 'on') await changeBetaScanConsent(false);
  let deleted = 0;
  while (true) {
    const { data, error } = await ownerClient
      .from('beta_scan_samples')
      .select('id, object_path')
      .eq('user_id', accountId)
      .limit(100);
    if (error)
      throw new Error('Deine Testaufnahmen konnten nicht abgerufen werden.');
    if (!data?.length) break;
    const paths = data.map((item) => item.object_path as string);
    const { error: storageError } = await ownerClient.storage
      .from(BUCKET)
      .remove(paths);
    if (storageError)
      throw new Error('Die Testaufnahmen konnten nicht gelöscht werden.');
    const { error: rowError } = await ownerClient
      .from('beta_scan_samples')
      .delete()
      .in(
        'id',
        data.map((item) => item.id),
      );
    if (rowError)
      throw new Error('Die Metadaten konnten nicht gelöscht werden.');
    deleted += data.length;
    if (data.length < 100) break;
  }
  // Also remove provisional user corrections, even if the photo upload
  // never completed; all such signals are part of this donation consent.
  const { error: feedbackError } = await ownerClient
    .from('beta_scan_feedback')
    .delete()
    .eq('user_id', accountId);
  if (feedbackError)
    throw new Error('Die Scan-Korrekturen konnten nicht gelöscht werden.');
  return deleted;
}
