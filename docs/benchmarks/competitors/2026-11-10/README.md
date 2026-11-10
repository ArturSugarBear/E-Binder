# E-Binder · Competitive UX benchmark (10 November 2026)

**Provenance:** Owner-captured iPhone screenshots and recordings of **Collectr** and **HoloGem**. Reference evidence ONLY; not licensed as E-Binder production assets. Do not reproduce competitor logos, artwork or brand styling in the product. The implementation must preserve Rare Room's logo, typography and lime palette.

## Reference library

Imported from the owner-provided Google Drive ZIP `E-Binder_Competitive_Benchmark_Collectr_HoloGem_2026-11-10.zip` (17,015,184 bytes, SHA-256 `804206601a3ba922b482d03bc47f40d95361c3ad4bea7a955e593823e04a9ee6`). This directory contains **six MP4 recordings, six original screenshots, six 6-frame video contact sheets and the original SHA-256 media manifest**. The 18 assets total 17,313,400 bytes. All six imported videos are H.264, 512×1106, 24 fps, without audio (verified with `ffprobe`). Their full imported durations were reviewed through timestamped frame samples; the larger pre-compression originals were not available for comparison.

**Verification:** `node scripts/verify-competitor-media.mjs` succeeds with **18/18 benchmark media verified**. The import was extracted at repository root. The ZIP also contained older copies of this README and the verifier; the reviewed branch versions were retained and updated rather than reverting their integrity checks.

Read the [complete analysis and evidence inventory](ANALYSIS.md), then the [integration status](INTEGRATION.md). These distinguish observed competitor behavior, transferred principles, changes implemented in #39 and work owned by the still-open #37/#38.

| App      | Recording in companion ZIP               | Examine                                                                                                    |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Collectr | `collectr/01-intro.mp4`                  | Entry and first-run navigation, complete 16.7 s                                                            |
| Collectr | `collectr/02-search-catalog.mp4`         | ~12 s card detail / Raw–Graded–POP; ~21 s search; ~30–39 s set logos; ~47 s sort sheet                     |
| Collectr | `collectr/03-scanning-and-portfolio.mp4` | ~29–71 s framed photo scan; ~93 s editable multi-match review; ~112 s portfolio result                     |
| HoloGem  | `hologem/01-onboarding.mp4`              | First-run empty state, camera call to action, product promises                                             |
| HoloGem  | `hologem/02-scan-experience.mp4`         | ~3 s permissions; ~11 s live rectangle/hold still; ~20–36 s recognized-card queue; ~44 s vault             |
| HoloGem  | `hologem/03-vault-and-home.mp4`          | ~4 s portfolio; ~15 s set discovery; ~26 s filters; ~37 s card grid; ~48 s add-to-vault sheet; ~58 s vault |

Contact sheets: replace `.mp4` with `-contact.jpg`. Original screenshots are in the corresponding app folders. Exact duration, filenames and hashes are in `media-manifest.json` from the companion ZIP.

## What Codex must benchmark and build independently

1. **Navigation:** Five primary destinations — Home, Entdecken, central Scan, Sammlung, Profil. Collection keeps Binder / Cards / Portfolio tabs. Safe areas, legible glass, accessible hit targets and one selected tab at a time.
2. **First run:** One prominent scanner action and a short three-step explanation; no invented `€0` portfolio valuation when market data are unknown.
3. **True live scanner:** Visible video, genuine card corner detection and truthful status transitions (searching → stable → capturing → matching → review), clear lighting guidance, reduced-motion semantics, repeat scanning. Do not equate a yellow bounding box with successful exact-card recognition.
4. **Editable scan queue:** Remove one/all pending captures, change incorrect recognition, review variant, set, number, language, condition, price provenance, quantity. No silent ownership and no persistent raw photo bytes.
5. **Explore and sets:** Useful category/set navigation, big artwork, actual logos and explicit missing/owned progress. Never show an image of a different language or printing without an accurate explanation.
6. **Portfolio:** Distinguish listed vs sold price, dated sources and partial value coverage; no fabricated historical curves or grade-specific numbers.
7. **Rare Room quality:** Retain E-Binder's brand kit. Adapt **interaction patterns**, not competitor screenshots, exact graphic compositions or trademarks.

For every change cite `app + video filename + timestamp + observed interaction`; add a user problem, E-Binder design response, implementation and browser test. Use the actual playback sequence to verify animations; a still contact sheet does not establish latency. The 34 private binder-page photos are a separate scanner ground-truth dataset; do not mix them into this public competitor media collection.

## Import to Codex checkout

Download the companion ZIP from the original ChatGPT handoff, put it at the **repository root**, and run:

```sh
unzip -o E-Binder_Competitive_Benchmark_Collectr_HoloGem_2026-11-10.zip
node scripts/verify-competitor-media.mjs
git add docs/benchmarks/competitors/2026-11-10 scripts/verify-competitor-media.mjs
git commit -m "Add owner-captured Collectr and HoloGem reference media"
```

The media are now imported; the command above documents the original bundle layout. Do not overwrite a newer verifier or analysis with older bundled text files. Keep the reference recordings outside `public/`, application imports and the PWA precache. #39 remains a reviewable PR; no automatic merge is implied by media verification.
