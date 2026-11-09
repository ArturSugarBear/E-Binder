# Build und GitHub Pages

## Zielkonfiguration

Repository `ArturSugarBear/E-Binder`, Produktionszweig `master`, Pages-Quelle **GitHub Actions**, Adresse `https://artursugarbear.github.io/E-Binder/`. Der Vite-Basispfad ist standardmäßig `/E-Binder/`, über `VITE_BASE_PATH` überschreibbar. Bei einer späteren eigenen Domain muss der Basispfad angepasst und getestet werden.

Der Workflow führt `npm ci`, `npm run check` und die Playwright-Suite gegen den fertigen Produktionsbuild aus. Erst danach wird derselbe `dist/`-Ordner als Pages-Artefakt hochgeladen und veröffentlicht. Pull Requests führen ausschließlich Prüfungen durch. Fehlgeschlagene Browser-Tests speichern Bericht, Screenshot und Trace für sieben Tage.

Der Check-Job besitzt nur Lesezugriff auf Repository-Inhalte. Nur der Deploy-Job erhält `pages: write` und `id-token: write`. Die Webapp und das Repository benötigen keinen persönlichen GitHub-Token für laufende Deployments.

## Erstmalige Umstellung

1. Den Migrationsstand einschließlich Workflow auf einem Arbeitszweig sichern.
2. Die erforderlichen Prüfungen abschließen.
3. Pages von Branch-Veröffentlichung auf GitHub Actions umstellen.
4. Den geprüften Stand auf `master` übernehmen.
5. Den erfolgreichen Workflow und die öffentliche Seite prüfen.

Ein OAuth-Token, der Workflow-Dateien erstmals schreibt, benötigt bei GitHub zusätzlich den Scope `workflow`. Eine normale Repository-Schreibberechtigung genügt dafür nicht. Die Berechtigung wird über GitHub erteilt, niemals durch das Einfügen eines Tokens in Projektdateien.

## Rücknahme

Einen fehlerhaften Anwendungscommit mit `git revert <commit>` zurücknehmen und den normalen Workflow erneut durchlaufen lassen. Kein Force-Push auf `master`. Bei der erstmaligen Migration enthält der alte Stand noch keinen Workflow; eine Rückkehr dorthin erfordert zusätzlich die alte Pages-Quelle `master / (root)` oder das erneute Veröffentlichen eines zuvor erfolgreichen Pages-Artefakts.

## Testumgebungen

Standardmäßig startet Playwright den gebauten Stand über HTTP. `E2E_BASE_URL` ermöglicht eine bereits laufende Testinstanz. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` wählt optional ein vorhandenes Chromium aus.

In eingeschränkten Umgebungen kann zusätzlich `E2E_STATIC_DIR=dist` verwendet werden. Der Test-Harness beantwortet dann gleichnamige Browseranfragen aus den Build-Dateien. Das prüft JavaScript, Darstellung und Interaktionen, aber nicht den echten HTTP-Server. CI verwendet diesen Modus nicht und prüft Chromium sowie WebKit über HTTP.

## Supabase-Konfiguration

Der Build verwendet bevorzugt `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` aus Repository-Secrets oder lokaler `.env.local`. Da der verbundene GitHub-Connector den Secrets-Endpunkt mit HTTP 403 ablehnt, enthält `cloud.config.json` als funktionierenden Fallback die ausdrücklich öffentlichen Clientwerte dieses Projekts. Der Publishable Key ist zum Ausliefern an Browser bestimmt; RLS schützt Daten. Privilegierte Schlüssel bleiben in Supabase. Forks müssen eine eigene Konfiguration einsetzen.

`keep-alive.yml` liest per Zeitplan spätestens alle fünf Tage eine öffentliche Profil-ID, ohne sie zu protokollieren. Er benutzt dieselbe öffentliche Konfiguration. GitHub kann zeitgesteuerte Workflows in lange inaktiven öffentlichen Repositorys deaktivieren; ein Cronjob ist keine Verfügbarkeitsgarantie.
