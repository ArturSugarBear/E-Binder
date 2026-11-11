# P08 — Visual retrieval for individual cards (2026-11-11)

**Implemented path:** optional local ONNX retrieval in the *single-card* workflow, complementing the already-present binder-page image search. **Not yet activated on production**, because a sufficiently complete, rights-cleared, model-matched card-image corpus is not bundled.

## What is implemented

- Individual card review now opens **one reusable, same-origin ONNX visual-search session per add-card dialog** (only when `assets/vision/manifest.json` is installed).
- The worker computes a private photo embedding, compares it to a SHA-256-verified, versioned, quantized card index, and returns its best five printing references. **No photo bytes are sent to Supabase or the remote model provider.**
- Existing TCGdex card metadata is resolved only for those five image candidates, in parallel with OCR's existing set/number catalogue search. A remote response must agree with the reference's source ID, set, collector fraction **and language**; a neighboring or swapped record is rejected.
- Even with totally unreadable OCR, the app can present *image candidate alternatives* when a licensed index exists. The UI explicitly says the exact printing and language are **unverified**.
- Partial OCR digits must not discard visual top-five matches. Full set and printed fraction can establish an exact proposal according to the shared P04/P05 evidence policy, but never automatically add inventory.
- The lightweight color-signature comparison is only a bounded **ranking signal**; a high similarity score or a large margin **cannot be taken as confidence that a specific print is owned**.
- Missing manifest, model mismatch, bad hash, slow inference, offline metadata or unavailable catalogue: keep the prior OCR/search/manual correction path.
- The private scanner benchmark now records `visualModelCandidates` in addition to ranked exact printing keys and top-1/3/5, with no invented percentages.

## Important identity boundaries

1. **Groudon 111/103 (Delta Reign)** is not Groudon 053/103, regardless of artwork/name resemblance. Exact card identification never borrows the base printing or its Cardmarket price.
2. German and English versions can have virtually identical artwork. The visual model alone **does not establish language**. Both are eligible review candidates if independently indexed.
3. Japanese printings may share an image with other sets but have different local numbers and set totals. Require the exact TCGdex ID and printed collector fraction.
4. Energy and Trainer/Item printings need the exact card type/name/number for a unique match; do not auto-accept a common artwork pattern.
5. Card finish, grading, condition and ownership cannot be proven by generic embeddings.

## Validated model options

Meta's [DINOv2-S](https://huggingface.co/facebook/dinov2-small) is Apache-2.0 and produces 384-dimensional CLS features; it is explicitly intended to support nearest-neighbor image retrieval. Unquantized weights are approximately **88 MB**, too large to ship blindly in an iPhone-first PWA.

[ONNX Community's DINOv2-S](https://huggingface.co/onnx-community/dinov2-small/tree/main/onnx) provides several prequantized artifacts, including a **24.4 MB INT8** variant and a **16.9 MB Q4** variant (there is also a smaller mixed-precision artifact). These sizes are file sizes, **not** measured iOS download/cache/memory or inference costs. Before choosing one, verify its exact exported tensor output, WASM operator support, quantization quality and compatibility with our browser/desktop index exporter.

A production index must be derived from **the same exact weight file** and identical image preprocessing and CLS pooling. No model from a competitor app, third-party generated feature index or private photo set may be copied into this repository. The existing `scripts/embed-card-references.py` and `scripts/pack-visual-index.mjs` support offline generation from rights-cleared local reference artwork.

## Local A/B gate (not optional for activation)

- Collect a private consented ground truth (at least 100 individual images across DE/EN/JA and 20 binder pages with negatives, glare, sleeves and duplicate art).
- Keep every private sample out of the public repository.
- Compare OCR alone vs OCR + the **same image model and corpus** on the same samples. Report exact print top-1, top-3, top-5, false-positive suggestions, missing-candidate rate, correction rate, p50/p95 capture/review time, memory peak and offline behavior.
- **No deployment of a bare 198-image demo index as a universal Pokémon card recognizer.** It would look confident while missing most of the actual card universe.
- Include cold/warm iPhone Safari tests and Japanese rare/trainers/energy stratification before enabling by default.

## Release constraint

P08 is deliberately separate from P07 camera UX. The existing P07 PR may change single-card capture and asynchronous OCR; merge P08 after rebasing onto that completed branch, preserving P07's 5.6-second background inference budget. Do not make one image-model cold download block the physical capture loop.
