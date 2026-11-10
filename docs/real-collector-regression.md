# Collector regression: real browser flows

Validated on the public Rare Room site on 10 November 2026, without login:

- The canonical **Zenit der Könige** set (SWSH12.5) opened with card art,
  details, price reference and an Add to Collection entry point. The common
  **Zenith der Könige** spelling was not covered by strict set matching.
- Portfolio rendered an empty state for a fresh local user, but presented no
  chart and did not offer an immediate demo. A blank portfolio is expected
  without owned cards, not a reason to hide collection composition.
- Binder-page scanning offered a static camera file input and gallery upload,
  but no live alignment overlay comparable to single-card capture.

Release acceptance on the corrected branch:

- Search both spellings and a transliterated **Koenige** variant.
- Show an actual collection-by-set visualization for confirmed demo holdings,
  with unknown EUR prices left visibly unknown.
- Open a real 3-by-3 live camera. Handle permission denial and return to
  normal photo capture. No photo leaves the device.
- Extract exactly nine crops and require explicit binder import.
- Verify the special Galarian Gallery artwork path by exact GG card ID.
- Check mobile Chromium, desktop Chromium, WebKit, and the public Pages site.
- Value two real matched 9.50 EUR cards as 19.00 EUR, not zero.

The live browser environment had no camera device, so physical recognition
accuracy remains a separate real-device acceptance test.
