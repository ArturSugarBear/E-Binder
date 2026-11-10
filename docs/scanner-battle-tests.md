# E-Binder Scanner — Battle-Test-Plan (2026-11-10)

A green build is not a recognition accuracy measurement. We distinguish four
layers explicitly:

1. **Safety and lifecycle** (automated, commit gate): a live camera never
   creates ownership; closing the sheet stops camera tracks even if permission
   resolves late; invalid outlines cannot trigger automatic capture.
2. **Image geometry and synthetic stream** (automated, commit gate):
   stable three-frame detection, jitter, missing corners, square/landscape
   false positives, two consecutive scans, short-lived photo storage,
   persistence of *metadata only* after reload.
3. **Real image recognition** (benchmark, local private dataset): actual
   photographed cards under variable light, sleeves, glare, tilt, rotation,
   cropped corners, foreign languages, trainer/energy/normal/full-art/holo.
   Measure exact-card top-1 and top-3 rates and scan duration **by condition**.
4. **Native iPhone PWA** (manual device test): camera orientation, focus,
   torch/flash, permission prompt, background/foreground, thermal behavior,
   low-memory reload, VoiceOver, and repeated scans. Playwright WebKit is not
   a substitute for a physical iPhone.

## Reproducible real-photo sample manifest

Do **not** commit photos or local result files to the public repository.
Create a private folder with your own photos and a manifest:

```json
{
  "samples": [
    {
      "photo": "./photos/standard-well-lit.jpg",
      "rights": "My own photo, private benchmark",
      "expectedKey": "tcgdex:de:sv01-211",
      "language": "de",
      "conditions": ["normal", "no-sleeve"]
    },
    {
      "photo": "./photos/dark-holo.jpg",
      "rights": "My own photo, private benchmark",
      "expectedKey": "tcgdex:de:obf-223",
      "conditions": ["holo", "glare", "low-light"],
      "corners": [
        [0.12, 0.09],
        [0.87, 0.08],
        [0.92, 0.93],
        [0.08, 0.94]
      ]
    },
    {
      "photo": "./photos/blank-table.jpg",
      "rights": "My own photo, private benchmark",
      "expectedKey": null,
      "conditions": ["negative", "no-card"]
    }
  ]
}
```

Replace these illustration-only IDs with **verified exact printing keys** from
the app; the examples are not evidence that those photos were scanned. Use
`null` for no-card and non-scoreable negative samples. Ground truth must
include actual set, collector number, language and printing, not just a name.

Run from the project root with a local app:

```sh
npm ci
npm run build
npm run preview
CARD_SCAN_BENCHMARK_OUT=~/private/scan-results.json \
  node scripts/benchmark-card-scans.mjs ~/private/card-ground-truth.json
```

**Measures:** successful OCR runs, exact printing top-1/top-3 rate, no-card
false candidate count, duration and condition-specific breakdown. Records
photo *basename*, ground-truth keys and conditions but never photo pixels.
Run in a fresh private browser context for every sample.

**Caveats:** a photo-gallery benchmark uses the manual alignment/review path,
not the real-time camera autofocus/edge detector. Evaluation of recognition
must use *actual* OCR, not the stubs in camera lifecycle tests. Distinguish a
local OCR text result from a correct card *printing*. Service availability
influences catalogue matching; record online/offline status and run time.

## Minimum realistic test campaign for a release decision

- **At least 100 independent single-card photos** with verified printings,
  including 20 holo/reverse or sleeved cards, 20 difficult light/reflection
  conditions, 10 Japanese/English or older sets, 10 energy/trainers/promos,
  and repeated shots from different distances/angles. These categories may
  overlap; always report exact counts.
- **At least 20 full 9-pocket binder pages**, including partly empty pages,
  different binder layouts, glossy pockets, nonstandard spacing and tilt.
  Report top-1, top-3 and empty-pocket errors by *slot*. A false auto-empty
  must never silently commit ownership changes.
- **At least 30 negative/non-card photos** (table, book, hand, card back,
  rectangular packaging, too-close crop, blank paper) to evaluate automatic
  edge-lock false positives, which OCR accuracy alone does not measure.
- **At least 50 live cycles on a physical iPhone**: 10 repeated identical
  scans, 10 varied exposure, 10 pause/resume, 10 cancel while processing,
  10 two-or-more sequential scans. Verify camera track released at exit,
  no duplicate ownership, no stored image bytes, and reversible draft cleanup.
- **No release acceptance without the measured report** for accuracy
  improvements. Targets for future iterations: >=90% top-3 on clear in-scope
  images, <=5% unintended automatic capture in negatives, and zero implicit
  ownership. These are **targets, not measured achievements**.

The current CI simulator uses locally drawn frames and a **stub OCR worker**
to exercise camera and queue behavior. It cannot certify actual recognition
accuracy. Real-photo benchmarking must remain a separately visible gate.
