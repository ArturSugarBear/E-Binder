# E-Binder · Competitive UX benchmark (10 November 2026)

**Provenance:** Owner-captured iPhone screenshots and recordings of **Collectr** and **HoloGem**. Reference evidence ONLY; not licensed as E-Binder production assets. Do not reproduce competitor logos, artwork or brand styling in the product. The implementation must preserve Rare Room's logo, typography and lime palette.

## Reference library

The owner supplied a companion ZIP named `E-Binder_Competitive_Benchmark_Collectr_HoloGem_2026-11-10.zip`, containing **six complete compressed MP4 recordings, six original screenshots, six 6-frame video contact sheets, a SHA-256 media manifest, and an import/verification script**. All 18 assets have been verified locally (about 16.5 MiB of video and images). Videos are 24 fps H.264 and retain the full captured sequences, without audio.

**Note:** The current GitHub connector only writes UTF-8 files. This PR contains the analysis/reference instructions; the actual binary media must be imported from the companion ZIP into this directory. Never claim to have viewed media based solely on the filename or this note.

| App | Recording in companion ZIP | Examine |
| --- | --- | --- |
| Collectr | `collectr/01-intro.mp4` | Entry and first-run navigation, complete 16.7 s |
| Collectr | `collectr/02-search-catalog.mp4` | ~12 s card detail / Raw–Graded–POP; ~21 s search; ~30–39 s set logos; ~47 s sort sheet |
| Collectr | `collectr/03-scanning-and-portfolio.mp4` | ~29–71 s framed photo scan; ~93 s editable multi-match review; ~112 s portfolio result |
| HoloGem | `hologem/01-onboarding.mp4` | First-run empty state, camera call to action, product promises |
| HoloGem | `hologem/02-scan-experience.mp4` | ~3 s permissions; ~11 s live rectangle/hold still; ~20–36 s recognized-card queue; ~44 s vault |
| HoloGem | `hologem/03-vault-and-home.mp4` | ~4 s portfolio; ~15 s set discovery; ~26 s filters; ~37 s card grid; ~48 s add-to-vault sheet; ~58 s vault |

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

Do not put the reference recordings into `public/` or bundle them into E-Binder's PWA. The E-Binder GitHub repo is public: review rights before making third-party screen captures publicly available. Until these files are imported, **full competitive-video review is blocked**, despite the written requirements being present.
