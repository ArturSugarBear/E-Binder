# E-Binder · Beta-Rollout (5–20 Testpersonen)

Stand: 12. November 2026. Ziel: echte Bedienungs- und Erkennungsdaten aus unterschiedlichen Geräten, Sprachen und Druckvarianten sammeln – ohne Nutzerfotos ungefragt zu veröffentlichen oder automatisch für ein Modelltraining zu verwenden.

## Freigabe-Gates

1. Build, Lint, Unit-Tests, Browsertests (Chromium, mobile Chromium und WebKit) müssen erfolgreich sein. Auf einem echten iPhone Safari zusätzlich Scannen, Review, kleine Displays, Safe Areas und Kameraablehnung prüfen.
2. Der neue private Storage-Bucket, Auth-Policies und die serverseitigen Consent-Daten müssen sicher eingerichtet sein. Alle Nutzer starten mit deaktivierter Foto-Teilnahme.
3. Testpersonen melden sich normal an. Unter Profil können sie die Foto-Teilnahme ausdrücklich aktivieren, wieder beenden und alle **eigenen** Bilder löschen. Die freiwillige Einwilligung ist keine Voraussetzung für ein Konto oder die normale App.
4. Artur-/Arthur-Dev kann als ausdrücklich autorisierter Owner-Pilot vorab eingeschaltet werden. Kein anderer Nutzer bekommt automatisch eine Einwilligung.
5. Eingehende JPEG-Kopien sind durch Neukodierung EXIF-frei, auf maximal 1,5 MB begrenzt, nur über Auth-geschütztes HTTPS erreichbar und nicht im Git-Repository enthalten.
6. Nach dem Label-/Qualitätsreview entstehen rechtmäßig freigegebene Datensätze. Nur ein messbar überlegenes Modell auf einer getrennten Hold-out-Menge darf als ONNX-Upgrade ausgerollt werden.

## Tester-Protokoll

- Drei Einzelkarten aufnehmen: je eine Deutsch/Englisch/Japanisch, davon eine Holo-/Reverse-Variante.
- Vollständigen Namen, Set, Sammlernummer und Sprache einer falschen OCR-Empfehlung bewusst korrigieren.
- Eine alte Nicht-1st-Edition-Karte aufnehmen; sie darf nie ungeprüft 1st Edition werden.
- Eine 3×3-Binderseite bei gutem Licht und eine schwierige Seite mit Reflexionen verwenden.
- Scan abbrechen oder Kamera verweigern und danach die Dateioption sowie den manuellen Einstieg testen.
- Mit einer Hand Home, Entdecken, Scan, Sammlung und Profil bedienen; Dialoge öffnen und schließen, ohne Inhalte unter dem Dock zu verlieren.
- 320, 375, 390 und 430 px, kurze und lange iPhone-Ansichten, große Systemschrift und reduzierte Bewegung testen.
- Offline neu öffnen und anschließend synchronisieren; ungeprüfte Karten dürfen nie als Besitz erscheinen.

Testbericht: Build, Gerät und OS, Route, Schritte, Erwartung, tatsächliches Verhalten, Schweregrad, optional ein **gesondert freigegebenes** Beispielbild. Private Fotos nie in ein öffentliches Issue kopieren.

## Datenschutzhinweis und operativer Go-live-Blocker

Die Fotospende ist unabhängig von bestehender, auf Entwicklerkonten begrenzter Ereignisdiagnostik. Für normale Nutzer gibt es keine Fotospende ohne aktiven Opt-in. Transportfehler dürfen weder Kamerascannen noch Bestandsänderung beeinflussen. Es werden keine GPS- oder EXIF-Metadaten, OCR-Freitexte oder Notizfelder übertragen.

**Vor der Öffnung für 5–20 Nutzer müssen** automatische Löschung abgelaufener Storage-Objekte, vollständige Lösch-/Auskunftsprozesse einschließlich bereits geprüfter Bilder, Datenschutzhinweise, Speicherfristen, Reviewer-Berechtigungen und ein praktischer RLS-Isolationstest fertig sein. Das Profil löscht alle noch im privaten Beta-Bucket gespeicherten Bilder des Kontos. Eine DB-Row-Löschung allein entfernt keine Storage-Datei. Ohne diese Freigaben darf der Foto-Opt-in nicht als rechtssicher abgeschlossen beworben werden.
