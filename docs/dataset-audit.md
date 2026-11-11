# P08-DATASET-01 — real Pokémon photo ground truth

Audit date: **2026-11-11 UTC**. Independent of P07 and P08 recognition work. No model training, inference, deployment, image export or bulk download was performed. Only this report, the offline validator and its unit tests belong in Git.

## Evidence and findings

The public project/version pages below were read through web retrieval. Direct HTTP access to the three project pages returned 403; the browser probe of the binder image browser returned 400. Indexed image browsers returned empty content/translation notices; the public project API probes returned 401. Retrieved page text may be cached, and published counts can change. Firecrawl was attempted but unavailable because its credits were exhausted. Consequently **no dataset image or annotation export was inspected or acquired**. Generic “try this model” examples are not evidence about a dataset's own photographs.

“Published” below describes the source page, **not an independently verified image inventory**. An object-detection class establishes advertised annotation intent, not complete or correct boxes on every image. Version counts may include augmented derivatives; do not sum projects, versions or splits as independent originals.

| Source                                                                                                                   | Published inventory / annotations                                                                                                                                                                                                                                                                                                           | Real camera photos                                                                                | Exact printing ground truth                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [cardbinder/pokemon-card-binder](https://universe.roboflow.com/cardbinder/pokemon-card-binder)                           | 36 images; one `card` detection class. [Version 1](https://universe.roboflow.com/cardbinder/pokemon-card-binder/dataset/1): 24 train / 8 validation / 4 test, auto-orient, no augmentation. No name/number/set classes advertised.                                                                                                          | Not established by the accessible evidence; project title alone is insufficient.                  | No per-image TCGdex identity mapping or visual review evidence available to this audit.                                                         |
| [invention-time/pokemon-card-detection-haiqn](https://universe.roboflow.com/invention-time/pokemon-card-detection-haiqn) | 981 project images, 131 classes. Advertises card, name, card-number and set detection; includes `Name`, `card`, `card_number` and set-named classes. Model page references version 3 with 2,421 images; not a count of verified original photos.                                                                                            | Not established; digital scans, camera photos and derivatives cannot be separated from page text. | Region classes and set names do not establish exact print identities. No verified per-image mapping inspected.                                  |
| [janoschbl/pokemon-cards-63wlp-tiyep](https://universe.roboflow.com/janoschbl/pokemon-cards-63wlp-tiyep)                 | 891 project images, 128 classes, including `card` and set names. Name/number regions not established from the visible class list. [Version 1](https://universe.roboflow.com/janoschbl/pokemon-cards-63wlp-tiyep/dataset/1): 2,207 outputs, 1,974 train / 151 validation / 82 test; three outputs per training example with transformations. | Not established; augmented outputs must not be represented as independently photographed cards.   | No verified exact identity mapping inspected. Similar taxonomies are a reason to check overlap with Invention Time, not proof of shared images. |

All three project pages display **CC BY 4.0**. This is a publisher-declared license, not proof of each photographer's provenance or authority over underlying Pokémon artwork. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) requires attribution, a license link and disclosure of modifications, and does not warrant all necessary rights. [Roboflow terms](https://roboflow.com/terms) also govern platform access; a public listing is not permission for unrestricted automated collection. Retain the applicable version, attribution and terms evidence privately. Verify the intended private evaluation use and any restrictions before acquisition. Do not infer redistribution rights from the badge.

### What is usable now?

- **Usable, verified real photos delivered by this audit: 0.** None was acquired, reviewed or admitted. This does not assert that the remote datasets contain zero usable photos.
- **Unverified photos:** remote real-photo count unknown. All remote candidates remain unverified for E-Binder; published counts above are not verified-photo counts.
- **Language coverage:** unknown for all three datasets. English class names do not establish the language printed on cards. No language frequencies or recognition accuracy are claimed.
- **Missing exact identities:** no photo-to-TCGdex mapping was verified. Number/proportion of missing labels is unknown without an authorized image-level audit.
- **Rights:** unresolved at per-image level for this workflow. No third-party images, thumbnails, annotation exports, manifests with private paths, or access tokens were committed.

The next admissible step is a bounded, authorized, private image-level review. Record which images actually are photographs, inspect card/region boxes, establish exact identities and language from legible details, and audit lineage across projects and augmented versions. Do not train from the page counts or treat detection mAP as exact-print accuracy.

## Local preparation contract

Keep the photo directory, manifest, catalogue snapshot, attribution/permission records and validation reports **outside every public checkout**. The CLI rejects its manifest/snapshot inside this repository and rejects images inside it, including escaping symlinks. It never downloads, uploads or copies images. Keep private files outside other public checkouts as well; the validator only knows its own repository boundary.

1. Establish a documented lawful basis/permission for the intended private evaluation. Preserve source URL, dataset/version, original asset ID, acquisition date, attribution, license and restrictions. Unknown/restricted rights stay in `quarantine`; the script cannot adjudicate copyright or authenticate a permission document.
2. Inventory originals before assigning splits. Give all views/crops/augmentations of the same original, burst/session or physical card a stable `groupId`, carried across forks and dataset versions. Deduplicate by actual SHA-256 and source asset before splitting. Never split augmented files independently.
3. Inspect each photo. `media` is `camera-photo`, `digital-artwork` or `unknown`; it is a human assertion, not an automated detector. `verification.status` is `verified`, `unverified` or `rejected`. Verification requires reviewer, ISO timestamp and evidence referring to the actual image's readable name, collector number, set identifier/symbol and language. A filename, listing title, OCR output or generic Pokémon name is never enough.
4. Fetch **only candidate metadata**, not artwork, from the exact language-specific [TCGdex card endpoint](https://tcgdex.dev/rest/card). Preserve raw responses in a local snapshot; do not use the application's editorial/artwork fallback IDs as TCGdex IDs. A successful metadata lookup validates catalogue membership, not the photo match. For example, the audit's metadata-only probe of [en/base1-4](https://api.tcgdex.net/v2/en/cards/base1-4) returned `Charizard`, local ID `4`, set `base1`; no photo was thereby labelled.
5. Assign `train`, `validation` or `test` only to reviewed camera photos with reviewed rights. Use `quarantine` for all other records. Empty camera scenes can be verified negatives; unknown scenes must remain explicit unknowns. Set `identity: null` for unidentified card boxes. A partially identified sample remains unverified/quarantined until every card is reviewed.

The identity contract is **TCGdex ID + language**, with observed name, exact local ID (including zeros) and set ID matching cached metadata. It does not certify first-edition stamps, holo finishes, print runs, authenticity or ownership. TCGdex can group variants under one ID; variant-level claims require a separate future annotation contract. Region boxes do not transcribe text or establish identity by themselves.

### Manifest v1

Strict JSON keys; no silently ignored label fields. `imagePath` is relative to the supplied private image root. `sha256` is the hash of the actual image file. Card and region `box` values are normalized **image-relative** `[x, y, width, height]` with positive size, contained in `[0,1]`. Region kinds are `name`, `number`, `set`; missing regions remain absent, not fabricated.

This example is an **unverified inventory template**, not a verified photo. Replace the SHA values with actual byte hashes and the source/provenance placeholders with real records. `null` is explicit; do not substitute a guessed card ID.

```json
{
  "schemaVersion": 1,
  "catalogueSha256": "<SHA-256 of the exact catalogue.json bytes>",
  "samples": [
    {
      "id": "private-sample-001",
      "imagePath": "originals/photo-001.jpg",
      "sha256": "<SHA-256 of the private photo bytes>",
      "groupId": "original-session-card-001",
      "source": {
        "dataset": "<original source namespace>",
        "version": "<pinned version>",
        "assetId": "<original asset ID>",
        "url": "https://example.org/replace-with-source",
        "acquiredAt": "2026-11-11T00:00:00Z",
        "attribution": null,
        "license": null,
        "rightsStatus": "unverified",
        "rightsEvidence": null,
        "restrictions": ["No redistribution; rights review pending"]
      },
      "media": "unknown",
      "language": "unknown",
      "verification": {
        "status": "unverified",
        "reviewer": null,
        "reviewedAt": null,
        "evidence": null
      },
      "split": "quarantine",
      "content": "unknown",
      "cards": []
    }
  ]
}
```

For `content: "empty"`, `cards` must also be `[]`. For `content: "cards"`, use at least one annotation, for example `{ "box": [0.1, 0.1, 0.7, 0.8], "regions": [], "identity": null }`, with coordinates actually inspected for that image. A verified card identity has the form `{ "tcgdexId": "base1-4", "observed": { "name": "Charizard", "localId": "4", "setId": "base1" } }`; this shape is illustrative, not evidence that a particular photo depicts that print. All non-null identities, even quarantined ones, must match the snapshot. Keep uncertain guesses outside the ground-truth identity field.

Languages use lowercase codes matching TCGdex endpoint paths, such as `en`, `de`, `ja`, `zh-tw`; `unknown` is explicit. Rights statuses are `verified`, `unverified`, `restricted`. Verified rights require nonempty license, attribution and rights evidence for the intended use. Verification records and paths may contain private information and must not be published.

### Pin a catalogue snapshot and validate offline

A snapshot is `{ "schemaVersion": 1, "records": [{ "language": "en", "sourceUrl": "https://api.tcgdex.net/v2/en/cards/base1-4", "retrievedAt": "<ISO timestamp>", "card": <unaltered JSON card response> }] }`. Each record must contain `id`, `localId`, `name`, `set.id`; other response fields are retained. Keys are unique by language/ID. Do not mix metadata from different languages.

A single targeted metadata example (run from the repository with an **external** private directory, no third-party image download):

```sh
mkdir -p /absolute/private/p08/photos
node --input-type=module - /absolute/private/p08/catalogue.json <<'JS'
import { writeFile } from 'node:fs/promises';
const sourceUrl = 'https://api.tcgdex.net/v2/en/cards/base1-4';
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`TCGdex returned ${response.status}`);
const card = await response.json();
const snapshot = { schemaVersion: 1, records: [
  { language: 'en', sourceUrl, retrievedAt: new Date().toISOString(), card }
] };
await writeFile(process.argv[2], JSON.stringify(snapshot, null, 2) + '\n');
JS
sha256sum /absolute/private/p08/catalogue.json
sha256sum /absolute/private/p08/photos/originals/photo-001.jpg
```

Put those hashes in the private manifest. Freeze and retain the snapshot bytes; do not refetch during validation. An empty `records: []` snapshot suffices only when there are no non-null identity labels. Validation needs no network or credentials:

```sh
node --import tsx scripts/validate-photo-ground-truth.ts \
  /absolute/private/p08/manifest.json \
  /absolute/private/p08/catalogue.json \
  /absolute/private/p08/photos \
  > /absolute/private/p08/validation-report.json
npx vitest run tests/unit/photo-ground-truth.test.ts
```

Exit codes: **0** valid manifest (possibly quarantine-only, not necessarily usable data); **1** schema/identity/rights/hash/path/duplicate/leakage issues; **2** invocation, private-input or JSON read failure. Output is deterministic for unchanged inputs. On invalid manifests, eligible-photo totals are `null`, not a partial approval. Other counts describe supplied records only: verification/media/rights gaps, missing card identities, unknown scenes, languages and splits. Never use these as counts of the unacquired remote datasets.

Duplicate IDs, source dataset/asset pairs and actual byte hashes are rejected even within one split. The same source asset is detected across dataset versions; a shared `groupId` across different splits is leakage. Hashing cannot find differently encoded/cropped near-duplicates unless original lineage is recorded correctly. This is not a perceptual similarity detector or a way to certify a dataset's split hygiene automatically. Image signatures are checked for JPEG/PNG/WebP; no full image decode, visual photo classification or box-to-pixel verification is claimed. Human review, authoritative catalogue capture and provenance remain essential.
