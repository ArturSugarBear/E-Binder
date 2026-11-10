# Binderseitenscanner – Test- und Qualitätsprotokoll

Stand: 9. November 2026. Diese Seite beschreibt implementierte Grenzen und reproduzierbare Messkriterien, **keine behauptete Erkennungsquote**.

## Ablauf

- In einem Binder **„Binderseite scannen“** wählen; alternativ über **+ Karte → Ganze Binderseite scannen**.
- Ein Bild der ganzen physischen 3×3-Seite aufnehmen oder bis zu 40 Seitenfotos als Batch auswählen. E-Binder bereitet die Zuschnitte zunächst **automatisch ohne Pflichtdialog** vor; keine Fotos werden persistent gespeichert.
- E-Binder versucht eine konservative automatische Seiteneckenerkennung; falls die Außenkanten nicht eindeutig sind, verwendet es das komplette Foto als Ausgangsbasis. Das Bild wird auf 1260×1760 Pixel projiziert und in neun Positionen aufgeteilt. **Zuschnitt korrigieren** öffnet die manuelle Vierpunkt-Ausrichtung optional. Vor der Übernahme sind alle neun sichtbaren Vorschaubilder zu kontrollieren, weil ein fehlerhafter Zuschnitt Karten falsch zuordnen kann.
- Ein PaddleOCR-Modell wird je Seitensitzung einmal in einem Worker geladen. Offensichtlich leere, unstrukturierte Taschen werden konservativ vorgeschlagen; mögliche Karten werden mit OCR gelesen. Ein Kandidat wird nur dann vorgewählt, wenn Set und gedruckte Kartennummer exakt passen und nur ein passender Kandidat bleibt. Kein OCR-Ergebnis ändert unmittelbar den Bestand.
- Neun Vorschaubilder bilden das 3×3-Raster ab. Ein Kartenfach lässt sich nur bei Bedarf über **Prüfen / ändern** aufklappen. Druckvarianten sind optional und starten als **Nicht bestimmt**; dadurch wird kein Holo-/Normalstatus geraten. Mit **Geprüfte Binderseite übernehmen** werden nur die konkret ausgewählten Karten in einem atomaren Zustands-Commit erfasst. Ungeklärte Positionen bleiben leer in der digitalen Seite und werden im Zähler ausgewiesen. Eine Seite ohne Karten kann übersprungen werden.
- Im selben Binder werden bereits ungebundene Exemplare zuerst verwendet. Die Fotodatei-Hashsperre blockiert identische Wiederholungen; erneute Fotos desselben Motives können ein anderes Hash haben.

## Messplan für echte schlechte Fotos

Fremde Shop- und Auktionsbilder nicht ungefragt in das öffentliche Repository kopieren. Ein im Internet sichtbares Foto ist nicht automatisch wiederverwendbar. Mögliche Quellen sind **eigene Fotos mit Einwilligung**, ausdrücklich freigegebene Fotos oder Bilder mit nachprüfbarer Lizenz. Bei öffentlichen Testbildern URL, Autor, Lizenz und Abrufdatum protokollieren. Die vorhandenen Pokémon-Kartenbilder sind urheberrechtlich geschützte Katalogabbildungen und werden nicht als freier Trainingsdatensatz ausgegeben.

Pro physischer Seite eine Ground-Truth-Datei anlegen (lokal, **nicht** in Git einchecken):

```json
{
  "photo": "local/test-page-001.jpg",
  "rights": "own photograph; no release",
  "conditions": ["glare", "perspective", "blur", "low-light"],
  "slots": [
    {
      "position": 1,
      "catalogId": "svi-211",
      "language": "de",
      "finish": "holo"
    },
    { "position": 2, "catalogId": null },
    { "position": 3, "catalogId": null }
  ]
}
```

Vollständige Ground Truth umfasst neun Positionen. Getrennt messen:

1. Ausschnittqualität: Anteil korrekt geschnittener, lesbarer Karten und korrekt leerer Positionen.
2. Kartenauflösung: **Top-1** und **Top-3** exakter Ausgaben (Set, Sprache, Kartennummer), nicht nur gleicher Pokémon-Name.
3. Falsch-positive Treffer und erzwungene Korrekturen.
4. Scanzeit pro Seite, Spitzen-RAM und Mobilfunkverbrauch auf echten iPhones.
5. Abbrüche, erneute Fotos, Offline-Abgleich und Dublettenschutz.

## Automatisierte Tests

`tests/unit/binder-page-scan.test.ts` kontrolliert 3×3-Geometrie, atomaren Import, Mengen, Slotreihenfolge und die Sperre identischer Aufnahmen.

`tests/e2e/binder-page-scan.spec.ts` kontrolliert den Einstieg, das Ausrichten, die neun lokalen Ausschnitte und den Schutz des unbestätigten Bestands. Der Browser-Test erzeugt ein künstlich schlechtes Foto aus den vorhandenen Projekt-Testkarten (leichte Rotation, Unschärfe und Blendstreifen) **im Browser**, ohne fremde Bilder hinzuzufügen. Er beweist nicht, dass alle neun Karten korrekt automatisch erkannt werden.

## Noch offene Genauigkeitsarbeit

Automatische Erkennung der äußeren Seitenkante (statt manueller Vierpunkt-Auswahl), Facherkennung bei stark ungleichmäßigem Raster, Bild-Fingerprint-Abgleich, Holo-Varianten-Erkennung und kalibrierte Confidence-Scores sind noch **nicht** gelöst. Bei kleineren/dunkleren Originalen führt OCR zu einer manuellen Prüfung. Der Scanner speichert keine ungeprüften Zuordnungen. Mehrere Fotos einer identischen Seite mit unterschiedlichem Hash lassen sich nicht sicher automatisch als Duplikat erkennen.

## OCR-Suche bei verschobener Sammlernummer (10. November 2026)

Wenn die beiden ursprünglichen Bildausschnitte keine plausible gedruckte Sammlernummer enthalten, durchsucht der lokale OCR-Worker vier benachbarte untere Zeilen und den unteren rechten Bereich. Bei einem Treffer werden weitere teure OCR-Durchläufe übersprungen. Erst wenn das nicht reicht, werden Kontrastvarianten geprüft. Eine gefundene Nummernfraktion ist nur ein Hinweis, keine verifizierte Kartenidentität: Set, Sprache und Druckvariante müssen weiterhin explizit bestätigt werden. Die Heuristik ist durch Unit-Tests abgesichert; ihre reale Erkennungsquote ist bis zum Benchmark mit eigenen oder rechtmäßig nutzbaren Binderfotos unbekannt.

## Automatischer Seitenumriss: bewusst konservativer erster Schritt

Die automatische Seiteneckensuche verwendet **kein ML-Modell und kein OpenCV**. Auf einer temporären, höchstens 256 Pixel breiten/hohen Kopie wertet sie links/rechts und oben/unten gerichtete Helligkeitskanten aus. Nur vier kräftige, konsistente Außenlinien und ein gültiges, ausreichend großes Viereck ergeben einen Vorschlag. Das funktioniert besonders gut bei deutlich vom Hintergrund abgegrenzten Binderseiten.

Ein dunkler Binder auf dunklem Hintergrund, unscharfe oder verdeckte Außenkanten, Buchringe, spiegelnde Folien und stark perspektivisch verzerrte Seiten können die Erkennung verhindern oder eine fehlerhafte Position vorschlagen. Bei unklaren Linien bleiben die vier manuell verschiebbaren Ausgangspunkte erhalten; bei einem Vorschlag können sie jederzeit korrigiert werden. Auch nach der automatischen Verarbeitung müssen die **neun Fächer in der Vorschau kontrolliert** werden. Die manuelle Ausrichtung ist eine Korrekturmöglichkeit und kein Pflichtschritt.

Die zugehörigen Unit-Tests prüfen synthetische, schräg begrenzte 3×3-Seiten, flache Hintergründe und fehlende Kanten. Ein Browser-Test prüft automatische Vorschläge, die Neun-Fächer-Vorschau und die manuelle Korrektur. **Keine belastbare reale Erkennungsquote** liegt vor: Dafür fehlen noch ausreichend viele eigene oder nachweislich rechtmäßig nutzbare und korrekt annotierte Binderfotos mit sehr unterschiedlicher Beleuchtung und Perspektive.

## 34 echte Binderseiten als privater Diagnosedatensatz (10. November 2026)

Der Inhaber hat 34 private Fotos (1200 × 1600 Pixel) für reale Scannerprüfungen bereitgestellt. Darunter befinden sich volle Seiten, teilweise leere Seiten, DE-/EN-/JA-Ausgaben, wiederholte Motive und reflektierende Karten. **Die Fotos und die ZIP-Datei werden weder in GitHub eingecheckt noch vom Scanner an Supabase übertragen.**

Ein erster _lokaler, nicht im Produkt veröffentlichter_ Raster-Diagnosedurchlauf verwendete die Vollbildaufteilung und den konservativen Leertaschen-Vorfilter. Er markierte **45 von 306** ungefähren Positionen als wahrscheinlich leer. Das ist **keine Genauigkeit** und kein Ground-Truth-Ergebnis: Tatsächliche leere Fächer müssen noch pro Foto verifiziert werden; die automatische Seitenausrichtung kann andere Zuschnitte erzeugen. Die Zusatzbedingung auf geringen Bildgradienten soll sehr dunkle Full-Art-Karten nicht als leer klassifizieren. Ein falsch-negatives „nicht leer“ ist bei diesem Vorfilter wesentlich sicherer als eine verschwundene physische Karte.

Für den Qualitätsnachweis fehlen insbesondere annotierte exakte Set-IDs je Position und ein Lauf des vollständigen OCR-/TCGdex-Workers auf den 34 Bildern. Die Live-Erkennungsquote wird erst nach einem solchen Test ausgewiesen. Das getrennte Entwicklerkonto ist nur ein Testkonto und darf keine Kartenzuordnungen als Ground Truth ersetzen.

## Zusätzliche Innennaht-Erkennung bei schwarzen Binderseiten

Wenn die vier Außenkanten nicht ausreichend deutlich sind, untersucht E-Binder als zweiten lokalen Schritt die beiden inneren Spalten- und Reihenfugen der 3×3-Taschen. Dafür wertet es in einer temporären, verkleinerten Kopie Kantenenergie über die gesamte jeweils andere Bildachse aus. Zwei ungefähr gleichmäßig verteilte, durchgehende Nähte pro Richtung ergeben einen plausiblen Seitenrahmen; sonst bleibt der konservative Vollbildzuschnitt samt optionalem „Zuschnitt korrigieren“.

Ein privater **Offline-Prototyp** lieferte bei 30 von 34 bereitgestellten Fotos geometrisch plausible Kandidaten. Das ist **keine bestätigte Ausrichtungsgenauigkeit** und kein Nachweis für korrekte Kartenerkennung: Die vollständige manuelle Ground Truth und Browsermessungen stehen aus. Die Fotos bleiben privat und sind nicht Bestandteil des öffentlichen Repositories.
