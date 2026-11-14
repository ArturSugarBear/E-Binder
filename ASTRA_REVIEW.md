# E-Binder — Astra Review / Auftrag für OpenCode

Stand: 14. November 2026. Review-Basis: `master@8b8a8823b3c69c0f30b922ec28d974f74ae61c2e`.

## Auftrag und Freigabe

Artur hat am 14. November 2026 ausdrücklich einen eigenen Review-Branch beauftragt, aus dem OpenCode verbindliche Verbesserungen für E-Binder umsetzen kann. Ziel ist ein konkurrenzfähiges Sammlerprodukt mit überzeugender visueller Darstellung und Bedienung; Kartenscanning ist ein gleichwertiger Kernbereich, nicht der gesamte Produktauftrag.

„Astra Review“ ist der vom Inhaber gewünschte Name dieses Handoffs. Die Dokumente sind ein quellenbasierter Review und eine Umsetzungsspezifikation, kein Nachweis eines Modellwechsels, einer abgeschlossenen Implementierung oder einer bestandenen Produktabnahme.

**Freigegeben ist die Verbesserungsrichtung und die Ausarbeitung verbindlicher Umsetzungskriterien.** Die einzelnen technischen Lösungen und numerischen Zielbudgets unten sind daraus abgeleitete Engineering-Vorgaben, keine Behauptung einer bereits erfolgten Einzelabnahme durch Artur. OpenCode soll die Pakete umsetzen und nachweisen, statt erneut nur einen Plan zu schreiben.

Dieser Auftrag liefert bewusst ausschließlich Dokumentation auf einem eigenen Branch. Die allgemeine Regel in AGENTS.md, fertige App-Änderungen auf master zu liefern, hebt diese ausdrücklich gewünschte Branch-Lieferung nicht auf. Dieser Branch verändert keine App, Datenbank, Berechtigungen oder Deployment-Konfiguration und veranlasst weder Merge noch Release. Bestehende Freigaben und explizite Einschränkungen anderer aktiver Arbeiten bleiben separat zu beachten; insbesondere PR #120 nicht aufgrund dieses Dokuments automatisch mergen.

## Verbindliche Lesereihenfolge

1. [Befunde und Evidenz](docs/reviews/astra-2026-11-14/01-evidence.md)
2. [Produkt- und Interaktionsvertrag](docs/reviews/astra-2026-11-14/02-product-contract.md)
3. [Umsetzungspakete](docs/reviews/astra-2026-11-14/03-execution-plan.md)
4. [Abnahme und Nachweise](docs/reviews/astra-2026-11-14/04-acceptance.md)
5. Bestehende AGENTS.md, PRODUCT.md, docs/design.md sowie spezifische Scanner- und OpenCode-Dokumente; Konflikte gemäß diesem Auftrag offen auflösen.

## Startauftrag an OpenCode

Lies diesen Review vollständig. Prüfe zuerst deinen aktuellen Branch, uncommittete Änderungen, den aktuellen master und PR #120. Bewahre laufende Arbeit. Übernimm die Review-Dokumente in deinen Arbeitsstand, ohne den älteren App-Stand dieses Review-Branches über neuere Implementierungen zu legen.

Arbeite die Pakete R00–R11 in der angegebenen Reihenfolge bzw. gemäß Abhängigkeiten ab. Beginne mit R00 und R01, dann liefere R02 als ersten sichtbaren Produktfortschritt. Scanner-Arbeit in PR #120 weiterverwenden, wenn geprüft und integriert; nicht neu erfinden. Nach jedem Paket Implementierung, passende Tests, echte Screenshots und offene Grenzen dokumentieren. Stoppe nicht bei einem weiteren Konzept oder einem schönen leeren Mockup. Keine Behauptung „fertig“, wenn nur ein Flag, Stub, Pilotindex oder Dokument existiert.

Die Produktarbeit muss Home, Navigation, Binder, Sammlung, Kartendetail, Entdecken, Portfolio, Scanner und Profil abdecken. Eine reine Scanner-Lieferung erfüllt diesen Auftrag nicht.

## Harte Regeln

- E-Binder bleibt E-Binder. Kein erneutes Rare-Room-Rebranding oder Retro-Futurism-Rollout aus alten Dokumenten ableiten. Die spätere Owner-Rücknahme ist bei der Bereinigung maßgeblich. Bestehende nützliche Lime-/Flächentokens können bleiben; keine neue Palette erfinden.
- Keine fremden Karten, Varianten, Preise oder Besitztümer erfinden. Unbekannt bleibt unbekannt.
- Keine künstliche Fortschrittsanzeige, gefälschte Portfolio-Historie oder ungemessene „KI erkennt alles“-Behauptung.
- Bestehende native TypeScript/DOM-Architektur, lokale Speicherung, echte 3×3-Positionen und optionale Cloud erhalten.
- Keine privaten Fotos, Tokens, Nutzerkennungen oder Backups ins öffentliche Repository.
- Tests nicht löschen, überspringen oder abschwächen, um CI grün zu färben. Veraltete Erwartungen nur mit dokumentierter Produktänderung aktualisieren.
- Keine weiteren Designkonzepte als Ersatz für konsistente, getestete Umsetzung.

## Lieferung pro Paket

Im späteren Implementierungsbranch eine STATUS.md in diesem Review-Ordner pflegen:
Paket-ID, Status (offen / in Arbeit / implementiert / verifiziert / blockiert), Commit, Tests, Screenshot-/Tracepfad, verbleibende Einschränkung. Kein Paket ohne Nachweis als verifiziert markieren.
