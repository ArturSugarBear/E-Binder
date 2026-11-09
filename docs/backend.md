# Supabase: implementierter Stand

9. November 2026. Zielgruppe: kleine Testrunde mit 3–8 Freunden; Registrierung derzeit auf 16 Konten begrenzt. Frontend bleibt native TypeScript/Vite-SPA auf GitHub Pages. Ein Frameworkwechsel war für die vorhandenen Abläufe nicht nötig.

## Was tatsächlich verbunden ist

- Nutzername und Passwort ohne Abfrage einer echten E-Mail-Adresse. Supabase Auth verwaltet Passwort und Sitzung; intern wird der kanonische Name als reservierte `@users.e-binder.invalid`-Adresse verwendet. Das ist eine Anwendungszuordnung, kein nativer Supabase-Username-Provider.
- `register` ist eine bereitgestellte Edge Function. Sie validiert Eingaben, begrenzt Anmeldeversuche und nutzt den privilegierten Schlüssel nur serverseitig. Der private Profiltrigger akzeptiert ausschließlich administrative Konten mit vertrauenswürdigen App-Metadaten. Direkte anonyme Auth-Registrierung kann diese Markierung nicht setzen. Der Trigger läuft nach Abschluss der Auth-Metadatenänderung derselben Transaktion.
- Anmeldung, Abmeldung, manuelle Synchronisierung, Konto-Wiederaufruf und bewusste Übernahme eines bisherigen Gastbestands. Kein automatisches Vermischen von Demo, Gast und Konten.
- „Binder teilen“ veröffentlicht einzelne Layouts über `#geteilt/<UUID>`. Besucher sehen Kartenplätze, keine privaten Bestandsmengen, Originalfotos oder Notizen. Widerruf entzieht den Zugriff auf denselben Link.

## Datenhaltung und Zugriff

`profiles`, `binders` und `binder_cards` folgen dem Briefing und haben RLS. Öffentliche Profile enthalten nur Nutzername, optionale Avataradresse und Erstellungsdatum. Binder sind öffentlich lesbar, wenn ihre Freigabe gesetzt ist; schreiben darf ausschließlich ihr Eigentümer. Karten prüfen die Elternzuordnung. Slot-Eindeutigkeit, Rastergrenzen und Zeitstempel werden serverseitig geprüft.

`user_workspaces` enthält zusätzlich den privaten vollständigen Zustand, damit bestätigte Mengen, Varianten, Wünsche, Reservierungen und offene Erkennungsergebnisse beim Gerätewechsel erhalten bleiben. `save_workspace` prüft die erwartete Serverversion und aktualisiert diesen Zustand zusammen mit den relationalen Binderansichten in einer Transaktion. Der Funktionsaufruf läuft als Benutzer unter RLS, ohne privilegierte Umgehung. Layouts erzeugen keinen Besitz.

Die Schema-Vorgabe hat `binders.is_public = true` als SQL-Default. Der App-Import übergibt ausdrücklich `false`, bis der Nutzer einen Binder freigibt; bestehende lokale Binder werden durch die Anmeldung nicht pauschal veröffentlicht.

Supabase speichert ausschließlich Textmetadaten. Es werden keine Fotos, Bilddateien oder Base64-Kartenbilder hochgeladen. Der leere frühere `originals`-Bucket ist ohne Benutzer-Policies deaktiviert; es liegen null Bilder darin. Datenbank-Constraints verbieten Fotoverweise und Inline-Image-Daten. Offizielle Motive werden direkt von externen Katalog-URLs dargestellt. Pro privatem JSON-Zustand gelten 10 MB und die normalen Projektquoten. PostgreSQL komprimiert größere JSONB-Werte automatisch über TOAST; im Projekt ist `pglz` konfiguriert. JSONL ist das portable Text-Exportformat, keine separate Binärbilddatenbank.

Aufnahmen existieren nur vorübergehend im geöffneten Erkennungsdialog und werden bei Zuordnung/Schließen freigegeben. IndexedDB v2 enthält nur Zustandsmetadaten und entfernt den alten Foto-Objektspeicher beim Upgrade. Exporte enthalten keine Foto-Records oder lokalen Fotoverweise. Alte Backups können als Metadaten übernommen werden; enthaltene Bildbytes werden ohne Decodierung verworfen. Ein erneuter Scan nach dem Schließen verlangt eine neue Aufnahme, nicht die Wiederherstellung eines alten Fotos.

IndexedDB hält getrennte Kontencaches. Nach Änderungen wird zuerst lokal gespeichert. Nicht synchronisierte Änderungen bleiben exportierbar. Unterschiedliche Serverversionen erzeugen einen sichtbaren Konflikt; ein fremder neuer Stand wird nicht still überschrieben. „Cloudstand laden“ verlangt eine ausdrückliche Auswahl zum Ersetzen der lokalen Kontoänderungen. Es gibt noch kein automatisches Zusammenführen konkurrierender Bearbeitungen. Ein Kontowechsel leert die vorherige Ansicht und startet den Arbeitsbereich neu.

## Einrichtung für einen eigenen Fork

1. Eigenes Supabase-Projekt erstellen. Migrationen unter `supabase/migrations/` anwenden; diese Dateien wurden mit `supabase migration new` erzeugt und auf die tatsächlich angewendeten Versionsnummern abgestimmt.
2. `supabase/functions/register/index.ts` bereitstellen, `verify_jwt=false`; `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden im Supabase-Runtime-Kontext bereitgestellt. Erlaubte Frontend-Origins in der Funktion an das eigene Deployment anpassen.
3. Öffentliche URL und Publishable Key über `.env.local`/Buildvariablen setzen oder `cloud.config.json` anpassen. Niemals einen Service-Role-/Secret-Key in VITE-Variablen schreiben. `cloud.config.json` ist öffentlich und enthält keine privilegierten Zugangsdaten.
4. GitHub Pages aus dem geprüften Actions-Build auf `master` veröffentlichen. `keep-alive.yml` verwendet dieselbe Konfiguration; dessen bloße Existenz garantiert keine dauerhafte Erreichbarkeit.

Ohne echte E-Mail gibt es keinen automatischen Mail-Passwortreset. Passwortänderung/-wiederherstellung außerhalb einer vorhandenen Sitzung ist derzeit eine Aufgabe des Betreibers mit eigener Identitätsprüfung. Das ist eine bekannte Grenze der kleinen Testrunde.

## Tatsächlich ausgeführte Prüfungen

- Zwei über die bereitgestellte Funktion angelegte Testkonten: Anmeldung, privates Speichern, Unsichtbarkeit fremder Bestände, blockierte Fremdänderung und Eigentümerwechsel, öffentliche Projektion ohne Originalfoto/Privatnotiz, Widerruf, blockierter veralteter Speicherstand und privater Storagezugriff in der früheren Foto-Sync-Version. Ergebnis: bestanden. Dieser Bildspeicher wurde anschließend auf Nutzerwunsch deaktiviert. Diese beiden Fixtures und ihr Testfoto wurden anschließend entfernt.
- Durch die gebaute Oberfläche: Registrierung, Karte bestätigen, Binder belegen/freigeben, anonymer Aufruf des Links und derselbe Bestand in einem zweiten frischen Browser. Ergebnis: bestanden. Kein Test mit echten Nutzerdaten.
- `supabase/tests/isolation.sql`: wiederholbare RLS- und Konfliktprüfung in einer zurückgerollten Transaktion, bestanden.
- Metadaten-Umstellung: Datenbankprüfung lehnt Fotoverweise/Inline-Bilddaten ab, RLS-/Konflikttest erneut bestanden. Bildobjekte im Bucket: 0.
- Supabase Security Advisor nach den ersten Migrationen: keine Meldungen.
- `scripts/smoke-cloud.mjs` ist ein ausdrücklich gestarteter Integrationstest gegen ein echtes Projekt; er erzeugt einen temporären Testaccount. Er läuft nicht automatisch in CI. Sitzungsdateien dürfen nur außerhalb des öffentlichen Repositorys gespeichert werden; nur die dabei erzeugten Fixturekonten anschließend administrativ entfernen.

Nicht belegt: eine Nutzungsstudie, Passwort-Recovery durch Endnutzer, automatisches Konflikt-Merging oder Verfügbarkeit bei ausgeschöpften Projektquoten. Die Kartenerkennung bleibt ein separater, lokal ausgeführter und noch nicht mit den Originalfotos des Inhabers validierter Ablauf.

## Kompakte visuelle Merkmale als nächster Versuch

Ein künftiger gemeinsamer Index könnte Anbieter-ID, Set, Nummer, Sprache, Illustrator und versionierte visuelle Hashes/Vektoren als reine Metadaten enthalten. Ein solches Merkmal ist keine eindeutige Ausgabe-ID: Nachdrucke können dasselbe Motiv haben, und Druckvarianten können visuell ähnlich sein. Automatische Lokalisierung und Merkmalsabgleich müssen mit echten Fehlversuch-Fotos sowie unbekannten Ausgaben geprüft werden, bevor ein Erkennungsindex behauptet wird. Aktuell ist dieser visuelle Index **nicht implementiert**; Bilder werden dafür nicht vorsorglich in Supabase abgelegt.
