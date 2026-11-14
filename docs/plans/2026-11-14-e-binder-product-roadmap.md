# E-Binder Produkt-Roadmap — „Love Brand" statt Funktionssammlung

Stand: 14. November 2026. Grundlage: öffentliche HoloGem-/Collectr-Informationen
(App Store, Offizielle Seiten, Hilfe-Center, öffentliche Reviews; abgerufen am
14.11.2026) plus eine repo-interne Code- und UX-Prüfung. Keine Wettbewerber-App
wurde instrumentiert; Genauigkeits- oder Umsatzangaben der Wettbewerber sind
Marketing, keine Messwerte.

## 1. Produktthese

E-Binder gewinnt nicht durch die größte Funktionsliste, sondern durch:

1. **Vertrauen** — exakte Druckausgabe, Sprache, Sammlernummer, Preisquelle,
   ehrliche Lücken. Kein „ungefähr dieselbe Karte", keine erfundene Confidence.
2. **Geschwindigkeit** — Discover und Portfolio müssen sich wie eine native App
   anfühlen, nicht wie ein Katalogformular.
3. **Ruhe** — eine Primäraktion pro Bildschirm, keine Erklärwände, kein
   Auto-Besitz, keine Dark Patterns.

Die Identität bleibt Rare Room V2: „Dein Fund. Dein Moment."

## 2. Was E-Binder heute schon gut macht

- Set-Navigation mit DE/EN/JA, Serien, Illustrator-/Raritätsfiltern und Suche.
- Karten-Detail mit Quellen-/Datumsangabe und Cardmarket-Produktprüfung.
- Ehrliche Preisabdeckung: unbepreiste Karten werden nicht als 0 € verkauft.
- Lokaler OCR-Scanner, Queue, explizite Prüfung, kein automatischer Besitz.
- Optionaler DINOv2-Pilot, jetzt mit Coverage-Gate statt erfundener Treffer.
- Lokale Speicherung, optionaler Sync, keine Pflicht-Anmeldung.

## 3. Die echten Lücken (priorisiert)

### P0 — Portfolio ist der Retention-Gap

Collectr gewinnt über die Frage „Bin ich im Plus oder Minus?". E-Binder zeigt
den aktuellen (teilweisen) Wert, aber keinen Einstandspreis, keinen
Gewinn/Verlust, keine Dublettenansicht und keinen Set-Fortschritt.

| Feature                                    | Warum                                    | Aufwand                          | Risiko                              |
| ------------------------------------------ | ---------------------------------------- | -------------------------------- | ----------------------------------- |
| Optionaler Einstandspreis + Gewinn/Verlust | Beantwortet die wichtigste Sammlerfrage  | Lokale Arithmetik, ein Feld + UI | Niedrig; klar von Marktwert trennen |
| Dubletten-/„Most repeats"-Ansicht          | `quantity` ist bereits vorhanden         | Aggregation + Liste              | Niedrig                             |
| Set-Fortschritt X/Y                        | Retention-Hook, vorhandene Set-Metadaten | Katalog-IDs ∩ Besitz             | Mittel (Datenabdeckung)             |
| Allocation in % je Set                     | Wert statt nur Anzahl                    | Vorhandene Gruppierung           | Niedrig                             |
| CSV-Export                                 | Praktischer als JSONL                    | Serialisierung                   | Niedrig                             |

**Regel:** Einstandspreis ist optional. Fehlt er, steht „unbekannt", nicht 0 €.
Gewinn/Verlust ist keine Prognose und keine Anlageberatung.

### P1 — Discover: Parity halten, nicht kopieren

Discover ist **näher an der Parity als erwartet**. Es fehlen vor allem:

- globales, set-übergreifendes Sortieren nach Preis (innerhalb eines Sets gibt
  es das bereits); nur mit echten Katalogtrends und ehrlichem Hinweis, dass es
  Katalogdurchschnitte, keine Verkaufspreise sind;
- ein schnellerer erster Screen: Set-Kacheln, sticky Suche/Filter, Skeletons,
  Lazy Images, weniger Request-Wasserfälle;
- Set-Fortschritt und „begonnen / nicht begonnen".

**Nicht nachbauen:** Graded-Comps, Pop-Reports, Auktionsdaten. Dafür fehlt eine
belastbare Datenquelle; ein Fake wäre schlimmer als die Lücke.

### P1 — Onboarding und Alltag

- Erster Screen: eine Primäraktion (Scannen), eine sekundäre (Entdecken).
- Empty States: was fehlt + genau eine nächste Aktion.
- Fortgeschrittenes hinter Disclosure, nicht vor dem ersten Wert.
- Keine Persona-Auswahl, keine Notification-Berechtigung vor dem ersten Nutzen,
  keine Paywall, keine „X Scans übrig"-Knappheit.

### P1 — Scanner-Vertrauen und Benchmark

- Stage-Leiste, ehrlicher Reward, Otsu-/Footer-OCR: umgesetzt.
- Nächster Schritt: gelabelter Benchmark aus eigenen Fotos (DE/EN/JA, Glare,
  Sleeves, Full-Art, Negative), Top-1/3/5 exakter Druck, No-Result, Latenz.
- Erst danach über einen großen Index oder Fine-Tuning entscheiden.

### P2 — Später, nur mit Datenquelle

- Graded/Pop-Report-Werte, Per-Card-Preishistorie, Trade-Analyzer,
  Push-Preisalarme, Multi-Currency-Umschalter.
- Diese Features brauchen neue Datenquellen bzw. eine belastbare Historie.
  Sie dürfen nicht aus vorhandenen Aggregaten erfunden werden.

## 4. Top-10-Reihenfolge (Value ÷ Risiko)

1. Einstandspreis + Gewinn/Verlust (Portfolio).
2. Dublettenansicht (Portfolio/Sammlung).
3. Set-Fortschritt X/Y (Discover/Portfolio).
4. CSV-Export.
5. Allocation in % je Set.
6. Globales Preissortieren in der Suche (nur echte Trends).
7. Wunschliste → Besitz über den bestehenden Bestätigungsgate.
8. Preisquelle + Frische im Kartendetail sichtbarer machen.
9. Mobile Discover-Speed (Skeletons, Lazy Images, Request-Coalescing).
10. In-App-Preisschwellen (lokal, keine Push-Infrastruktur).

## 5. Was wir bewusst nicht kopieren

- Kein „Add all" ohne Bestätigung, keine Default-Condition/Variant.
- Keine AI-Grading- oder Condition-Behauptung.
- Keine Paywall/Scan-Limits, keine künstliche Knappheit.
- Keine Fortschrittsbalken, die eine Genauigkeit oder einen Preis erfinden.
- Keine kopierten Icons, Animationen, Illustrationen oder Trade-Meter.
- Keine Pflicht-Anmeldung, keine Push-Nags, keine Streaks.

## 6. Messgrößen (ohne erfundene Zielwerte)

- Time-to-first-card und Scan→Bestätigung.
- No-Result-Rate und manuelle Korrekturrate.
- Discover: Set → Karte → Wunschliste/Besitz.
- Portfolio: wöchentliche Wiederkehr, Anteil mit Einstandspreis,
  Preisabdeckung, Dublettenansicht.
- Scanner: p50/p95 auf echten iPhones, Abbruchrate, erneute Scans.
- Vertrauen: Anteil bestätigter statt automatisch übernommener Karten.

## 7. Nächste Entscheidungen

1. **Einstandspreis:** optionales Feld pro Exemplar oder pro Karte? Empfehlung:
   pro Exemplar (Holding), weil Zustand/Variante den Preis bestimmen.
2. **Set-Fortschritt:** nur für geladene Sets oder global? Empfehlung: zuerst
   pro geöffnetem Set, global später mit Cache.
3. **Globales Preissortieren:** nur für die erste Ergebnisseite oder alle
   Treffer? Empfehlung: gedeckelt, mit sichtbarem „Preise werden geladen".
4. **Supabase-Fotos:** Export außerhalb des Repos oder serverseitiger
   Lese-Schlüssel außerhalb des Chats; danach VLM-Vorlabel + menschliche
   Prüfung, kein Auto-Training.

## 8. Quellen (Auswahl)

- HoloGem: https://hologem.app/ · App Store id 6805670096
- Collectr: https://www.getcollectr.com/ · App Store id 1603892248
- TCGScanners Collectr-Übersicht: https://tcgscanners.com/reviews/collectr/
- Repo: `docs/research/collectr.md`,
  `docs/benchmarks/competitors/2026-11-10/ANALYSIS.md`, `PRODUCT.md`,
  `docs/design.md`, `src/ui/discover-view.ts`, `src/ui/portfolio-view.ts`,
  `src/ui/catalog-browser.ts`, `src/domain/portfolio.ts`.

Alle Quellen abgerufen am 14.11.2026. Wettbewerber-Funktionen sind öffentliche
Produktbeschreibungen, keine unabhängig gemessenen Fähigkeiten.
