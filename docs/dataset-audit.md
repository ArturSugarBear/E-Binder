# P08-DATASET-01 — real Pokémon photo ground truth

Audit date: **2026-11-11 UTC**. Independent of P07 and P08 recognition work. No model training, inference, deployment or bulk download was performed. The initial Roboflow audit acquired no images; the follow-ups below document one separately sourced private image review and six authenticated workspace samples. Only this report, the offline validator and its unit tests belong in Git.

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

Languages use lowercase codes matching TCGdex endpoint paths, such as `en`, `de`, `ja`, `zh-tw`; `unknown` is explicit. Use image-level `mixed` for photographs containing different card languages. Every identified card in a mixed photo must supply `identity.language`; a verified mixed photo must establish at least two distinct languages. An optional `identity.language` on a single-language photo must agree with its image-level language. Rights statuses are `verified`, `unverified`, `restricted`. Verified rights require nonempty license, attribution and rights evidence for the intended use. Verification records and paths may contain private information and must not be published.

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

Exit codes: **0** valid manifest (possibly quarantine-only, not necessarily usable data); **1** schema/identity/rights/hash/path/duplicate/leakage issues; **2** invocation, private-input or JSON read failure. Output is deterministic for unchanged inputs. The `reviewedExactPhotos` total counts validated, visually reviewed exact-identity photos independently of rights clearance and split eligibility; `usableVerifiedPhotos` additionally requires reviewed rights and an active split. On invalid manifests, both reviewed and eligible-photo totals are `null`, not a partial approval. Other counts describe supplied records only: verification/media/rights gaps, missing card identities, unknown scenes, languages and splits. Never use these as counts of the unacquired remote datasets.

Duplicate IDs, source dataset/asset pairs and actual byte hashes are rejected even within one split. The same source asset is detected across dataset versions; a shared `groupId` across different splits is leakage. Hashing cannot find differently encoded/cropped near-duplicates unless original lineage is recorded correctly. This is not a perceptual similarity detector or a way to certify a dataset's split hygiene automatically. Image signatures are checked for JPEG/PNG/WebP; no full image decode, visual photo classification or box-to-pixel verification is claimed. Human review, authoritative catalogue capture and provenance remain essential.

## Follow-up: an accessible photo and marketplace acquisition route

The access problem is not universal. A bounded follow-up inspected **one** publicly accessible image from [antokun/pokemon-card-segmentation](https://huggingface.co/datasets/antokun/pokemon-card-segmentation/tree/81df8c64e121f7ec26df02519a19af7218616ded), pinned to commit `81df8c64e121f7ec26df02519a19af7218616ded`. Its dataset card declares CC0-1.0 but does not identify the photographer or document the image's rights chain. This is an accessible review candidate, not a blanket clearance of its archive.

Only TAR headers, the 115-byte dataset configuration and a **single 730,700-byte JPEG** were read using ordinary public HTTP Range responses. The 91 MB archive was not downloaded. The image remains outside Git. Its file signature, full image decode for inspection and SHA-256 were checked. Private manifest, pinned TCGdex response and validation report were produced; the real CLI returned `valid: true`, with **one quarantined sample, no missing identity, one unresolved-rights record and zero eligible photos**. No statistics are inferred for the rest of this dataset.

| Checked attribute     | Observation / evidence                                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archive member        | `images/train/1038470_IMG20250418200530.jpg`, 3,000 × 4,000 pixels                                                                                                                                                                  |
| Reproducible bytes    | In the pinned `343182_pokemon.tar`: JPEG payload starts at byte 8,192; length 730,700; SHA-256 `e5588515e1651a65d26fe27e27cbf32e8e93c1e13233e3b054064849d37fbff1`                                                                   |
| Camera-photo evidence | Physical sleeve, background surface, perspective and lighting visible in the actual image; not inferred from its filename                                                                                                           |
| Readable identity     | Kecleon, `205/182`, `SV8s I`, Mori Yuu, HP70; Indonesian ability “Mahir Bersembunyi” and attack “Cambuk Lidah”                                                                                                                      |
| Exact catalogue check | [TCGdex `id/cards/SV8s-205`](https://api.tcgdex.net/v2/id/cards/SV8s-205): matching name, local ID `205`, set `SV8s` / Kilat Rasi, denominator 182, illustrator, ability and attack text. Canonical ID capitalization is preserved. |
| Annotation provenance | Card/name/number/set rectangles were manually outlined during the Codex visual review, not claimed as inspected source annotation files. The archive configuration advertises only the `card` class.                                |
| Verification limit    | Codex visual review; not independent human confirmation, authenticity or finish certification. Identity review and rights clearance are separate. The sample stays quarantined while photographer provenance remains unresolved.    |

For reproducibility, request only payload bytes `8192-738891` from the pinned public TAR, require a matching HTTP 206 Content-Range, verify the hash above before using the bytes, and keep all resulting files in a private directory. Do not expand this single-photo probe into a bulk collector on the strength of the dataset-card badge.

### Marketplace feasibility pilot

Public search discovery was bounded to an example exact card, Guardevoir-ex `245/198`. It yielded candidate listing/product URLs on all three proposed platforms; **no seller images were downloaded, licensed or promoted to ground truth**. Seller names, contact details and locations are unnecessary for this dataset and were not retained in the private source index.

| Platform                                                                                                                 | Pilot finding                                                                                                                                                                                                                                                                                                                                               | Acquisition route                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [eBay example](https://www.ebay.de/itm/158323061094)                                                                     | Its title and item attributes associate `245/198` with “Entwicklungen in Paldea”. [TCGdex `de/cards/sv01-245`](https://api.tcgdex.net/v2/de/cards/sv01-245) instead gives Karmesin & Purpur, local ID `245`, denominator 198. This is a concrete metadata conflict; the seller title is not ground truth. The listing photo was not evaluated or collected. | A purpose-specific agreement is needed for dataset use. [API agreement §9.10](https://developer.ebay.com/join/api-license-agreement) restricts using eBay content to train algorithms, conduct machine learning or develop synthetic datasets. The Browse API is a listing-access mechanism, not a general ML-data license. This task does not train a model, but access permission must not be represented as permission for later ML use. |
| [Kleinanzeigen example](https://www.kleinanzeigen.de/s-anzeige/guardevoir-ex-245-198-pok-mon-karte/3517130700-234-19496) | Search-index discovery only: a candidate title, not a verified photo or current availability claim.                                                                                                                                                                                                                                                         | [Terms §5.1](https://themen.kleinanzeigen.de/nutzungsbedingungen/) require express written approval for crawlers/scrapers and separately address use of third-party listing content. No crawler was run against the platform.                                                                                                                                                                                                               |
| [Cardmarket product](https://www.cardmarket.com/de/Pokemon/Products/Singles/Scarlet-Violet/Gardevoir-ex-V3-SVI245)       | Product URL discovered; direct page retrieval returned 403. A product catalogue entry does not establish an individual seller-photo link or authorship.                                                                                                                                                                                                     | Obtain authorized access and a documented photo license. Do not treat a catalogue image as a real seller photograph, assume a seller photo exists, or bypass the access block.                                                                                                                                                                                                                                                              |

**Recommended working route:** obtain original photographs and card inventory exports directly from consenting collectors/dealers, rather than harvesting their marketplace copies. An opt-in delivery should include original asset ID, photographer/permission evidence, intended private evaluation use, and card name/set/number/language as candidate metadata. Verify readable details against TCGdex, hash/group originals before splitting, and retain uncertain records in quarantine. Any public redistribution or future training rights must be agreed separately. No seller was contacted automatically.

The repository also refers to 34 prior private binder photos. The user clarified these were attachments in earlier chat sessions. They are not present in the current workspace, and targeted Drive searches found no accessible copy. Reattaching those originals would provide a direct first-party route; a historical mention alone cannot populate the dataset or establish their labels.

## Authenticated Roboflow workspace audit

After the user supplied access, the normal authenticated API returned HTTP 200 and exposed two imported workspace projects. The earlier 401 blocker is therefore **resolved for this authorized workspace**. Workspace/project identifiers, account responses, credentials, image URLs and private manifests are not published here. No new versions, exports, training jobs, inference calls or changes to remote projects were made.

These are API-reported project totals, not manually verified-photo totals or a deduplicated union:

| Project alias | API image count | Annotation schema / count  | API source splits                | Generated versions |
| ------------- | --------------- | -------------------------- | -------------------------------- | ------------------ |
| A             | 430             | `cards`: 1,622 boxes       | 430 train; 0 validation; 0 test  | 0                  |
| B             | 142             | `trading-cards`: 143 boxes | 99 train; 29 validation; 14 test | 0                  |

Both projects report CC BY 4.0. Imported workspace ownership and an API key establish authorized access; they do not establish who photographed each imported image. All six image-detail responses inspected had no photographer/license provenance in user metadata. This report retains the distinction between the project-declared license and per-image rights evidence.

### Six-image private sample and actual result

The first three API search results in each project were frozen by image ID in a private snapshot; this is a bounded convenience sample, not random or representative sampling. Six original media files and their raw annotation responses were read, decoded and hashed privately. All six SHA-256 values differ; no claim is made about duplicate rates in the remaining images. Correct JPEG/PNG/WebP extensions are retained.

- **Project A, three inspected images:** a five-card Japanese/English photograph; an occluded photograph of graded/slabbed cards with six selected source boxes and incomplete instance coverage; one clearly legible English Bagon photo. The mixed photo visibly includes an anniversary reprint; its English printed number alone must not select an original-set identity.
- **Project B, three inspected images:** screenshots of hand-held physical Magnezone ex, Chandelure and Torterra cards. Visible fingers, perspective, background and reflections support camera-derived origin; the screenshots are not claimed as original camera files. Their similar backgrounds indicate a possible shared capture session, not proof of duplication. They are conservatively grouped together; the existing train/validation assignments are not reused as independent evaluation splits.
- **Annotations:** 15 source card boxes inspected across the six samples. No source name/number/set regions or exact-print labels were present in these inspected responses. One source box exceeded the image boundary by 0.005 pixels from decimal rounding; the derived normalized box was clipped to the boundary and the correction recorded privately. Raw annotations remain unchanged.

Four single-card images were visually matched against targeted, frozen English TCGdex responses using readable number, name, set identifier/symbol and corroborating details:

| Readable photo         | Exact TCGdex ID                                             | Additional visible evidence                                       |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Bagon `52/107`         | [ex8-52](https://api.tcgdex.net/v2/en/cards/ex8-52)         | Deoxys symbol, Takao Unno, HP50, Singe / Doubleslap               |
| Magnezone ex `065/198` | [sv01-065](https://api.tcgdex.net/v2/en/cards/sv01-065)     | SVI EN, HP330, Energy Crush / Pulse Launcher                      |
| Chandelure `026/196`   | [swsh11-026](https://api.tcgdex.net/v2/en/cards/swsh11-026) | Lost Origin symbol, sui, HP150, Mountain Roasting / Heat Blast    |
| Torterra `008/172`     | [swsh9-008](https://api.tcgdex.net/v2/en/cards/swsh9-008)   | Brilliant Stars symbol, Oswaldo KATO, HP190, Evopress / Hammer In |

These are Codex visual reviews, not independent human confirmation, authenticity or finish certifications. The other two samples remain unverified with **11 unidentified source boxes**. That number counts unresolved annotations, not all distinct physical cards in the occluded scene. No identity was inferred from a source filename.

The actual offline CLI accepted the private six-image manifest with no issues:

```json
{
  "samples": 6,
  "reviewedExactPhotos": 4,
  "usableVerifiedPhotos": 0,
  "unverifiedPhotos": 2,
  "missingIdentities": 11,
  "unresolvedRights": 6,
  "languages": { "mixed": 1, "en": 5 },
  "splits": { "quarantine": 6 }
}
```

Four exact photo identities are now available for review. They have not been promoted into an eligible dataset while imported-photo provenance remains unresolved. English is visible across the sample, with Japanese additionally present in the mixed photograph; language coverage of all 572 project records has not been established. No original split is treated as independently audited ground truth.

### Reproduce the authorized access path

Use a workspace-scoped credential from a local secret or `ROBOFLOW_API_KEY`, never a committed file or a printed request URL. The [official Roboflow Python project reference](https://roboflow.github.io/roboflow-python/core/project/) and its [SDK source](https://github.com/roboflow/roboflow-python/blob/main/roboflow/core/project.py) document the operations used:

1. Read the account/default workspace and its projects via the authenticated API.
2. Read each selected project's metadata to freeze image counts, classes, declared license, source splits and version availability.
3. Call the read-only search operation `POST /{workspace}/{project}/search`, with `offset: 0`, `limit: 3`, `in_dataset: true` and fields `id`, `name`, `annotations`, `labels`, `split`, `user_metadata`, `url`, `width`, `height`. Save selected IDs privately; replay those IDs rather than assuming search order stays unchanged.
4. Read `GET /{workspace}/{project}/images/{image_id}` for raw boxes and returned original-media URLs. Read only the six selected media files; do not request an export or create a version. Keep credentials restricted to the Roboflow API origin, and never append them to image URLs.
5. Preserve raw annotations and provenance. Convert center-based pixel boxes to normalized image-relative boxes, documenting any source-boundary rounding correction. Review the actual files, populate only confirmed exact identities, freeze the language-specific catalogue responses and run the existing offline validator. Keep unresolved data in quarantine.

Private artifacts include the project snapshots, selected-ID index, raw annotation responses, original files, catalogue snapshot, manifest, review notes and JSON validation report. The temporary local credential used for the audit is removed after acquisition. None of these private files or images is included in this PR.
