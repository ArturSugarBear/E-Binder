/** Private operator tool. No credentials, photos or sample IDs are printed.
 * decrypt <envelope.json> <private-key.pem> <private-output-directory>
 * apply <independent-decisions.json> (server credentials from environment)
 */
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import {
  privateDecrypt,
  createDecipheriv,
  createHash,
  constants,
} from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const [command, ...args] = process.argv.slice(2);

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function privatePath(value) {
  const path = resolve(value);
  let ancestor = path;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  ancestor = realpathSync(ancestor);
  while (true) {
    if (existsSync(join(ancestor, '.git')))
      throw new Error('Private data must be outside every repository/worktree');
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  return path;
}
const printedNumber = (value) =>
  value
    .toLowerCase()
    .replace(/\s/g, '')
    .split('/')
    .map((p) => p.replace(/^([a-z]*)0+(?=\d)/, '$1'))
    .join('/');
if (command === 'decrypt') {
  const [envelopePath, keyPath, output] = args;
  const envelope = JSON.parse(await readFile(envelopePath, 'utf8'));
  if (
    envelope.version !== 1 ||
    envelope.algorithm !== 'RSA-OAEP-SHA256+AES-256-GCM'
  )
    throw new Error('Unsupported encrypted review envelope');
  const key = privateDecrypt(
    {
      key: await readFile(keyPath),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(envelope.wrappedKey, 'base64'),
  );
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const bytes = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  const bundle = JSON.parse(bytes.toString('utf8'));
  key.fill(0);
  bytes.fill(0);
  if (
    bundle.purpose !== 'private-review-only-not-training' ||
    !Array.isArray(bundle.samples) ||
    bundle.samples.length > 36
  )
    throw new Error('Invalid review bundle');
  const directory = privatePath(output);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const manifest = [];
  for (const [index, sample] of bundle.samples.entries()) {
    if (
      !/^[0-9a-f-]{36}$/.test(sample.id) ||
      sample.consentVersion !== '2026-11-photo-v1'
    )
      throw new Error('Invalid consented sample identity');
    const image = Buffer.from(sample.image, 'base64');
    if (image.length > 1500000 || image[0] !== 255 || image[1] !== 216)
      throw new Error('Invalid JPEG');
    const photo = `sample-${index + 1}.jpg`;
    await writeFile(resolve(directory, photo), image, { mode: 0o600 });
    manifest.push({
      id: sample.id,
      photo,
      sha256: digest(image),
      consentVersion: sample.consentVersion,
      reviewStatus: sample.reviewStatus,
      expectedKey: sample.verifiedCardId ?? undefined,
      verification: undefined,
    });
  }
  await writeFile(
    resolve(directory, 'review.json'),
    JSON.stringify(
      {
        exportedAt: bundle.exportedAt,
        purpose: 'independent-review-required-not-training',
        samples: manifest,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Decrypted ${manifest.length} samples for private inspection. Pending labels remain unset; image decoding and independent review are required.`,
  );
} else if (command === 'apply') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Private server credentials required');
  const decisions = JSON.parse(await readFile(privatePath(args[0]), 'utf8'));
  if (!Array.isArray(decisions) || decisions.length > 36)
    throw new Error('Invalid decisions');
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let applied = 0;
  for (const d of decisions) {
    if (
      !d.independent ||
      !['human-visual-catalog', 'assisted-visual-catalog'].includes(d.method) ||
      !d.readable ||
      typeof d.evidence !== 'string' ||
      d.evidence.trim().length < 20 ||
      typeof d.reviewer !== 'string' ||
      d.reviewer.trim().length < 3 ||
      !['de', 'en', 'ja'].includes(d.language) ||
      !['normal', 'holo', 'reverse', 'other'].includes(d.finish) ||
      !/^tcgdex:(de|en|ja):[A-Za-z0-9.+-]+$/.test(d.key) ||
      d.key.split(':')[1] !== d.language ||
      !/^[0-9a-f]{64}$/.test(d.sha256)
    )
      throw new Error(
        'Independent visual evidence and complete canonical identity are required; predictions are not labels',
      );
    const { data: row, error } = await client
      .from('beta_scan_samples')
      .select('user_id,object_path,review_status,consent_version')
      .eq('id', d.id)
      .single();
    if (error || row.review_status !== 'pending')
      throw new Error('Sample is unavailable or already reviewed');
    async function hasConsent() {
      const { data: c, error: e } = await client
        .from('beta_scan_consents')
        .select('enabled,consent_version')
        .eq('user_id', row.user_id)
        .single();
      return !e && c.enabled && c.consent_version === row.consent_version;
    }
    if (!(await hasConsent())) throw new Error('Consent withdrawn or changed');
    const { data: blob, error: downloadError } = await client.storage
      .from('beta-scan-donations')
      .download(row.object_path);
    if (
      downloadError ||
      digest(Buffer.from(await blob.arrayBuffer())) !== d.sha256
    )
      throw new Error('Reviewed image does not match Storage object');
    const response = await fetch(
      `https://api.tcgdex.net/v2/${d.language}/cards/${encodeURIComponent(d.key.split(':')[2])}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error('Canonical label cannot be verified');
    const card = await response.json();
    if (
      card.id !== d.key.split(':')[2] ||
      card.set.id !== d.setId ||
      !/^[a-z]{0,3}\d{1,3}\/[a-z]{0,3}\d{1,3}$/i.test(d.number) ||
      printedNumber(`${card.localId}/${card.set.cardCount.official}`) !==
        printedNumber(d.number)
    )
      throw new Error('Catalogue printing does not match visual review');
    if (!(await hasConsent()))
      throw new Error('Consent withdrawn before review commit');
    const patch = {
      review_status: 'accepted',
      verified_card_id: d.key,
      verified_language: d.language,
      verified_finish: d.finish,
      reviewed_by: d.reviewer,
      review_method: d.method,
      image_sha256: d.sha256,
      review_evidence: d.evidence,
      human_verified: d.method === 'human-visual-catalog',
      reviewed_at: new Date().toISOString(),
    };
    const { data: updated, error: updateError } = await client
      .from('beta_scan_samples')
      .update(patch)
      .eq('id', d.id)
      .eq('review_status', 'pending')
      .select('id');
    if (updateError || updated.length !== 1)
      throw new Error('Review commit failed or raced another reviewer');
    await appendFile(
      privatePath(args[0]) + '.audit.jsonl',
      JSON.stringify({ id: d.id, ...patch }) + '\n',
      { mode: 0o600 },
    );
    applied++;
  }
  console.log(
    `Applied ${applied} independently reviewed labels. Assisted labels remain excluded from training.`,
  );
} else
  throw new Error(
    'Usage: review-beta-samples.mjs decrypt <envelope> <private-key> <private-directory> | apply <private-decisions>',
  );
