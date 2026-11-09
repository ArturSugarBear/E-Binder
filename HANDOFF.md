# Übergabe: E-Binder

Aktueller Zwischenstand: Die Metadaten-Umstellung ist im Code vollständig integriert. IndexedDB v2 und Exporte speichern keine Bilder; Aufnahme-Bytes existieren nur als temporäre Map im Add-Dialog. `metadataOnlyState` entfernt lokale Fotoverweise vor Persistenz. Supabase-Migration `20261109123051_metadata_only_cloud` angewendet: Storagepolicies deaktiviert, Cloudconstraints gegen Fotoverweise/Inlinebilder, tatsächliche Bildobjekte=0. RLS-/Metadaten-Constraints erneut geprüft. PostgreSQL-TOAST-Kompression=pglz. `npm run check` vor letzten reinen Copy-/Dokumentationsänderungen grün; neue Metadaten-Browsertests unter Chromium/Mobile bereits grün, WebKit läuft. Anschließend check + Masterpush/Actions/Live finalisieren. Die nachfolgenden älteren Detailnotizen können inzwischen erledigte Punkte enthalten.

Stand 9. November 2026. Nutzer verlangt einen sofort remote gesicherten Arbeitsstand und die fertige Version auf `master`/GitHub Pages. Repository: https://github.com/ArturSugarBear/E-Binder. Arbeitskopie `/workspace/E-Binder`. GitHub CLI: `gh-e-binder`, bestehende Autorisierung verwenden, keine Login-Schleifen/Force-Pushes.

## Veröffentlicht / gesichert

- Zuletzt vollständig veröffentlichte Scan-Reparatur: `7315971` (Master, Live).
- Supabase, Set-/Artistbrowser, DE/EN/JA, geprüfte EN-Bildfallbacks, Checkboxfehler, Cyan-Palette und Sortierbreite sind auf `master` gesichert: `d2e10dd`, Testselektoren korrigiert in `a050d83`.
- `npm run check`: 55 Tests + Format/Lint/Build bestanden. Echte Supabase-API-Prüfung mit zwei temporären Konten: Isolation, Schreiben, Freigabe/Widerruf, Versionskonflikte bestanden. Echter UI-Test: Registrierung, Bestand, Binderfreigabe und Laden in zweitem frischen Browser bestanden.
- Letzter Publish-Lauf `42616043731` wurde wegen der nachfolgenden Nutzeränderung bewusst abgebrochen; Live zeigt ggf. noch `7315971`. Niemals behaupten, der neue Stand sei bereits live, bevor Action und echte Seite geprüft sind.

## Neueste verbindliche Nutzeranforderung

**Fotos sind ausschließlich temporäre Eingaben zum schnellen Erfassen physischer Karten. Keine Fotobytes in Supabase, IndexedDB oder Exporten.** Danach Katalogbild verwenden; nur bestätigte Ausgabe, Sprache, Variante, Menge und weitere Textmetadaten speichern. Frühere Wünsche zur Originalfoto-Sicherung sind überholt.

Aktuell laufende Umstellung:

- `src/ui/add-cards.ts`: temporäre Map pro Dialog, Bilder über Object-URLs nur während Erkennung, Abbruch/Zuordnung/Schließen verwerfen Bytes. `store.photo`/`putPhoto` aus Erfassung entfernt. Bestehende Erfassungsmetadaten dürfen ohne Bild wieder geöffnet werden; neue Aufnahme ist für erneute OCR nötig.
- `src/data/cloud-store.ts`: Upload/Download von Bildern entfernt. Soll `metadataOnlyState` aus `domain/personal.ts` nutzen.
- Parallelbeitrag `catalogue_complete`: `PersonalStore` auf IndexedDB v2 mit ausschließlich `states` (alten `photos`-Store beim Upgrade löschen), Schema/Helper `metadataOnlyState` mit Entfernen aller `photoId`, nur Metadaten-JSONL, Legacy-Fotozeilen ignorieren, Backupdialog/Units anpassen. Prüfen, ob bereits fertig integriert.
- Root hat `WorkspaceContext.restore(state)`, Accountimport ohne Fotomap, `CardImages` nur Katalogbilder angepasst. Typecheck/Tests nach vollständiger Integration erneut ausführen.
- Noch offene E2E-Tests erwarten teilweise Originalfoto-Persistenz/Export. Diese auf neues Verhalten ändern: kein Foto im Export/IndexedDB, Erfassungsmetadaten bleiben, Foto nach Schließen/Reload nicht verfügbar, Besitz unverändert.
- README, docs/backend.md, docs/architecture.md, docs/implementation.md enthalten noch überholte Originalfoto-/Cloudfoto-Aussagen und müssen angepasst werden.

## Supabase

Projekt `hmgydjfkvehvdwvdftca`, Frankfurt, bereits verbunden. URL + öffentlicher Publishable Key in `cloud.config.json`, echte privilegierte Schlüssel ausschließlich Supabase-Runtime. GitHub-Connector darf keine Repository-Secrets setzen (403); öffentlicher Clientconfig-Fallback ist bewusst verwendet. Kein Service-Role-Key im Repo.

Migrationen erste drei tatsächlich angewendet und Dateinamen mit Serverhistory abgestimmt. Neue `metadata_only_cloud`-Migration deaktiviert die vier alten Storage-Policies und verbietet `photoId` und Inline-Image-Daten im Cloudzustand. Ein erster Versuch, den leeren Bucket per SQL zu löschen, wurde korrekt von Storage abgelehnt und vollständig zurückgerollt; nicht umgehen. Neuer Versuch lässt den leeren Bucket ohne Zugriffsregeln bestehen. Vor wenigen Minuten waren **0 Bilder** im Bucket. Anwendungsseitig niemals wieder Uploadcode ergänzen.

Nach Migrationen `get_advisors(type:security)` sowie tatsächliche Query/Isolation prüfen. `supabase/tests/isolation.sql` läuft mit Rollback, keine echten Nutzerdaten. Neue Migrationsdateien über `npx -y supabase@3.0.0 migration new NAME`; Tool `apply_migration` erzeugt remote eigene Versionsnummer, Dateinamen anschließend an tatsächlich gelistete History angleichen.

Es existiert noch ein temporärer UI-Fixtureaccount. Private Zugangsdaten nur außerhalb Repo: `/workspace/scratch/e-binder-cloud-session.json` (nicht ausgeben/committen). UI-Smoketest zum Wiederverwenden: `CLOUD_TEST_REUSE=... E2E_BASE_URL=... node scripts/smoke-cloud.mjs`. Vor Löschen nur dieses Testkonto global abmelden und dessen exakte ID mit zusätzlich geprüftem `test_ui_...@users.e-binder.invalid`-Alias administrativ entfernen. Zwei frühere API-Fixturekonten und ihr Testfoto bereits entfernt.

## Tests, Push und Live

- `npm run check` nach der Umstellung, dann passende Playwright-Tests und vollständige CI.
- Chromium: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.
- Lokal WebKit vorhanden; bei ausschließlich falscher System-Preflightprüfung `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` (Browser muss tatsächlich laufen). CI installiert echte Browserlibs normal.
- Keine konkurrierenden Builds während Browserläufen (kurzzeitig 404), keine konkurrierenden Tests mit derselben `test-results`-Ausgabe. Separate Outputs wenn nötig.
- Arbeitsstand jetzt zusätzlich `codex/workspace-update`; fertige getestete Änderungen weiterhin nach `master` pushen. Actions und Live prüfen. Kein Force-Push.
- Nutzer verlangt Restkontingent-Anzeige: ChatGPT-Quota ist hier nicht auslesbar. Keine Zahl schätzen; klar mitteilen, was lokal, auf Master und live ist.

## Collectr und Scanning

REA und Ponytail Originalskills wurden gelesen/angewendet; Impeccable Original für Palette genutzt. REA fordert bei unabhängigen Fragen explizit parallele Worker. Öffentliche Setnavigation mit REA tatsächlich beobachtet und als Set-/Filterworkflow umgesetzt; siehe docs/research/collectr.md.

Neue Scan-Untersuchung nur in `/workspace/scratch/collectr-rea/scan-findings.md`, keine erfundene native Architektur. Richtige App: iOS 1603892248 / Android com.collectrinc.collectr. Website zeigt Live-Framing → automatisches Matching → Review. Keine Scanbibliothek, kein Modell, kein Anbieter und kein Client-/Server-Split belegt. Ximilar-Vergleich erwähnt Collectr, belegt aber keine Kundenbeziehung.

Unser belegt schwacher Punkt: Recognition-only PP-OCRv4 mit festen Textstreifen nach manuellem Ausrichten; automatische Karten-/Textlokalisierung und visuelle Katalogsuche fehlen. Nicht blind Modell ersetzen oder perfekte Erkennung versprechen. Originalfotos der Fehlversuche fehlen weiterhin. Nutzergerät: iPhone 13 Pro Max, Chrome und Safari. Kleinster Vergleich: dieselben echten Fotos/korrekte Ausgaben mit bestehender Ausrichtung und isoliertem Lokalisierungsprototyp prüfen; neue unbekannte Ausgaben/JA/Reprints einbeziehen. Kompakte Merkmale/Hashes/Embeddings als Metadatenindex sind eine nächste Hypothese, noch kein implementierter Erkennungsnachweis. Keine Bilder in Supabase als vermeintlichen Index hochladen.
