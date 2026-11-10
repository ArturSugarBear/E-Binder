# Binderseitenscanner – Test- und Qualitätsprotokoll

Stand: 9. November 2026. Diese Seite beschreibt implementierte Grenzen und reproduzierbare Messkriterien, **keine behauptete Erkennungsquote**.

## Ablauf

- In einem Binder **„Binderseite scannen“** wählen; alternativ über **+ Karte → Ganze Binderseite scannen**.
- Ein Bild der ganzen physischen 3×3-Seite aufnehmen oder bis zu 40 Seitenfotos als Batch auswählen. Die Seiten werden einzeln ausgerichtet, erkannt und bestätigt; keine Fotos werden persistent gespeichert.
- Die vier äußeren Seiten-Ecken anpassen (keine Buchringe). E-Binder projiziert das Bild auf 1260×1760 Pixel und erzeugt neun Ausschnitte, in Zeilenreihenfolge 1–9. Die Plastiknaht am Taschenrand wird vorsichtig abgeschnitten.
- Ein PaddleOCR-Modell wird je Seitensitzung einmal in einem Worker geladen. Es liest jeden Ausschnitt. TCGdex und lokale Katalogdaten liefern Vorschläge, aber **keine automatische Bestandsänderung**.
- Jede Position als konkrete Kartenausgabe, „Fach ist leer“ oder „nicht erkannt“ prüfen. Eine Druckvariante muss aktiv gewählt werden. Ein globaler Bestätigungs-Haken ist erforderlich. Die ganze Seite wird in einem Zustands-Commit geschrieben oder bei Fehler vollständig verworfen.
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
