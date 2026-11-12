/** Private review export: consent checked twice; only authenticated encryption
 * leaves the runner. The RSA private key remains solely with the reviewer.
 * No sample identifiers, photos, paths or labels are printed to Actions logs.
 */
import { createClient } from '@supabase/supabase-js';
import {
  randomBytes,
  createCipheriv,
  createPublicKey,
  publicEncrypt,
  constants,
} from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const publicKey = createPublicKey(
  Buffer.from(process.env.REVIEW_PUBLIC_KEY_B64 ?? '', 'base64'),
);
if (
  publicKey.asymmetricKeyType !== 'rsa' ||
  publicKey.asymmetricKeyDetails.modulusLength < 3072
)
  throw new Error('Review key must be RSA 3072 bits or stronger');
if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.REVIEW_EXPORT_PATH
)
  throw new Error('Private dataset credentials or output path unavailable');
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const version = '2026-11-photo-v1';
async function consents() {
  const { data, error } = await client
    .from('beta_scan_consents')
    .select('user_id,enabled,consent_version,consented_at')
    .eq('enabled', true)
    .eq('consent_version', version);
  if (error) throw new Error('Consent lookup failed');
  return new Map(data.map((c) => [c.user_id, c]));
}
const consent = await consents();
const { data, error } = await client
  .from('beta_scan_samples')
  .select(
    'id,user_id,object_path,source_kind,byte_count,review_status,verified_card_id,consent_version',
  )
  .order('created_at')
  .limit(36);
if (error) throw new Error('Sample metadata lookup failed');
const selected = [];
for (const row of data) {
  if (!consent.has(row.user_id) || row.consent_version !== version) continue;
  if (
    row.object_path !== `${row.user_id}/${row.id}.jpg` ||
    row.byte_count > 1500000 ||
    row.byte_count < 1
  )
    throw new Error('Invalid owned sample metadata');
  const { data: blob, error: downloadError } = await client.storage
    .from('beta-scan-donations')
    .download(row.object_path);
  if (downloadError || blob.size !== row.byte_count)
    throw new Error('Storage object unavailable or byte count mismatch');
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
    throw new Error('Object is not JPEG');
  selected.push({
    id: row.id,
    userId: row.user_id,
    kind: row.source_kind,
    reviewStatus: row.review_status,
    verifiedCardId: row.verified_card_id,
    consentVersion: version,
    consentedAt: consent.get(row.user_id).consented_at,
    image: bytes.toString('base64'),
  });
}
const current = await consents();
const samples = selected
  .filter(
    (s) =>
      current.has(s.userId) &&
      current.get(s.userId).consented_at === s.consentedAt,
  )
  .map(({ userId: _, ...s }) => s);
if (!samples.length)
  throw new Error('No currently consented samples available');
const key = randomBytes(32),
  iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const payload = Buffer.from(
  JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    purpose: 'private-review-only-not-training',
    samples,
  }),
);
const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
await writeFile(
  process.env.REVIEW_EXPORT_PATH,
  JSON.stringify({
    version: 1,
    algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
    wrappedKey: publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      key,
    ).toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: encrypted.toString('base64'),
  }),
  { mode: 0o600 },
);
key.fill(0);
payload.fill(0);
console.log(
  `Encrypted ${samples.length} consented samples for private review; no labels were changed.`,
);
