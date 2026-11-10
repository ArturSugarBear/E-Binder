# Integrationsstand · 10. November 2026

Die ZIP wurde im Repository-Root entpackt. Die sechs Videos, sechs Original-Screenshots und sechs Kontaktbögen liegen physisch in diesem Verzeichnis. Das unveränderte Originalmanifest ergibt **18/18 erfolgreich geprüfte Medien**. Die vollständige [Analyse mit Inventar, Zeitbereichen und Übernahmeentscheidungen](ANALYSIS.md) ersetzt den vorherigen blockierten Übergabestand.

## Verbindliche Produktgrenzen

Die Produktionsidentität steht in [docs/design.md](../../../design.md) und der unverändert erhaltenen [Rare-Room-V2-Quelle](../../../../public/E-Binder_Brand-Lab_v2.html). Das ältere `brand/BRAND-KIT.md` beschreibt frühere Alternativen; seine Auswahltexte und V1-Werte ersetzen den V2-Vertrag nicht. Originales Zeichen „Die Lücke“, native Systemschriften und V2-Farbrollen erhalten: Vault `#141519`, Bone `#F4F1EA`, Holo-Lime `#D8F25A`, Foil `#B9A6FF`.

Der Binder bleibt der zentrale Produktnutzen: physische 3×3-Taschenpositionen, unveränderte Kartenbilder, exakte Ausgabe und ausdrücklich bestätigter Besitz. Fremde Medien liegen ausschließlich unter `docs`, werden nicht aus `src` importiert und liegen weder in `public` noch im PWA-Build. Die private Binder-Fotodatenbank ist nicht Teil dieses Imports.

## Integrationsgrenzen der offenen PRs

Metadaten, Diffs und CI-Protokolle wurden geprüft. Das ist keine Browserfreigabe der beiden anderen PRs. Beide Heads sind weiterhin offen und wurden nicht gemergt.

| PR / geprüfter Head                                                                                   | Zuständigkeit                                                                                       | Stand und Konsequenz für #39                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#37](https://github.com/ArturSugarBear/E-Binder/pull/37), `c761a82350f64cae55392d952e1ccdeb5a458e65` | Fünf Hauptaktionen, Home/Profil, Binder/Karten/Portfolio-Unteransichten, Onboarding und Glass-Shell | [CI 42846734087](https://github.com/ArturSugarBear/E-Binder/actions/runs/42846734087): 25 fehlgeschlagene, 215 erfolgreiche, 15 übersprungene Browserfälle. Unter anderem unterschreitet der inaktive Dock-Text über einem Lime-Hintergrund mit gemeldeten 3,66:1 den erwarteten Kontrast. Weitere Fehler betreffen Navigation und Scanner-Testeinstiege. Keine zweite Shell in #39 implementiert; vor Zusammenführung Fehler gegen aktuellen Head auflösen und Browserprüfungen erneut ausführen. |
| [#38](https://github.com/ArturSugarBear/E-Binder/pull/38), `739f589f66ad4e159353bb76a1132ff9fe57a02c` | Verifiziertes Kartenartwork und sichere Set-Fallbacks                                               | [CI 42847372896](https://github.com/ArturSugarBear/E-Binder/actions/runs/42847372896): `catalog-images.spec.ts:91` erwartet eine kompakte Höhe `<130px`, erhält ca. `223px`, in Chromium, mobilem Chromium und WebKit. Vor Integration Kompaktliste und kartenförmigen Fallback konsistent machen. Keine Bilder aus Referenzmedien übernehmen.                                                                                                                                                     |
| [#39](https://github.com/ArturSugarBear/E-Binder/pull/39)                                             | Medienbibliothek, Benchmark und Scanner-/Review-Übertragung                                         | Baut auf `master` auf und verändert keine Dateien der Katalogbildlogik aus #38. Kleine Ergänzung im Aufruf von `openLiveScanner` in `add-cards.ts` und neue Scanner-Styles müssen später gemeinsam mit #37 geprüft werden; dessen Änderungen an derselben Datei/CSS-Datei werden nicht als bereits integriert ausgegeben.                                                                                                                                                                          |

Die allgemeine Veröffentlichungsvorgabe in `AGENTS.md` wird hier durch die ausdrückliche Aufgabenbegrenzung auf PR #39 und „keine ungeprüften Merges“ begrenzt. Kein Push auf `master`, keine Veröffentlichung und kein Merge dieser PRs.

## In #39 umgesetztes Verhalten

Quelle: HoloGem `02-scan-experience.mp4`, ca. 13–36 s (sichtbare offene Warteschlange und Review-Einstieg); Collectr `03-scanning-and-portfolio.mp4`, ca. 91–107 s (getrennte Match-Prüfung und Bestätigung).

- `live-scan.ts` zeigt im bestehenden Footer die tatsächlichen offenen Erfassungen und **Ergebnisse prüfen (N)**. Beides bleibt während des nächsten Kameralaufs und bei verweigerter Kamera erreichbar.
- Der Kamerastatus steht im festen Footer, damit er bei schmalen Displays nicht hinter den Prüfaktionen verschwindet.
- Der Status unterscheidet verarbeitete Aufnahme von bestätigter Kartenausgabe. Kurze Hinweise zu Reflexion und Licht ergänzen die Ausrichtungshilfe.
- `add-cards.ts` liefert den Zähler aus dem vorhandenen Erfassungszustand. Besitzbestätigung, Mengen, Ausgabeprüfung, temporäre Fotos und Datenmodell werden weiterhin vom vorhandenen Workflow bestimmt.
- Die gemeinsame Standard-Buttonhöhe beträgt 44 statt 42px; der Review-Zugang prüft Mindesthöhe und -breite im Browser. Spezifische bestehende Varianten bleiben separat zu prüfen.
- Der Medienprüfer läuft zusätzlich als eigener CI-Schritt nach `npm run check`. Die Originalmedien werden weder umkodiert noch umbenannt.

Die übrigen Benchmark-Entscheidungen sind in der Analyse ausdrücklich als vorhandenes Verhalten, Arbeit in #37/#38 oder noch ungeprüfter Vorschlag markiert. Keine weitere Setfortschritts-/Kursdatenbasis wird vorgetäuscht.

## Prüfungen

- `node scripts/verify-competitor-media.mjs`: **18/18**, Größen und SHA-256 stimmen.
- `ffprobe`: sechs H.264-Videos, 512×1106, 24 fps, keine Audiospur; alle importierten Zeitbereiche decodiert und anhand zusätzlicher Frames untersucht.
- `npm run check`: erfolgreich, 24 Unit-Testdateien / 130 Tests, Formatierung, Lint, Datenprüfung, TypeScript, Build und PWA-Prüfung.
- Vollständige lokale Regression nach der 44px-Korrektur: 234 erfolgreich / 15 ausdrücklich übersprungen. Anschließend wurde der Kamerastatus in den Footer verlegt und der Scanner-/Review-Teil auf dem endgültigen Build erneut geprüft; Ergebnisse siehe unten.
- Endgültiger Scanner-/Review-Lauf: **24 erfolgreich / 3 übersprungen** in Chromium, mobilem Chromium und WebKit. Die drei ausgelassenen WebKit-Fälle benötigen den Chromium-spezifischen Canvas-MediaStream-Simulator; Kamerafallback, Review-Zugang, Fokus, 44px-Ziel, nicht verdeckter Kamerastatus und Foto-Prüfung wurden auch in WebKit ausgeführt.
- Visuelle/axe-Prüfung des endgültigen Footerlayouts: Chromium und WebKit bei 320×844 und 390×844, reduzierte Bewegung, zwei offene Erfassungen und verweigerte Kamera. Review-Ziel jeweils 44px hoch, kein horizontaler Überlauf, Kamerastatus sichtbar, keine axe-Befunde. [Chromium 320](../../../screenshots/competitor-followup/scan-review-chromium-320.png) / [WebKit 390](../../../screenshots/competitor-followup/scan-review-webkit-390.png).
- Die WebKit-Laufzeitbibliotheken wurden aus den konfigurierten Debian-Paketen in Benutzerverzeichnissen bereitgestellt; die Tests starteten echte Browserprozesse. Die Prüfung des systemweiten Bibliothekscaches wurde lokal deaktiviert, weil dieser die lokalen Bibliotheken nicht erfasst. Die CI nutzt weiterhin die normale Playwright-Installation mit Systemabhängigkeiten.

Browser-Kamerasimulationen und OCR-Stubs prüfen Zustände, Warteschlange und freigegebene Tracks. Sie messen keine echte Erkennungsgenauigkeit und ersetzen keinen physischen iPhone-Kameratest. Eine spätere gemeinsame Version mit #37/#38 braucht ihre eigene Prüfung; grüne Checks von #39 würden diese nicht automatisch freigeben.
