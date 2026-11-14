# Rare Room V2 — Produktionsidentität

Ausgewählt vom Inhaber: B — Rare Room, „Dein Fund. Dein Moment.“. Supersedes Midnight/Cyan and PR #18. Authoritative source: `public/E-Binder_Brand-Lab_v2.html` from `fix/brand-lab-webkit-320`, preserved unchanged.

“Die Lücke”: original binder-pocket E and missing-card sparkle. `scripts/rare-room-v2.mjs` preserves the source vectors and SVG construction; `generate-pwa-icons.mjs` renders them to SVG and PNG, including opaque maskable icons. Never redraw the symbol or typeset the wordmark.

| Role      | Color   |
| --------- | ------- |
| Vault     | #141519 |
| Surface   | #22242B |
| Bone      | #F4F1EA |
| Muted     | #A9A8B4 |
| Holo-Lime | #D8F25A |
| Foil      | #B9A6FF |
| Raised    | #2E3038 |
| Binder    | #0B0C0F |

V2 composition guidance: Vault 62%, Lime 18%, Bone 12%, raised 5%, Foil 3%. Card art remains dominant and unaltered; lime identifies actions and selections. Foil belongs to the sparkle. Native SF Pro Display Heavy headings with tight tracking, native system UI text, SF Mono metadata with platform fallbacks. No Apple font redistribution. No active Bricolage font loading.

Shared semantic roles live in `src/styles.css`; workspace components use these roles. Preserve 3×3 pockets, 63:88 artwork, safe areas, 44px targets, keyboard access, reduced motion, offline storage and existing gestures.

## Bedienmuster nach der UI-Prüfung

Kleine Formauswahlen mit zwei bis vier stabilen Alternativen verwenden `choices` aus `workspace-dom.ts`: native Radio-Gruppen mit sichtbaren Auswahlflächen. Keine kopierten Einzelkomponenten und keine ARIA-Tabs für Formwerte. Lange oder wechselnde Listen wie Sets, Karten und Illustratoren bleiben Suchfelder beziehungsweise native Listen. Sortierung darf unter einer klar bezeichneten aufklappbaren Zeile liegen, wenn der aktuelle Wert sichtbar bleibt. Für einen einzigen vorhandenen Binder genügt sein Titel.

Die Sammlung priorisiert ihre Karten statt doppelter Kennzahlkacheln. Offene Erfassungen bleiben handlungsfähig sichtbar. Kartendetails in „Entdecken“ zeigen vorhandene Katalogpreise mit Quelle, Währung und Datum und verlinken ausschließlich auf eine validierte Cardmarket-Produkt-ID. Fehlende Preis-/Bezugsdaten werden benannt. Das ist keine Bestandsbewertung. [Prüfgrundlage und Grenzen](research/ui-usability.md).

### Navigation und Scanner (13. November 2026)

- Die mobile Leiste ist eine native Tab-Bar: `Home | Entdecken | Scan | Binder | Profil`. Es gibt genau ein aktives `aria-current="page"` pro Bildschirm; der Binder-Tab öffnet `Deine Binder`, die Vault-Segmente (Binder · Karten · Portfolio) tragen `aria-current="true"`. Die Desktop-Navigation wiederholt keine mobile Route.
- Home und der Scan-Tab öffnen den Live-Sucher direkt („One scanner surface“). „Karten hinzufügen“ bleibt der manuelle Katalog-/Dateiweg und öffnet keinen zweiten Dialog automatisch. Aufnahmen werden erst beim Öffnen der Prüfung in den Bestandszustand übernommen.
- Die leere Sammlung hat genau eine Lime-Primäraktion und eine sekundäre Demo-Aktion. Überschriften-Aktionen stapeln unter 360 px.
- Jede Schaltfläche/Karte/Tab antwortet mit `:active`; Hover-Regeln liegen hinter `(hover: hover)`. Sheet-Ziehen, Backdrop und Escape fragen bei ungespeicherten Feldern nach; `window.confirm` ist durch das eigene Bestätigungs-Sheet ersetzt.
- Schriften: Body 17 px, Sekundärtext 15 px, Beschriftungen 13 px, rechtliche Kleinschrift mindestens 11 px. Die 900er-Display-Stimme gilt nur für den Home-Hero und die Erstbesuchs-Headline; h2/h3 und Dialogtitel sind 600–700 ohne extremes Tracking. `html` nutzt `-apple-system-body`; rem-Größen folgen damit Dynamic Type.

## Native iPhone-Gesten: Cards & Sheets (10. November 2026)

Die mobile App verwendet konsistente, unaufdringliche Gesten statt isolierter Klickpfade:

- Ein Bottom-Sheet ist mit einem sichtbaren Ziehgriff erkennbar und lässt sich **am Kopf nach unten ziehen**, sobald die Bewegung eindeutig vertikal und lang oder schnell genug ist. Ein Tap auf X, Escape und die Fokus-Rückgabe funktionieren weiter. Bei Kartenansichten lässt sich auch die Artwork-Fläche nach unten ziehen.
- In einem persönlichen Binder kann man **innerhalb der physischen Binderseite links/rechts wischen**, um zur nächsten/vorherigen Seite zu gelangen. Die Schaltflächen und der Seitenzähler bleiben als Tastatur- und Assistive-Technologie-Alternativen erhalten.
- Kartendetails in der eigenen Sammlung unterstützen **links/rechts wischen** über dem Artwork; dieselbe Reihenfolge wie die aktuell gefilterte und sortierte Sammlung wird verwendet. Bei nicht gespeicherten Formularänderungen wird der Kartenwechsel abgewiesen und erklärt.
- Im Inspirationsarchiv bleibt das bekannte seitliche Wischen der Karte erhalten; zusätzlich schließt eine Abwärtsbewegung am Artwork oder am Sheet-Griff die Ansicht.
- Touch-Gesten werden nur auf schmalen Geräten mit grobem Pointer aktiviert. Die empfindlichen Zonen sind Artwork, Seitenfläche oder Sheet-Kopf, **nicht** Textfelder, Scroll-Listen, Buttons oder Systemränder. Vertikales Scrollen langer Dialoge bleibt dem Browser überlassen.
- Unter `prefers-reduced-motion: reduce` entfallen Slide- und Ziehanimationen, nicht aber die semantischen Navigationsmöglichkeiten.

Ein Button zum Schließen bleibt immer vorhanden. Keine Nutzeraktion wird heimlich in einen Kauf, eine Besitzänderung oder eine Löschung umgewandelt. Native `<dialog>`-Semantik, Fokusbegrenzung und Fokus-Rückgabe bleiben Grundlage.
