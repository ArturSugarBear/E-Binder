# E-Binder Quality Hub – gemeinsame QA, Agents und Tester

**Live-Zentrale:** https://e-binder-quality-hub.vercel.app
**Vercel-Projekt:** `e-binder-quality-hub` (separat vom Produkt-Hosting `e-binder`)
**Datenbank:** bestehendes Supabase-Projekt `E-Binder`, isolierte öffentliche Tabelle `public.qa_hub_observations`, **keine Änderungen** an Sammlungs-/Scan-Tabellen.

## Testfälle vs. Beobachtungen

Die Website enthält eine kuratierte Testfallbibliothek (P0–P3, DE/EN/JA, Scanner, Binder, Preise, Artwork usw.), einen lokalen Prüfverlauf und Live-Read-only-Abfragen zu GitHub Pages, `master`, Branches, PRs und Actions. Beobachtungen sind **append-only**, erhalten eindeutige IDs und einen Zeitstempel. Eine Beobachtung mit `status=reported` ist **kein** Nachweis einer reproduzierten Regression; `verified=false` bedeutet keine unabhängige Verifikation. Zum offiziellen Release-Gate gehört weiterhin die GitHub-CI und ein echter Smartphone-Test.

## Für ChatGPT und andere Agents mit verbundenem Supabase-Zugriff

1. Eintrag *nur* nach kontrollierter Analyse von CI, Screenshots oder echten Reproduktionsschritten ergänzen. Keine Erfolgsmeldungen erfinden.
2. Mit dem Supabase-Connector in Projekt `hmgydjfkvehvdwvdftca` in **`public.qa_hub_observations`** schreiben. Der Agent braucht dafür eine entsprechend berechtigte Verbindung; nur ein Publishable Key reicht **nicht** für privilegierte Agent-Schreibzugriffe.
3. Zunächst `test_id`, `title`, `category`, `priority`, `status`, `language`, `steps`, `expected`, `actual`, `notes`, `evidence_url` (öffentliche HTTPS-Adresse), `commit_sha`, `source='agent'`, `actor`, `verified` und `created_at` verwenden. Keine privaten Fotos oder Zugangsdaten.
4. `verified=true` **nur** wenn eine nachvollziehbare Prüfung tatsächlich ausgeführt und mit Belegen zu einem konkreten Build verknüpft ist. Ein CI-Build allein beweist keine iPhone-Kameragenauigkeit.

Beispiel für einen unbestätigten Agent-Fund (über eine **authentifizierte Admin-/Agent-Verbindung**, nicht als Browser-SQL):

```sql
insert into public.qa_hub_observations
(test_id,title,category,priority,status,language,steps,expected,actual,notes,evidence_url,commit_sha,source,actor,verified)
values
('SCAN-003','Japanische Mega-Lucario-ex-Karte prüfen','Kartenerkennung','P0','reported','JA',
 'Echtes japanisches Foto mit Set/Kartennummer testen',
 'Exakter Druck inklusive Mega und ex',
 'Aus Beta-Rückmeldungen als nicht erkannt gemeldet; auf neuer Version nicht geprüft',
 'Keine Behauptung einer aktuellen Regression',null,null,'agent','qa-agent',false);
```

Für beliebige CI-/CLI-Agents: einen **separat abgesicherten** Agent-Zugang über Supabase-Service-Verbindungen oder einen Backend-Endpunkt bereitstellen. Niemals einen Service-Role-Key oder ein Schreib-Token in Repository, Browser-Code, GitHub-Issues oder öffentliche Logs einfügen.

## Für Betatester

Lokal können alle Testfälle mit Sprache, Priorität, Ergebnis, Reproduktionsschritten, Notizen und Screenshots dokumentiert und als JSON exportiert werden. In der Cloud werden ausschließlich bewusst geteilte, **nicht private** QA-Textdaten erfasst; Screenshots und physische Sammelkarten-Aufnahmen bleiben bis zur gesonderten Einwilligung lokal. Status und Deploy-SHA immer mitdokumentieren.

## Sicherheit und Betrieb

Die Tabelle verwendet **RLS** und lässt öffentlich nur eine eingeschränkte, nicht-private Spaltenauswahl lesen. Authentifizierte Betatester dürfen eigene, unbestätigte Einträge anhängen; sie dürfen keine Agent-/CI-Einträge oder unabhängige Verifikation vortäuschen. Die E-Binder-Datensätze `profiles`, `binders`, `binder_cards`, `beta_scan_samples` und `beta_diagnostic_events` bleiben unberührt. Die App verändert über GitHub-API nichts im Repository.
