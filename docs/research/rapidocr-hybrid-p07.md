# P07 — RapidOCR + Multi-Frame Hybrid Card Identification

**Status: engineering design and evaluation plan, not production accuracy evidence.**
**Date:** 2026-11-11. Scope: EN, DE, JA single-card scanning; later nine-pocket binder scans.

## Decision

A Pokemon card is identified by an **exact printing**, not by the presence of a
Pokemon name or a high image-similarity number. A robust local-first pipeline:

1. **Capture continuously; recognize in the background; review later.** Auto-lock after three stable camera
   observations, queue the cropped card immediately, and keep the camera live.
   Require actual card removal before automatic rearming; offer an explicit
   override button. No OCR, internet or price lookup should block the next
   physical card.
2. **Collect independent visual evidence.** During a stable lock, retain a
   bounded rolling window of at most three distinct, full-resolution video
   frames sampled about 100–250 ms apart. Do not count multiple crops from one
   frame as independent votes. Apply lightweight blur, glare and geometric
   quality checks to choose the most readable capture per region.
3. **Use the card geometry to crop hot zones** before recognizing text. On a
   rectified 63:88 card: left/bottom footer for printed set and collector
   number; broad upper title band for the _entire_ name including EX, Mega and
   prefix; inside body for supported trainer/energy exceptions. Regions are
   orientation-aware and can expand for misaligned prints and sleeves.
   Recognition should be run on **selected crops**, not the whole image by
   default. The existing worker already does partial footer/title OCR; improve
   its crop policy before replacing the runtime.
4. **Use a visual candidate shortlist** (same-origin licensed artwork and
   model, ONNX WASM on iOS) to narrow the set space. A model cosine score is
   not a calibrated probability and cannot identify DE/EN/JA language, a
   duplicate artwork, or a holo variant by itself.
5. **OCR / catalogue fusion.** Match known printed set + exact collector
   fraction, require full-name plausibility and image agreement, and preserve
   language and printing variants. Where one field disagrees, leave the review
   open and show alternatives. A partial number or generic 'Energy' cannot
   uniquely select a printing; a single photo is only a single exposure.
6. **Minimal human review.** Show card preview, one strongest suggestion,
   adjacent alternatives, and two clear actions: confirm the exact printing
   or correct it. Require a separate deliberate inventory commit. Continue to
   the next queued photo automatically after confirming; no guessed ownership.
7. **Privacy:** all frames and OCR transcripts transient, local, not
   uploaded to GitHub or Supabase. Artur-dev receives categorical diagnostics
   only (OCR missing, disagreement, candidate count, correction) and no image
   bytes, field values or literal OCR text.

## Model candidates and licensing

- RapidOCR is maintained by **RapidAI**, _not Google_.
  https://github.com/RapidAI/RapidOCR
- RapidOCR uses PaddleOCR-based ONNX models and supports ONNX Runtime,
  with code and relevant distributed model rights described as Apache-2.0.
  Verify each chosen artifact and attribution independently.
- RapidOCR PP-OCRv6 **tiny** is attractive for Latin/English speed but its
  published language routes exclude **Japanese**. Compare v6 small multilingual
  or language-specific v5 mobile for JA; do not ship a tiny-only model and
  quietly lose Japanese support.
  https://rapidai.github.io/RapidOCRDocs/main/en/model_list/
- A Python RapidOCR library cannot simply be imported into an iOS PWA.
  Integration must package tested ONNX weights, dictionary, preprocessing,
  decoder and WASM support with hashes, expiry and caching. Our existing
  browser worker is also ONNX Runtime and already contains card hot zones.
- Use a feature-gated recognizer adapter; default remains the current tested
  PP-OCRv4 pipeline until a benchmark wins. Do not introduce a server API or
  send card photos to a remote OCR service.

## Hot zones

| Region                   | Typical crop on rectified card (normalized x,y,w,h) | Rule                                                                                                                               |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Collector fraction + set | (0.04,0.89,0.63,0.10)                               | Multiple vertical offsets, small text; DLR, PBL, M1L and language-aware set alias map                                              |
| Full title               | (0.04,0.00,0.91,0.12)                               | Keep whole name, suffix/prefix and non-Latin characters; trainer/item title uses same first pass                                   |
| Art                      | (0.06,0.12,0.88,0.70)                               | Image retrieval only, not OCR match certificate                                                                                    |
| Special energy / trainer | (0.07,0.07,0.86,0.24)                               | On inconclusive primary read, look for energy type or exact trainer/item text and illustration; no random generic energy set match |
| Footer fallback          | (0.02,0.82,0.95,0.17)                               | Use only on ambiguous, missing or conflicting numbers; prevent slow full-card passes                                               |

These are **starting regions**, not universal coordinates: rotated, nonstandard
promo, Japanese special layouts, V/EX and full-art designs require measured
fallbacks. The current vision-worker has separate bottom-right and four
footer stripes, which should remain as a defensive fallback.

## Evidence policy

- Set + full number agrees across distinct frames, title consistent, and
  visual candidate agrees: highlight exact printing for review.
- Only one readable frame: retain an OCR candidate but label it **unverified**.
- Two frames disagree on full printed numbers or set: do **not** silently pick
  the majority. Either re-read another distinct high-quality frame or require
  human selection.
- If title reads `Lucario` but set+number candidate is `Mega Lucario ex`,
  do not quietly accept a partial-name match; emphasize the contradiction.
- Typed energy requires correct **type** plus exact printing. Generic energy,
  generic Trainer or unreadable title cannot establish an exact item.
- Artwork of EN and DE prints can be identical; language must be separately
  established or explicitly confirmed.
- Never infer foil/reverse condition solely from normal camera imagery.

## A/B acceptance gate before enabling RapidOCR by default

Use private, annotated reference set (minimum 100 individual cards, 20
three-by-three binder pages, 30 negatives) with language and special-type
strata. Compare baseline PP-OCRv4 vs v6 tiny/Latin vs v6 small/JA and
multi-frame crop fusion on the **same sample IDs**. Include actual physical
iPhone Safari/PWA runs, cold start, warmed session and memory pressure.

Required reporting: exact-print Top-1/Top-3/Top-5, false-positive auto
suggestions, unrecognized fraction, manual corrections, false empty pocket
rate, p50/p95 capture-to-next-ready and p50/p95 photo-to-review-ready,
download bytes, peak memory, camera track cleanup and offline fallback.
Denominators include technical failures. No fabricated accuracy targets or
benchmarks, and no private photos in the public repository.

## Delivery slices

- **P07a:** make camera capture independent of OCR/network; launch a
  bounded **5.6-second** hot-zone OCR job per captured card immediately in
  a single reused worker queue while the camera stays live. The scanner
  shows a looping analysis sweep ONLY during genuine pending OCR work;
  reduced-motion users see a static indicator. Failed or slow scans keep
  the photo for an automatic full OCR attempt at review, without requiring
  a new photograph. Also include a stable card-removal rearm, obvious
  fallback, back navigation and screen-reader state. Tests use a synthetic
  camera and stubbed worker; they do not claim real accuracy.
- **Remaining P07a calibration:** evaluate cold-start ONNX model load on
  physical iPhone Safari; the 5.6-second budget bounds the OCR invocation,
  but does not guarantee a result within that time. Multiple queued cards
  are processed serially to protect iPhone memory.
- **P07b:** frame sampler, sharpness/glare selection, per-region multi-frame
  consensus. Bounded memory; cap OCR calls and stop early when evidence
  converges. Test with real user photos locally.
- **P07c:** RapidOCR ONNX adapter behind a flag, first Latin/DE-EN,
  then JA-compatible route, full A/B with baseline and iPhone budgets.
- **P08:** visual model/embedding index and independent card artwork
  verification only when licensing, download and quality gates pass.

## TinyFish 2026-11-11 live QA

On the public app, the automated browser reached Sammlung → Karten
hinzufügen → Karte live scannen but had no real camera. It observed a
hidden-by-disclosure camera fallback and nested dialogs; the manual form
also lacked an explicit Back action. The apparent nonresponse from 'Fotos
auswählen' may simply be the system file-picker not being represented in
browser automation. No claim is made about physical iPhone camera accuracy.
