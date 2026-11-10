# Übergabe: Collector Premium und Bild-Fallbacks

Der Inhaber hat zuerst alle offenen PRs und eine Fehler-/Designprüfung beauftragt, danach ausdrücklich alle gefundenen Fehler, ein an HoloGem orientiertes hochwertiges Design, einfache Navigation, Liquid Glass, echte Scan-Fortschrittsanimationen und Bild-Fallbacks vor PR/Deployment. Zuletzt: **alles pushen, der nächste Chat setzt wegen Nutzungslimit fort**. Deshalb ist dies ein gesicherter Zwischenstand, keine abgeschlossene Produktionsfreigabe.

## Remote und Integration

Repository: ArturSugarBear/E-Binder, Ziel `master`, Pages https://artursugarbear.github.io/E-Binder/.

Beim letzten Abruf war #51 bereits extern auf master als `d4927c2` gemergt. #48, #47 und #15 noch offen. Reihenfolge bleibt #48 → #47 → #15; jeweils aktuellen Head und vollständige Checks prüfen. Andere Arbeit hat während dieser Sitzung mehrfach dieselben PR-Branches aktualisiert/umgeschrieben: **vor jeder Änderung fetch, keine alten Heads überschreiben, kein Force-Push auf master**.

Dieser Branch basiert auf einer lokalen Integration der ursprünglichen vier PR-Heads und enthält außerdem den späteren #51-Fix `2d660ba`. Der Konflikt in `workspace.ts` wurde so aufgelöst, dass geordnetes Speichern UND Beta-Fehlerereignisse erhalten bleiben. Formatkorrektur der Navigation wurde als `42f19f3` auf #51 gepusht. Ein neuer Portfolio-Regressionstest ist Commit `b8642e1`.

Nach Merge der verbliebenen Original-PRs den **neuen Premium-Implementierungscommit und b8642e1** gezielt auf aktuellen master übernehmen oder diesen Branch sauber integrieren. Nicht blind alte Integrations-Merges veröffentlichen. Neue Änderungen noch nicht deployed.

## Implementierter Zwischenstand

- Verifizierte Sekundärbilder: TCGdex bleibt primärer Katalog. PokémonTCG/pokemon-tcg-data liefert einen statischen pro-Set-Index mit englischen Bildern von images.pokemontcg.io / images.scrydex.com. Zuordnung nur über eindeutigen englischen Setnamen + gedruckte Kartenzahl, bekannte Base-Set-Ausnahme, dann exakte Sammlernummer. Keine Namens-/Motivähnlichkeit. Die Kartenidentität und Sprache bleiben unverändert; Artwork bekommt `Bild: EN`.
- Fehlende Bildmetadaten UND HTTP-Fehler führen zum Fallback. Setlogos und Symbole ebenfalls; wenn keine verifizierte Bildquelle existiert, neutraler eigener SVG-Set-Identifier statt erfundenem offiziellen Logo. Manuelle/Japanische Karten werden nicht auf englische Drucke gemappt.
- `npm run audit:artwork` erzeugt `public/catalog-art/index.json`, einzelne Set-Indizes, neutrale Set-Icons und `audit.json`. `.github/workflows/pages.yml` führt dies vor Check/Build aus und lädt den Report als Artifact hoch. Reale HTTP-Prüfung der Setgrafiken und Dateiprüfung aller 198 gebündelten Karten. **Kein vollständiger HTTP-Probe aller weltweit dynamisch suchbaren Karten**: deren HTTP-Ausfälle werden zur Laufzeit abgefangen. Der Audit-Bericht benennt diese Grenze ausdrücklich.
- Die erzeugten Dateien sind öffentliche Anbietermetadaten/URLs, keine persönlichen Karten/Fotos. 221 Set-Einträge untersucht; initial 169 gemappte Sets, die zusätzliche Base-Set-Ausnahme im letzten Lauf erhöht dies. Aktuelle Zahlen aus `public/catalog-art/audit.json`/`index.json` ableiten.
- Portfolio-Verlauf v2 signiert die tatsächlich bepreisten Drucke zusätzlich zum Bestand. Gleiche Anzahl bepreister Karten mit unterschiedlicher Abdeckung erzeugt keine falsche Wertsteigerung mehr. Alte v1-Beobachtungen werden nicht übernommen, weil ihre Abdeckung unbekannt ist.
- Geöffnete Portfolio-Binder bleiben beim Nachladen offen (vorgelagerter #51-Fix + neuer verzögerter Antworttest).
- Expliziter Modus „Karten suchen“ bleibt beim Nachladen ausgewählt (vorher sprang er zurück zu Sets).
- Gemeinsame `scan-progress.ts`: Aufnahme → Erkennen → Prüfen; echte abgeschlossene Fachanzahl bei 3×3; indeterminierte Aktivität ohne erfundene Prozente bei Einzelkarten; Reduced Motion. Bestehende Motion- und Liquid-Glass-Bibliotheken bleiben erhalten.
- Home zeigt echte lokale Inspirationskarten, kompaktere Schritte, weniger redundante Container/CTA. Portfolio-Leerzustand entfernt leere Statistik-/Verlaufssektionen. iOS-Installationshilfe ist aufklappbar; mobile Marke kompakter. Gemeinsame SVG-Pfeile ersetzen auf Linux fehlende Unicode-Glyphen. Dunklere Tönung über Liquid Glass verbessert die Navigation auf hellen Motiven.

## Verifikation (präzise Grenzen)

- 149 Unit-Tests in 31 Dateien bestanden, ESLint und Formatcheck bestanden. Danach wurde ein fehlendes optionales TypeScript-Feld `SetArt.placeholder` ergänzt; der darauffolgende vollständige Produktionsbuild einschließlich PWA-Validierung bestand.
- Vor der Premium-Änderung: großer lokaler Chromium/mobile-Lauf 204 bestanden, 7 ausgelassen, 3 Fehler. Einer war der inzwischen behobene Modus-Race; zwei Katalog-/Preisfälle müssen im abschließenden Gesamtlauf erneut geprüft werden.
- Premium-Fokuslauf: 28 bestanden, 2 mobile neue Bildtests scheiterten am Lazy-Load ohne Scroll. Die Tests scrollen jetzt wie Nutzer zum Bild. Im darauf folgenden mobilen Lauf bestanden bereits alle 5 Bildtests einschließlich HTTP-Fallback, außerdem Home/Vault/Profil, Liquid Glass und Scan-Moduswechsel; der Lauf war beim Sichern noch nicht vollständig abgeschlossen. Desktop-Bildtests bestanden zuvor.
- Lokales WebKit wurde tatsächlich versucht, kann aber wegen fehlender Systembibliotheken nicht starten (kein sudo/Package-Helper vorhanden). GitHub Actions installiert WebKit inklusive Abhängigkeiten. Keine Tests oder Deployment-Gates wurden deaktiviert.
- Keine Behauptung einer besseren Erkennungsquote, echten iPhone-Performance oder „besser als HoloGem“ ohne weitere Validierung. Die HoloGem-Originale und frühere Benchmarkanalyse unter docs/benchmarks/competitors/2026-11-10 wurden als Referenz genutzt. Bilder/Kontaktbögen wurden gesehen, nicht die gesamte Videointeraktion neu gemessen.

## Nächste Schritte

1. Remote/PR-Zustände neu abrufen; offene Original-PRs in Reihenfolge nach grünen Checks mergen. Aktuell waren #47/#15 komplett grün, #48 vollständige Browserprüfung noch aktiv.
2. Premium-Branch mit aktuellem master integrieren, `npm ci`, `npm run audit:artwork`, `npm run check`, vollständiges `npm run test:e2e` (Chromium, mobile Chromium, WebKit) ausführen. Browserreports auf neue Fehlzustände prüfen, keine Behauptungen nur aus Testanzahlen.
3. Neue Leerzustände auf 320/390/1440 px einschließlich Installationsbanner, Tastatur, Reduced Motion und Dialog-Fokus visuell finalisieren. Prüfen, ob Layout/Lesbarkeit wirklich HoloGem-Niveau erreicht: das ist noch kein abgeschlossener Design-Abnahmeschritt.
4. Scan-Animationen mit langsamer/stornierter/fehlerhafter echter OCR prüfen; aktuell hängen Animationen am echten Status, aber Einzelkarten-Kamera und OCR können verschachtelte Dialoge erzeugen. Profil-Navigation hat noch keinen eigenen aria-current-Zustand; ein bewegter Navigationsindikator war nur angedacht, nicht implementiert.
5. Bild-Audit robuster machen: Status/Quelle pro Set sind verfügbar, dynamische Karten nicht alle vorab HTTP-geprüft. Für eine wirklich exhaustive Kartenprüfung gezielte Testliste bzw. klar begrenzten vollständigen Job definieren; nicht verdeckt zehntausende Downloads im normalen PR-Job starten. Retrys/Quellenausfälle und Lizenz-/Quellenhinweis final kontrollieren. Automatisch generierte neutrale Set-Symbole sind keine offiziellen Logos.
6. Nach vollständiger Freigabe auf master veröffentlichen, GitHub Actions und **tatsächlich ausgelieferte Pages-Version** samt neuer catalog-art-Dateien prüfen. README/Design-/Verifikationsdokumente auf den finalen Stand bringen.

Die Arbeitsumgebung dieser Sitzung war `/workspace/E-Binder`; Laufprotokolle `/tmp/e-binder-*`, Screenshots `/workspace/artifacts/e-binder/`. Diese lokalen Dateien sind nicht für einen neuen Chat garantiert; maßgeblich sind Git und neue CI-Artefakte.
