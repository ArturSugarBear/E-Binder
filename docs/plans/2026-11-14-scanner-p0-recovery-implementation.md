# P0 Scanner Recovery — Implementation Plan (2026-11-14)

**Status:** Proposal only. No application code, database schema, configuration, permissions, or deployment changes authorized by this document.

## 1. Problem statement and observed evidence

A release test by **artur-test** (distinct from **artur-dev**) reported zero successful automatic card recognitions, mandatory manual cropping, crop latency, and repeated irrelevant card suggestions with AI scan and diagnostics enabled. Treat this as a high-priority field report, **not** as a statistically measured recognition rate. Neither account is named `ato-Test` or `ato-dev`.

Repository issue [#114](https://github.com/ArturSugarBear/E-Binder/issues/114) documents a DINOv2-S pilot with **nine German exact printings and zero English/Japanese**. This small index is unsuitable for general card recognition. At the time of planning, read-only Supabase inspection showed 2,462 diagnostic events, 92 consented scan samples (all pending review), and 16 feedback entries; these are not independent ground-truth labels. The existing Chromium/WebKit ONNX smoke tests prove execution, not camera-photo accuracy.

## 2. Desired behavior and non-goals

- Detect and rectify the card automatically while keeping the live camera responsive; never require cropping as the default interaction.
- Search all _available, properly indexed and rights-cleared_ exact-print references, not a fixed nine-card demo shortlist. Distinguish catalog coverage from visual index coverage.
- Use one canonical card identity across Discover, scanner, binder and portfolio: source ID + language + set ID + collector number (preserve leading zeros and printed fraction) + verified print variant. Never infer edition, foil, condition or price from image similarity.
- Fuse visual retrieval with OCR of set code, collector number and complete card name; retain multiple plausible candidates when evidence is weak. No silent inventory additions.
- Maintain OCR/catalog/manual fallback if visual assets are absent, offline or too slow.
- Do **not** claim calibrated 0.8 probabilities, universal recognition, or deployed RF-DETR. Roboflow RF-DETR remains outside the PWA until separately implemented and evaluated.
- No wholesale granting of developer or admin rights. Restrict `artur-test` and `artur-dev` to explicitly approved diagnostics capabilities with server-side authorization; never elevate arbitrary users.

## 3. Investigation first — reproducible baseline (P0-A)

1. Record exact deployed build/version SHA, service worker cache version, browser/device, permissions, AI toggles, session identifier and timestamp for the failing `artur-test` session. Compare the observed version with `version.json`; do not attribute a stale PWA to a new release.
2. Analyze `beta_diagnostic_events` by build, session, action, outcome and timing; join only where privacy-safe and identifiers actually match. Distinguish `live_ocr_unresolved`, `no_candidate`, `recognition_failed`, `visual_beta_shortlist`, `live_candidate_ready`, review correction, crop and camera restart. Count distinct captures separately from events. Keep raw user IDs and private photo paths out of public GitHub.
3. Trace the live camera -> card boundary -> crop -> preprocessing -> ONNX worker -> visual index -> OCR -> catalog resolution -> candidate ranking -> review path, including all timeout, fallback, and cache branches. Compare single-card and binder-page paths.
4. Reproduce with a private labeled DE/EN/JA corpus, including non-indexed cards, repeats, glare, sleeves, blurred frames, rare/Mega/ex, Japanese sets and exact-print negatives. Confirm whether the repeated suggestions are forced nearest neighbors from the nine-card index, a default-card fallback, stale cached manifests, or candidate-state leakage; do not assume cause before tracing.
5. Establish a baseline report: capture-to-first-feedback, crop p50/p95, ONNX cold/warm p50/p95, OCR p50/p95, candidate recall, exact-print Top-1/3/5, false positives, correction count, no-result rate, memory and offline behavior.

**Exit:** One reproducible failing path with trace, version, sample identifier and concrete root-cause evidence. No private images published.

## 4. Canonical catalog and reference index (P0-B)

1. Inventory the existing Discover/TCGdex catalog data, its IDs, image references, language/set coverage, pricing mapping and caching. Avoid creating a second incompatible catalog or blindly copying third-party data into Supabase.
2. Define normalized printing identity and provenance, e.g. `(provider, source_card_id, language, set_id, collector_number, variant)`; canonicalize leading zeros and fraction only for matching while retaining original display text. Explicitly handle multiple languages sharing artwork, reprints, first-edition stamps, secret rares, Trainer/Energy cards and distinct finishes.
3. Choose **Supabase as an optional canonical metadata/cache and index-manifest store**, subject to provider terms, licensing, freshness and storage costs. Keep provider attribution, update timestamps, invalidation, import checkpoints and data-source reconciliation. Never assume every Discover record has an embeddable image.
4. Audit image access and embedding/redistribution rights _per source_. Internet visibility does not grant rehosting or embedding rights. Index only authorized exact-print reference images; document missing coverage.
5. Generate reference embeddings using the **exact deployed DINOv2 ONNX weights, pooling and preprocessing**. Version each shard with model hash, preprocessor hash, manifest schema, exact-print count per language, checksums and provenance. Do not mix incompatible embedding spaces.
6. Support incremental generation and content-addressed shards rather than one giant PWA download. Prefer local compressed search shards with lazy loading and IndexedDB caching for the iPhone-first path; benchmark network/storage/memory. Consider server-side Supabase pgvector/HNSW as a separate option only after testing latency, operational cost, privacy, offline fallback and rights. Never upload raw scans merely to do cloud similarity without explicit consent.
7. Gate index publication on a real coverage audit. When the indexed universe is incomplete, label the coverage accurately and fall back to OCR/catalog search instead of always returning a visually similar pilot card.

**Exit:** Auditable coverage and rights report, versioned manifest, exact-print mapping and benchmarked retrieval path. No hardcoded nine-card shortlist in general scanner suggestions.

## 5. Recognition and capture pipeline (P0-C)

1. Decouple camera capture from recognition; maintain continuous preview, reuse workers and avoid reopening camera after each failed result.
2. Detect card quadrilateral from live frames with visible corner feedback, temporal stability and blur/glare checks. Run perspective correction automatically when geometry is trustworthy; keep optional non-blocking correction. For binder pages, detect outer page and inner 3×3 pocket geometry separately; crop card ROI rather than plastic pocket boundaries.
3. Use a bounded multi-frame strategy and progressive resolution: cheap detection/quality check first, then higher-resolution crop if required. Do not repeatedly OCR the full frame or block the camera thread.
4. Visual retrieval proposes a sufficiently broad Top-K from the licensed index; OCR extracts set/number/name from targeted ROIs. Fuse with explicit evidence rules: exact set+number+language can disambiguate; partial digits only re-rank; name and image alone cannot prove a printing. Keep visual candidates available even when OCR fails.
5. Deduplicate repeated _captures_ by stable session/capture identity, not just image hash; suppress repeated identical bad suggestions without hiding legitimate duplicates of the same physical card. Separate retrieval failure, catalog miss, model unavailable and offline conditions.
6. Present an understandable state machine: `detecting card` -> `matching artwork` -> `reading print` -> `confirming candidate`; show shimmer/progress honestly, with cancel/retry and no fabricated percentages. Never auto-add an uncertain card.
7. Reuse the same resolver and canonical IDs in single-card and binder-page scans; share ranking policy and logging, while preserving distinct geometry handling.

**Exit:** No mandatory manual crop in normal captures, no forced nine-card suggestions, camera stays responsive, and every failure yields a recoverable review state.

## 6. Beta diagnostics, labeling and security (P0-D)

1. Confirm `artur-test` and `artur-dev` identities through authenticated account records before granting any scoped diagnostic access. Use server-controlled claims/roles and RLS; never use editable user metadata or public client switches as authorization. No blanket developer/admin access for other accounts.
2. Preserve opt-in for image donation, consent version, retention/deletion rights, private storage and separation of raw photo from public telemetry. Existing 92 pending samples remain **unverified** until independently labeled.
3. Create a private review workflow: inspect original capture, predicted boundary, proposed candidates, user-selected printing, language/variant, and review evidence. User corrections are weak labels until independently verified. Prevent train/test leakage by capture/session grouping.
4. Capture machine-readable per-stage timings, model/index version, candidate IDs, crop source, fallback reason and correction outcome; redact identifiers and never emit private image URLs, tokens or credentials into public logs.
5. Provide a private, reproducible benchmark export for authorized reviewers. Compare OCR-only, pilot fusion, expanded fusion and ablations on the _same_ labeled samples.

**Exit:** A privacy-safe feedback loop and auditable exact-print labels, not automatic training on unreviewed scans.

## 7. Hosting decision (P1)

GitHub Pages and Vercel can both host a static Vite PWA. Migrating hosting **alone** does not increase recognition accuracy. Evaluate Vercel only for deployment ergonomics, headers, asset distribution and optional server endpoints. Supabase can serve metadata and secured API/data services independently of hosting. Compare real iPhone cold-start and cache behavior before switching production domain; preserve the existing GitHub Pages release until a separate migration gate passes.

## 8. Verification and release gates

- **Unit/integration:** canonical IDs, leading zeros, language collisions, same-art reprints, index/model hash mismatch, absent assets, OCR failure, stale cache, Top-K fusion, duplicates, state machine and privacy controls.
- **Browser:** `npm run check`; complete Chromium and WebKit regression; real ONNX worker with actual deployed weights, manifest and index (not mocked); mobile viewport and offline fallback. Inspect failed job logs, fix on a branch and rerun.
- **Real devices:** physical iPhone Safari/PWA with at least 100 independently labeled single-card photos and 20 binder pages spanning DE/EN/JA, glare, sleeves, negatives, repeats and low light. Report per-language coverage, Top-1/3/5 exact printing, false-positive rate, no-result rate, manual-crop rate, p50/p95 latency, RAM, cold-start and multi-card continuity. Baseline vs candidate must use identical test splits. **No invented accuracy threshold or probability calibration.**
- **Release discipline:** small PRs, reviewed diffs, exact head-SHA required checks, merge only when green and mergeable; deploy/verify-production and version.json must match the new master SHA. Roll back on camera regression or privacy breach. Test on the actual published build before declaring scanner fixed.

## 9. Suggested work packages and order

- **PR-A Diagnostics/root cause:** reproduce `artur-test` failure; document traces, pilot-index fallback and crop latency. No speculative fixes.
- **PR-B Canonical catalog:** shared exact-print resolver and coverage/provenance audit; preserve existing Discover and prices.
- **PR-C Retrieval coverage:** licensed multilingual DINOv2 index, lazy shards, cache/version checks, explicit coverage-aware fallback.
- **PR-D Live capture UX:** automatic card geometry, worker reuse, responsive camera, non-blocking correction.
- **PR-E Fusion/review:** robust OCR+visual ranking, meaningful Top-K, no stale candidates and unified single/binder resolution.
- **PR-F Beta quality loop:** private independent labeling, diagnostic analysis and representative benchmark.
- **PR-G Production gate:** real-device evidence, CI, guarded rollout and post-deploy monitoring. Hosting migration is separate.

## 10. Constraints and decision record

- This file is a **planning artifact only**; it does not approve implementation, schema changes, account elevation, PR merging or deployment.
- Do not claim RF-DETR is integrated; do not equate ONNX worker execution with real card recognition.
- Preserve other PRs and user data.
- Follow issue #114 for corpus/rights blockers; benchmark against the documented HoloGem interaction observations, not unverified claims about its private backend.
