# Collector Experience: content beyond navigation

The five-tab Rare Room V2 shell is stable. This release makes the content itself coherent without borrowing competitor assets or changing the confirmed-inventory model.

## What changed

- Home provides three direct next actions: scan a physical 3×3 binder page, explore sets or resume pending capture review, and open a binder or isolated demo. The three teaching steps remain for a first-time collector.
- Discover has explicit Sets and Cards modes. The existing set catalogue is first, selecting a set reveals a card grid, and filters and deep links remain available. Set progress is based on distinct **confirmed editions** by set and language, never total copies or unverified scan candidates.
- The owned card vault displays actual edition count, unplaced physical copies and existing binder pages alongside a direct Binder action.
- The add-card flow makes capture, edition review and explicit confirmation visible. Neither OCR results nor wishes add inventory automatically.
- Brand kit, artwork source restrictions, keyboard/44px behavior and the center Scan action are unchanged.

## Not claimed

This is not a pixel-for-pixel competitor replica or a finished every-interaction audit. Scanner visual detection quality and live-camera performance require separate real-device benchmark sessions. Pricing remains verified-source-only.

## Release requirements

Run formatting, lint, unit and production build, then Chromium, mobile Chromium and WebKit E2E. Confirm the deployed public app, not merely the merged code. Keep `#44` developer diagnostics in its own security-gated release.
