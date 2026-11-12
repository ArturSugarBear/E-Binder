# E-Binder — Mobile UX und Beta-Readiness

**Datum:** 12.11.2026. **Baseline:** master c0f2c5a5beb1279eaee0fa231cf8def4a99f8c90.

## Abgleich mit HoloGem und Collectr

Diese Bewertung stützt sich auf die am 10.11. selbst dokumentierten Vergleichsvideos und -Screenshots im Projekt, die eigene Rare-Room-V2-Galerie sowie den Stand der UI- und e2e-Tests. **Keine** neue echte iPhone-Kamera-Sitzung und kein vollständiges manuelles Produktions-App-Audit wurden durchgeführt.

| Aspekt | Beobachtung und Priorität |
| --- | --- |
| Hauptnavigation | Fünfer-Dock mit Home, Entdecken, Scan, Sammlung, Profil ist vorhanden und entspricht dem klaren, erreichbaren Scanner-Einstieg von HoloGem. Scanner bleibt eine Handlung, keine zweite aktive Route. |
| Einhand-Ergonomie | Hauptaktion zentral/unten ist sinnvoll; das 320–430-px-Verhalten muss mit Safe Area, kurzer Höhe, großer Systemschrift, einhändigem Daumen und sichtbarem Review-CTA immer wieder geprüft werden. Noch kein physischer Daumenreichweiten-Benchmark. |
| Kamera und Scan-Warteschlange | P07/P09 bieten kontinuierliche Kamera, lokale Hintergrund-OCR, feste Orientierung und bis zu 24 offene Aufnahmen. Gegen HoloGem ist die wahrgenommene Einfachheit beim Weiterblättern und Korrigieren entscheidend, nicht das bloße Vorhandensein von Animationen. |
| Review/Bestätigung | Positiv: E-Binder schützt vor unbestätigtem Besitz und Edition-Verwechslung. Risiko: Zusätzliche Korrektur-/Dialogschritte können gegenüber der HoloGem-Review-Warteschlange sperrig wirken; echte Nutzer brauchen wiederholte Zeitmessungen. |
| Katalog und Sammlung | Collectr zeigt ein kompakt sortierbares Kartenraster, Einkaufs-/Preisinfos und klare Filter. E-Binder muss Bildsprache, Preisquelle und exakte Ausgabe konsistent halten; die Bedienung darf nicht auf Preisangaben reduziert werden. |
| Visuelle Ebenen | Rare-Room-Farben, Schrift und Logo beibehalten; Liquid-Glass auf Navigation/Sheets, ruhige Karteninhalte. Potenzielle Risiken bei kurzen iPhone-Höhen: Dock über Inhalt, Scrollbereich unter Schließen/Review, Scanner-Status plus Tastatur. |
| Onboarding | Der direkte kostenlose Einstieg ist ein Vorteil; kurze Folge „Aufnehmen → Prüfen → Bestätigen“ ohne Pflicht-Abo oder Personalisierungsdialog behalten. |
| Datenschutz und Beta | Die bestehende Entwickler-Telemetrie erfasst keine Bilder. Neuer freiwilliger Foto-Kanal braucht getrennte Consent-, Storage-, Lösch- und Dataset-Gates. |

## Nachweise

- Aktuelle Master-CI vom 12.11.2026: 283/283 Unit-Tests; 356/375 Browserfälle bestanden, 19 ausdrücklich übersprungen, 0 fehlschlagende; erfolgreiches Pages-Deployment.
- Historische mobile Screenshots: Home 320/390/1440, Profil 390, Sammlung 320/390/430, Scanner 320.
- HoloGem und Collectr: vorhandene Benchmark-Medien unter docs/benchmarks/competitors/2026-11-10. Nicht als E-Binder-Marketingbilder verwenden.
- Ein visueller No-Overlap-Benchmark auf echten Geräten bleibt offen; automatisierte Viewportkontrollen sind ergänzend, kein Nachweis für Griffhaltung, Netzqualität und Kamera-Verhalten.

## Nächste P0-Abnahmen

1. Einhändige Scan→Review→Bestätigung nach maximal wenig Richtungswechseln, ohne verdeckte Controls oder doppelte Dialoge.
2. Null falsche 1st-Edition-Übernahmen, null unbestätigter Besitz und klare Offline-/Kamera-Fallbacks.
3. Test mit 5–20 Konten, echtem Consent-Widerruf und Storage-Isolation, inklusive Löschung beider Datenanteile.
4. Verifizierte DE/EN/JA-Fotos und unabhängig geprüfte Labels als Grundlage für Modell-A/B.
5. Nutzersichere Dokumentation, aktuelle Screenshots und eine verständliche Beta-Einstiegsseite.
