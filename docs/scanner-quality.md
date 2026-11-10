# Binder-Scan: Aufnahmequalität und reproduzierbarer Benchmark

Die lokale Qualitätsprüfung in E-Binder warnt pro Fach vor sehr dunklen Bildern, extrem hellen Bereichen, geringem Kontrast und wenigen feinen Bilddetails. Die Kriterien sind **Heuristiken**, keine OCR-Konfidenz und keine Garantie für korrekte Karten. Einzelne Karten mit dunkler Gestaltung oder einem großen weißen Hintergrund können Warnungen auslösen. Deshalb blockieren Warnungen niemals die manuelle Bestätigung und setzen Fächer nicht automatisch auf leer.

## Datensätze mit Nutzungsrechten

Als mögliche externe Evaluationsquellen (nicht automatisch im Repository enthalten):

- [Roboflow Universe: pokemon-card-binder (cardbinder)](https://universe.roboflow.com/cardbinder/pokemon-card-binder) – zum Zeitpunkt der Recherche mit 36 Bildern und **CC BY 4.0** gekennzeichnet (Quelle: Dataset-Seite, November 2026). Verfügbarkeit und Lizenz vor jedem Download erneut prüfen und Originalautor sowie Lizenz dokumentieren.
- [Roboflow Universe: pokemon-card-binder (armazone)](https://universe.roboflow.com/armazone/pokemon-card-binder-t4slc) – ebenfalls als **CC BY 4.0** gelistet. Separate Dataset- und Bildnutzungsbedingungen prüfen.

Eine Dataset-Lizenz gilt nicht automatisch für fremde Rechte an abgebildeten Pokémon-Kartenmotiven. Keine Bilder aus Auktionen, Shops oder Foren in das öffentliche Repository übernehmen, solange eine entsprechende Erlaubnis fehlt. Für die beste Ground Truth eigene Binderseiten aus unterschiedlichen Entfernungen, Lichtverhältnissen, Sleeves und Reflexionen fotografieren.

## Lokalen Benchmark ausführen

1. Im Projekt `npm ci && npm run build && npm run preview` starten.
2. Einen **privaten**, nicht eingecheckten JSON-Datensatz anlegen:

```json
{
  "samples": [
    {
      "photo": "./bilder/meine-binderseite.jpg",
      "rights": "Eigene Aufnahme; nicht zur Veröffentlichung",
      "conditions": ["low-light", "glare", "perspective"],
      "corners": [[0.08, 0.05], [0.92, 0.06], [0.9, 0.95], [0.1, 0.94]],
      "slots": [
        "tcgdex:de:svi-211", null, null,
        null, null, null,
        null, null, null
      ]
    }
  ]
}
```

Der Schlüssel muss mit dem vom TCGdex-Katalog ausgegebenen `PersonalCard.key` der exakten Karte übereinstimmen. `null` bedeutet ein physisch leeres Fach und geht **nicht** in die Kartenerkennungsquote ein. Für jede Seite müssen neun Positionswerte vorhanden sein. `corners` ist optional; die Werte sind normalisierte Eckkoordinaten (oben links, oben rechts, unten rechts, unten links).

3. `BINDER_BENCHMARK_OUT=~/scan-report.json node scripts/benchmark-binder-scans.mjs ~/private/binder-ground-truth.json` ausführen.

Das Skript öffnet die lokale Produktions-PWA in Chromium, reicht Bilder über den lokalen Datei-Dialog ein, führt neun OCR-/Katalogabgleiche durch und protokolliert **Top-1/Top-3 exakt passende Kartenschlüssel** und Warnungen pro Position. Es klickt niemals auf „Geprüfte Binderseite übernehmen“. Ohne bekannte Karten ist die Erkennungsquote `null`, nicht 100 %.

**Grenzen:** Das Skript prüft keine tatsächliche iPhone-Kamera, keine iOS-PWA-Installation und keine exakte Facherkennung ohne vorher korrekt gewählte Seitenecken. Offline-Benchmarking testet die lokalen Treffer und Katalog-Caches, nicht einen vollständigen Pokémon-Katalog. Erkennungsquote darf nur mit Datensatzgröße, Bedingungen und Korrekturaufwand gemeinsam angegeben werden. Die gemessenen Metadaten enthalten Dateinamen und Kartenschlüssel; Berichte vor Weitergabe prüfen. Fotos werden nicht exportiert.
