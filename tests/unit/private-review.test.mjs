import { expect, it } from 'vitest';
import {
  generateKeyPairSync,
  randomBytes,
  createCipheriv,
  publicEncrypt,
  constants,
} from 'node:crypto';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
it('decrypts only authenticated review envelopes outside the repo and never turns pending predictions into labels', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'beta-review-test-'));
  try {
    const keys = generateKeyPairSync('rsa', { modulusLength: 3072 });
    const privatePath = join(dir, 'private.pem');
    await writeFile(
      privatePath,
      keys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      { mode: 0o600 },
    );
    const key = randomBytes(32),
      iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = {
      version: 1,
      purpose: 'private-review-only-not-training',
      samples: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          image: Buffer.from([255, 216, 255, 217]).toString('base64'),
          consentVersion: '2026-11-photo-v1',
          reviewStatus: 'pending',
          verifiedCardId: null,
        },
      ],
    };
    const bytes = Buffer.concat([
      cipher.update(JSON.stringify(body)),
      cipher.final(),
    ]);
    const envelope = {
      version: 1,
      algorithm: 'RSA-OAEP-SHA256+AES-256-GCM',
      wrappedKey: publicEncrypt(
        {
          key: keys.publicKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        key,
      ).toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: bytes.toString('base64'),
    };
    const path = join(dir, 'bundle.json');
    await writeFile(path, JSON.stringify(envelope));
    const output = execFileSync(
      process.execPath,
      [
        'scripts/review-beta-samples.mjs',
        'decrypt',
        path,
        privatePath,
        join(dir, 'review'),
      ],
      { encoding: 'utf8' },
    );
    expect(output).not.toContain(body.samples[0].id);
    const manifest = JSON.parse(
      await readFile(join(dir, 'review', 'review.json'), 'utf8'),
    );
    expect(manifest.samples[0].expectedKey).toBeUndefined();
    expect(manifest.samples[0].verification).toBeUndefined();
    expect((await stat(join(dir, 'review', 'sample-1.jpg'))).mode & 0o777).toBe(
      0o600,
    );
    bytes[0] ^= 1;
    envelope.ciphertext = bytes.toString('base64');
    await writeFile(path, JSON.stringify(envelope));
    expect(() =>
      execFileSync(
        process.execPath,
        [
          'scripts/review-beta-samples.mjs',
          'decrypt',
          path,
          privatePath,
          join(dir, 'tampered'),
        ],
        { stdio: 'pipe' },
      ),
    ).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 10000);
