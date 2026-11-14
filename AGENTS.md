# E-Binder-Arbeitsregeln

- Dieses Dokument ist die verbindliche Arbeitsgrundlage für das Repository. Alle Änderungen müssen die bestehende Produkt- und Qualitätsstrategie von E-Binder respektieren.
- Der Repository-Inhaber möchte geprüfte, fertige Änderungen direkt auf `master` veröffentlicht haben, damit die GitHub-Pages-Version sofort geteilt und für Feedback verwendet werden kann. Ein Feature-Zweig allein ist keine abgeschlossene Lieferung. Vor jedem Push den aktuellen Remote-Stand berücksichtigen; niemals Force-Push auf `master`.
- Vor Veröffentlichung `npm run check` und passende Browserprüfungen ausführen. Den GitHub-Actions-Lauf und die tatsächlich ausgelieferte Seite prüfen. Einen fehlgeschlagenen externen Schritt klar benennen.
- Persönliche Sammlungen, Originalfotos, Backups und Zugangsdaten gehören nicht ins öffentliche Repository. Lokale Demo und echter Besitz bleiben getrennt.
- Offiziell ausgewählt: Rare Room V2 (B), „Dein Fund. Dein Moment.“. Quelle: `public/E-Binder_Brand-Lab_v2.html` aus `fix/brand-lab-webkit-320`. Ersetzt Midnight/Cyan und PR #18. Originale Vektorpfade und native Systemschriften verwenden; das HTML darf unverändert bleiben.
- Kartenerkennung und Seitenempfehlung getrennt prüfen. Keine erfundenen Nutzerstudien, Genauigkeitswerte oder behaupteten physischen Aufbauten. Unsichere Karten erzeugen keinen bestätigten Besitz.
- Jede Änderung muss sauber, nachvollziehbar und dokumentiert sein. Keine ungetesteten Annahmen, keine erfundenen Garantien und keine Erweiterungen, die gegen die ausgewählte Rare-Room-Produktidentität verstoßen.

## Verbindlicher Design-Schutz (Owner-Entscheidung vom 14.11.2026)

Diese Regeln gelten ausdrücklich auch für OpenCode, Codex, Cline, Astra und alle
parallel arbeitenden Agents. **Technische Verbesserungen sind willkommen,
eigenmächtige visuelle Neugestaltungen nicht.**

- **Einfrieren der freigegebenen Optik:** Der vom Owner gewählte E-Binder-Look
  vom 13.11.2026 ist die visuelle Referenz, nicht Clines flacher Apple-UI-Umbau
  vom 14.11.2026. **E-BINDER-Logo**, dunkler Sammler-Look, kompakte Typografie,
  Lime-Akzent `#D8F25A` und der **große limegrüne Scan-Button in der Mitte der
  unteren Floating-Navigation** müssen erhalten bleiben. Die ursprünglichen
  Rare-Room-V2-Designtokens können weiterverwendet werden, **nicht** ungefragt
  das sichtbare E-BINDER-Branding durch ein Rare-Room-Logo ersetzen.
- **Volles Liquid Glass beibehalten:** Die bewusst wiederhergestellte
  Premium-Glass-Optik betrifft Floating-Dock und weitere UI-Oberflächen:
  echte optische Brechung, wo unterstützt (`simple-liquid-glass`), ansonsten
  abgestimmte Transparenz, Backdrop-Blur, Sättigung, Reflexionskanten,
  Tiefenschatten und gut lesbare Kontraste. **Keine neue flache/undurchsichtige
  Tab-Bar, kein Entfernen der Glas-Engine, keine dunkle Deckschicht über der
  aktiven Brechung, keine bloßen grauen Kästen als pauschaler Ersatz.**
  `prefers-reduced-transparency`, `prefers-reduced-motion` und Browser ohne
  Backdrop-Unterstützung behalten ausdrücklich zugängliche Fallbacks.
- **Navigation/Binder sind geschützt:** Fünf mobile Haupttabs
  `Home | Entdecken | Scan | Binder | Profil`, der grüne zentrale
  Scanner-Einstieg, sichtbare aktive Zustände, `Binder | Karten | Portfolio`
  als eigene aktive Sammlungs-Segmente (`aria-current="true"`), feste
  3×3-Binderplätze, Blättergesten, sichere iPhone-Safe-Areas und mindestens
  44px-Touchflächen bleiben erhalten. Weder die Floating-Bar noch
  Rückgängig-Toast/Sheets dürfen wichtige Karten oder Controls unbedienbar
  überdecken. **Beim Wechsel der drei Sammlungs-Tabs immer CSS und ARIA
  zusammen prüfen**, nicht nur die URL.
- **Kein Redesign ohne explizite Owner-Freigabe.** Insbesondere keine
  flächendeckende neue Farbpalette, Logo-/Icon-/Typografie-Rebrandings,
  Navigationserfindungen, Apple-UI- oder Retro-Futurism-Experimente. Erlaubt
  sind gezielte **Bugfixes und die Wiederherstellung** der oben festgelegten
  Darstellung. Änderungen an `src/workspace.css`, `src/styles.css`,
  `src/ui/collector-polish.ts`, `src/ui/vault-tabs.ts`,
  `src/ui/home-view.ts`, `src/ui/binder-view.ts`, Brand-Assets und
  Navigation nur mit unverändertem Designvertrag oder ausdrücklicher
  Freigabe.
- **Trennung von Look und Logik:** Scanner-Fusion, OCR/ONNX, Kartensuche,
  Supabase, Preisabgleich, Telemetrie und Release-Tests sind unabhängig vom
  visuellen Bestandsschutz weiterzuentwickeln. Ein Rollback der Darstellung
  darf diese Funktionalität nicht stillschweigend zurückrollen.
- **Nachweis vor Merge/Release:** Screenshots/Interaktionstests für iPhone
  (320px, 390px, bei Bedarf 430px), WebKit/iOS-Safari und Desktop; gezielt
  limegrünen Scanner, aktive Vault-Tabs, Liquid-Glass-Material, Überlappungen,
  horizontales Overflow, Seitenwechsel, Dialoge und Scrollbarkeit prüfen.
  `npm run check` und relevante Playwright-Tests ausführen. Bei unklarer
  Darstellung nicht spekulieren, sondern vorher/nachher vergleichen und
  Owner-Feedback einholen.

## OpenCode: Pflichtablauf bei jedem Neustart und vor neuem Arbeitsblock

**Noch vor der ersten Codeänderung:** Diese `AGENTS.md` lesen und den
neuesten `origin/master` holen. Der eigene lokale Checkout kann veraltet
sein, während andere Agents `master` veröffentlichen.

1. `git status --short --branch` prüfen. Bei uncommitteten Dateien die
   Arbeit zuerst bewusst sichern/committen; **niemals blind überschreiben,
   verwerfen, automatisch resetten oder einen fremden Worktree verändern**.
2. `git fetch --prune origin` und `git log -1 --oneline origin/master`
   ausführen. Das ist der neueste veröffentlichte Master-Quellstand.
3. **Auf dem eigenen Feature-/Review-Branch, mit sauberem Arbeitsbaum:**
   `git rebase origin/master` ausführen. Nicht einfach `git pull` auf
   einem Feature-Branch verwenden, da das ungewollt einen Merge mit dessen
   Upstream erzeugen kann. Bei Konflikten bewusst anhand der oben geschützten
   UI-Regeln auflösen, niemals pauschal `ours`/`theirs` wählen.
4. Wenn OpenCode stattdessen auf dem eigenen, sauberen lokalen `master`
   arbeitet: `git pull --ff-only origin master`. Einen parallel benutzten
   `master`-Worktree **nicht** aus einer anderen Session heraus umschalten.
   Für parallele Agents bevorzugt getrennte `git worktree`-Verzeichnisse.
5. Danach `git status --short --branch`,
   `git log -5 --oneline --decorate` und relevante Diffs prüfen. **Erst
   danach** Änderungen fortsetzen. Vor Merge/Release erneut fetchen und
   gegen den dann aktuellen `origin/master` abgleichen; Regressionsprüfungen
   erneut ausführen.
6. Niemals `git reset --hard` auf fremder Arbeit, niemals
   `git push --force` auf `master`, niemals fremde Branches ungefragt
   löschen oder rebasen. Eine nötige Veröffentlichung eines **eigenen**
   bereits gepushten, rebasten Feature-Branches nur nach Prüfung der
   Remote-Commits und ggf. mit `--force-with-lease`; keine fremden
   parallelen Änderungen überschreiben.

**Falls ein Rebase konfliktbehaftet ist oder Design- und Scanneränderungen
vermengt:** Nur den eigenen Branch bearbeiten, konkrete Konflikte dokumentieren
und nicht den älteren Look oder alte Scannerlogik über `master` legen.
