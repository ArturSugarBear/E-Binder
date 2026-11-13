# Vercel-Release nach erfolgreichem GitHub-CI

## Ziel und Status

Die kostenlose iPhone-PWA läuft unter <https://e-binder-zeta.vercel.app>.
Die bestehende GitHub-Pages-Seite bleibt als Fallback online.

Der GitHub-Actions-Workflow [vercel-production.yml](../.github/workflows/vercel-production.yml)
wird erst aktiv, wenn eine erfolgreiche, **push-ausgelöste** Ausführung von
`Check and publish E-Binder` auf `master` abgeschlossen ist. Ein roter Test,
ein Pull Request, eine tägliche Datenwartung oder ein überholter Commit
führen **nicht** zu einem Vercel-Release.

Anders als der bisherige direkte Vercel-Git-Build erstellt diese Pipeline
auch das echte, überprüfte DINOv2-ONNX-Modell sowie den zugehörigen
neunteiligen Referenzindex. Diese Dateien sind bewusst nicht im
Git-Repository eingecheckt; ein einfacher Vite-Build liefert sie daher
nicht automatisch aus. Die neun DE-Karten sind ein begrenzter Pilot,
kein universeller Karten-Scanner.

## Einmalige Einrichtung durch den Repository-Inhaber

1. In Vercel unter **Account Settings → Tokens** einen widerrufbaren Token
   mit den notwendigen Berechtigungen für das Projekt `e-binder` anlegen.
   **Nicht in Chat, Repository oder Issue posten.**
2. In GitHub unter **E-Binder → Settings → Secrets and variables → Actions →
   Repository secrets** den Namen `VERCEL_TOKEN` anlegen und den Wert
   ausschließlich dort hinterlegen.
3. Im selben GitHub-Bereich unter **Variables** die Variable
   `VERCEL_DEPLOY_ENABLED` auf den Text `true` setzen. Ohne Variable
   bleibt der Vercel-Release absichtlich deaktiviert, damit CI nicht
   durch fehlende Zugangsdaten rot wird.
4. Den Workflow durch einen geprüften Merge nach `master` auslösen.
   Die anschließende erfolgreiche `Check and publish E-Binder`-Pipeline
   startet die Vercel-Veröffentlichung automatisch.

Vercel-Team `team_Ohsaj9V6AzRe0uIKSjUDmOB6`, Projekt
`prj_NP6LOmCsOwR7mJuHU28wRfiZkghJ`. Das sind öffentliche
Ressourcen-IDs, keine geheimen Zugangsschlüssel. Der bereits in Vercel
konfigurierte öffentliche Supabase-Publishable-Key ist für das Frontend
gedacht; **niemals** den Supabase-Service-Role-Key in diesen Build geben.

## Freigabe-Gates

- Exakter Commit der bereits erfolgreichen CI wird ausgecheckt.
- `master` darf sich vor dem Start und vor dem Promote nicht geändert haben.
- Pinned DINOv2-ONNX heruntergeladen, SHA-256 geprüft, Embeddings erzeugt
  und Modell/Index gemeinsam mit `verify-visual-beta.mjs` geprüft.
- Vercel-Build mit Basispfad `/`, `version.json`, PWA-Manifest,
  ONNX-Datei und Vektorindex wird lokal verifiziert.
- Produktion zunächst **ohne Domain-Umschaltung** bereitstellen und
  `version.json`, HTML und Vision-Manifest über HTTPS testen.
- Erst danach dieselben getesteten Dateien per `vercel promote`
  unter <https://e-binder-zeta.vercel.app> veröffentlichen und den
  Versions-SHA erneut abgleichen.

Eine echte iPhone-Safari-Kameramessung bleibt ein **manueller
Beta-Freigabeschritt**. Ein grüner Linux-WebKit-Test misst keine
Erkennungsquote für reale JA-/DE-/EN-Kartenfotos.

## Alternative mit Vercel-Git-Integration

Mit der offiziellen Vercel-GitHub-Integration sind zusätzlich
automatische Pull-Request-Vorschau-URLs möglich. Diese GitHub-App muss
der Repository-Inhaber **einmalig in Vercel installieren und dem Repo
Zugriff erteilen**. Die bloße Login-Verbindung reicht nicht. Ein
unbedachtes Paralleldeployment direkt aus GitHub kann die oben
aufgeführten Prüfungen einschließlich der DINOv2-Modellerzeugung
umgehen; deshalb sollte für die produktive Domain nur **eine** der
beiden Veröffentlichungsmechanismen verantwortlich sein.
