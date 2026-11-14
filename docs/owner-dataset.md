# Private owner-photo dataset

`scripts/prepare-owner-dataset.mjs` inventories the repository owner's own card
photos, removes byte-identical duplicates, assigns a deterministic 80/20
train/test split and writes a private manifest. The owner has confirmed that he
owns every photo stored in his private Supabase project.

This tool prepares a manifest only. It does not label cards, train a model,
copy images, or talk to Supabase.

## Privacy rules

- Photos, manifests and labels stay outside Git. The script refuses an output
  path inside this repository or any other Git worktree, and refuses input
  photos inside a Git worktree.
- The script performs no network request and has no Supabase client. It never
  uploads, downloads or deletes an image.
- Images are read only to validate magic bytes and compute SHA-256. EXIF, GPS,
  device data and account identifiers are not parsed or stored.
- `manifest.json` and the generated `README.md` contain only POSIX paths
  relative to the exported photo folder. Absolute paths are never written.
- The output directory is created with owner-only permissions (`0700`); files
  use `0600` where the platform supports it.
- No image is copied into the output directory. Only `manifest.json` and
  `README.md` are written.
- A Supabase export needs a private service key kept outside the repository.
  That export is a manual, operator-controlled step and is **not** performed by
  this script. Never place a service-role key in `.env` files tracked by Git,
  command history shared with others, or a public bucket.

## Export the photos from Supabase

Use the Supabase Dashboard with the owner's account:

1. Open the private project and go to **Storage**.
2. Open the private photo bucket and select the folder to export.
3. Use **Download** and save the files outside every checkout, for example
   `~/Pictures/e-binder-owner-export` or
   `~/.e-binder-private/exports/2026-11-14`.
4. Do not download into `E-Binder`, another public checkout, or a folder that
   automatic Git syncs. Verify that the folder is outside Git before running
   the tool.

If the Supabase CLI or a custom downloader is used, keep the service key in an
external secret store or an ephemeral shell variable. Do not commit export
scripts containing credentials and do not publish signed URLs. This repository
does not provide or automate that credentialed download step.

## Prepare the manifest locally

```sh
node scripts/prepare-owner-dataset.mjs \
  "$HOME/Pictures/e-binder-owner-export" \
  --out "$HOME/.e-binder-private/card-dataset-2026-11-14" \
  --seed "owner-2026-11"
```

`--out` and `--seed` are optional. The default output is
`~/.e-binder-private/card-dataset-YYYY-MM-DD` (UTC date). The default seed is
`e-binder-owner-dataset-v1`.

```sh
# Same command with the defaults:
node scripts/prepare-owner-dataset.mjs "$HOME/Pictures/e-binder-owner-export"

# Replace manifest.json and README.md in an existing output directory.
# Unrelated files in that directory are preserved.
node scripts/prepare-owner-dataset.mjs "$HOME/Pictures/e-binder-owner-export" \
  --out "$HOME/.e-binder-private/card-dataset-2026-11-14" --force
```

Supported extensions are `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic` and
`.heif`. Magic bytes must match the declared extension:

| Format    | Signature                                                      |
| --------- | -------------------------------------------------------------- |
| JPEG      | `FF D8 FF`                                                     |
| PNG       | `89 50 4E 47 0D 0A 1A 0A`                                      |
| WebP      | `RIFF....WEBP`                                                 |
| HEIC/HEIF | ISO-BMFF `ftyp` with `heic`, `heix`, `hevc`, `mif1`, `msf1`, … |

Hidden files and directories, symlinks and unsupported extensions are ignored.
A file with an image extension but invalid magic bytes aborts the run; no
manifest is written. A run with no usable photos also exits non-zero.

## Output and manifest contract

After a successful run the private output contains:

```text
manifest.json
README.md
```

`manifest.json` uses this fixed shape:

```json
{
  "version": 1,
  "createdAt": "2026-11-14T12:00:00.000Z",
  "source": "owner-provided",
  "consent": "owner-confirmed",
  "seed": "owner-2026-11",
  "counts": { "photos": 3, "train": 2, "test": 1, "duplicates": 1 },
  "photos": [
    {
      "file": "card-1.jpg",
      "relativePath": "session-a/card-1.jpg",
      "sha256": "…64 lowercase hex characters…",
      "bytes": 123456,
      "format": "jpeg",
      "split": "train",
      "label": null,
      "review": "pending"
    }
  ]
}
```

`counts.photos` counts unique photos after deduplication; `counts.duplicates`
counts extra files with bytes identical to an already recorded photo.
`counts.train + counts.test === counts.photos`.

The split is derived from `SHA-256(seed + NUL + photoSha256)`. SHA-256 is
computed per file, duplicates are removed first, and the assignment is stable
across machines and runs for the same seed. A photo can never appear in both
splits because it is represented by exactly one hash entry. With very small
collections the 80/20 ratio can deviate from exactly 80/20; that is expected.

## Labeling later

Every photo intentionally starts with `label: null` and `review: "pending"`.
The preparation script never fills either field. Do not infer a label from a
filename, OCR output or a marketplace listing.

Keep labels in a separate private file, for example
`~/.e-binder-private/card-dataset-2026-11-14/labels.json`, keyed by the
photo's SHA-256 so labels survive a manifest rebuild:

```json
{
  "version": 1,
  "labels": {
    "<sha256>": {
      "tcgdexId": "de:base1-4",
      "language": "de",
      "observedName": "Glurak",
      "observedNumber": "4/102",
      "setId": "base1",
      "review": "verified",
      "reviewer": "owner",
      "evidence": "Readable name, collector number and set symbol on the photo"
    }
  }
}
```

A label is an exact printing: TCGdex ID plus language, checked against cached
catalogue metadata and the readable card details. A successful metadata lookup
does not prove that the photo shows that printing. Unreviewed entries stay
unlabelled. Variant-level claims (first edition, holo finish, print run) require
separate evidence and are not part of this contract.

If manifest fields must eventually be filled, do it in a controlled merge that
preserves `sha256` and `split`; never move a labelled photo between train and
test. Re-running the preparation script with `--force` rewrites
`manifest.json`, so a separate labels file is the safer default.

## Benchmark seed

This manifest is the seed for private scanner and recognition benchmarks, not
a training corpus for the public application. A benchmark run should:

1. Pin the manifest by its SHA-256 and record the seed and creation date.
2. Use exactly the recorded train/test boundary.
3. Report aggregate metrics per split and per language; never publish photo
   paths, image bytes, reviewer names or account IDs.
4. Never tune or train on the test split. Keep the test split untouched once
   it has been used for a reported comparison.

Byte-identical duplicates are removed, but different photos of the same
physical card, burst frames or crops are not grouped. For a strict benchmark,
add session/physical-card groups to the private labels file and keep every
group in one split. Near-duplicate leakage remains a documented limitation of
this first version.

## Verification

```sh
npx vitest run tests/unit/owner-dataset.test.*
npx prettier --check scripts/prepare-owner-dataset.mjs \
  tests/unit/owner-dataset.test.mjs docs/owner-dataset.md
npm run lint
```

## Limitations

- Validation checks container magic bytes, not decodability. A truncated JPEG
  or a HEIC file with a valid `ftyp` brand can pass even if no decoder can read
  it. Run a separate decode check before using photos for measurement.
- HEIC/HEIF is recognised but not decoded or converted.
- The split is not stratified by physical card, session, language or set.
  Identical bytes cannot straddle the boundary; distinct shots of the same
  card can.
- The script cannot verify ownership or copyright. It records the owner's
  confirmation as `consent: "owner-confirmed"` and does not adjudicate rights.
- No EXIF, OCR, labels, model training, Supabase access or upload is performed.
- Re-running into an existing directory requires `--force`; only
  `manifest.json` and `README.md` are replaced.
