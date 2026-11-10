# Bildsuche vor OCR – lokaler Embedding-Pfad

Stand: 10. November 2026. **Die ausführbare Architektur ist implementiert, aber noch nicht produktiv aktiviert**, weil noch kein freigegebenes ONNX-Modell und kein vollständig vorverarbeiteter mehrsprachiger Bildindex unter `public/assets/vision/` ausgeliefert werden.

## Warum

Ein Kartenname bezeichnet oft viele Ausgaben. Artwork-Ähnlichkeit reduziert das Kandidatenfeld erheblich; eine gedruckte Sammlernummer trennt gleiche Illustrationen zwischen Sets, Sprachen und Neuauflagen. Ein hoher Cosinus-Score **ist keine Erkennungswahrscheinlichkeit** und bestätigt weder Druckvariante noch Besitz.

## Laufzeit

1. Das vorhandene Binderseiten-Cropping erzeugt neun einzelne Fotokarten. Unklare Geometrie bleibt manuell korrigierbar.
2. Der Browser prüft, ob ein **gleichursprüngliches** `assets/vision/manifest.json` vorhanden ist. Ohne Manifest funktioniert der bisherige OCR-Scanner unverändert.
3. Ein eigener Worker lädt das per SHA-256 geprüfte ONNX-Modell, den versionierten `int8`-Index und das geordnete Kartenreferenzverzeichnis. Er berechnet ein Embedding des auf 224×224 gestreckten Kartenbildes in RGB/255 CHW, nutzt den CLS-Token und führt eine bounded Cosinus-Top-5-Suche aus. `modelId` und Dimensionen müssen übereinstimmen.
4. Für visuelle Top-5 liest der vorhandene OCR-Worker zuerst **nur die unteren Set-/Nummernregionen**; Titel-OCR wird im üblichen Pfad übersprungen. Visuell und per Sammlernummer passende Kandidaten werden an erster Stelle vorgeschlagen. Nicht eindeutig unterscheidbare Sprachen oder Sets bleiben zur Prüfung offen.
5. Der Scanner versucht die drei besten visuellen Ausgaben als vollständige TCGdex-Kartenreferenzen aufzulösen. Vorhandene lokale Karten werden auch ohne Netz berücksichtigt. Fehlt der Katalog offline, bleiben Kandidaten unaufgelöst; **vollständige Offline-Katalogmetadaten sind noch nicht ausgeliefert**.
6. Bei fehlendem, beschädigtem oder unverträglichem Modell, unauflösbaren visuellen Treffern oder Fehlern bei der Inferenz greift die bestehende OCR-/Katalogsuche. Kein visueller Treffer ändert den Bestand automatisch.

## Modell- und Index-Vertrag

Das Manifest verwendet das Format `e-binder-visual-v1` mit `modelId`, `dimensions`, `count`, `size=224`, `preprocessing=rgb-0-1-chw-stretch`, `pooling=cls`, den drei lokalen Dateinamen sowie SHA-256 für ONNX und `index.i8`. Die Dateinamen enthalten die Modellversion (z. B. \`index-approved-model-v1.i8\`), damit ein alter PWA-Cache keine inkompatiblen Modell-/Indexdateien vermischt. Dateinamen ohne Unterverzeichnisse verhindern fremde Origins und Pfadwechsel.

Der Index ist eine feste `count × dimensions`-Matrix im vorzeichenbehafteten `int8`-Format. Referenz-IDs sind einmalig und sprachgebunden, z. B. `de:sv01-211` oder `ja:SV2a-001`. Die dazugehörige `references.json` verwendet identische Reihenfolge und enthält `id`, `language`, `setId` und `number`.

Zur Verpackung bereits berechneter Vektoren:

```sh
node scripts/pack-visual-index.mjs ./licensed-precomputed-vectors.json ./approved-model.onnx ./public/assets/vision
npm run check
```

**Wichtig:** Dieses Skript erstellt keine neuen Embeddings. Die offline erzeugten Referenzvektoren müssen mit **genau derselben Modellversion, Bildskalierung, Normierung und CLS-Pooling-Methode** berechnet werden wie der Browser-Worker. Wird das Modell geändert, muss der gesamte Referenzindex neu berechnet und `modelId` geändert werden. Neue Sets erfordern dagegen nur neue Referenzvektoren.

Ein öffentliches DINOv3- oder MobileCLIP-Modell darf nicht ungeprüft eingepackt werden: Lizenz, Redistributionsrechte, unterstützte ONNX-Operationen, Abmessungen, Vorverarbeitung und Bilddaten-Nutzungsrechte müssen vorher geklärt werden. Der Verweis auf ein 14-MB-Modell einer Drittanbieter-App ist **keine** Berechtigung, deren Modell oder fertig gepackte Embeddings zu kopieren.

## Betrieb und Grenzen

- **Offline-Modellcache:** Das installierte PWA-Service-Worker-Paket hält Modell, int8-Index und Referenzmetadaten nach erfolgreichem Erstabruf getrennt von den OCR-Daten im Cache. Das Manifest wird bei einer Verbindung neu validiert und bei Offlinebetrieb aus dem Cache geladen. Verfügbarkeit hängt von Browser-Speicherquoten und einer tatsächlich installierten PWA ab; die App garantiert keine dauerhafte Speicherung, wenn iOS den Cache löscht.
- **iOS als PWA:** ONNX Runtime Web/WASM als verlässlichstes Backend; die direkten Apple-Vision- und Core-ML-APIs stehen Browser-JavaScript nicht zur Verfügung. Weder eine NPU-Inferenz im Millisekundenbereich noch eine feste Scanzeit ist aktuell nachgewiesen.
- Top-K-Vergleich ist bewusst linear und auf maximal 20 Kandidaten begrenzt, ohne vollständige Sortierung oder einen zusätzlichen ANN-Index. Erst echte iPhone-Laufzeiten entscheiden, ob Shards, WebGPU auf anderen Plattformen oder Index-Optimierungen notwendig sind.
- **Ein Binderfoto entspricht keiner Live-Kamerafolge:** Das wiederholte Einbetten desselben Standbilds darf nicht als Mehrbild-Abstimmung behandelt werden. Der vorbereitete Konsenshelfer verlangt mehrere aufeinanderfolgende echte Frames und wird erst in einem späteren Live-Scan aktiviert.
- Es wird keine Bilddatei an den Modellserver hochgeladen. Das Modell und der Katalog stammen von derselben GitHub-Pages-Origin. TCGdex-Abfragen für vollständige Kartendaten erfolgen weiterhin gegebenenfalls über das Internet.
- Jedes Kartenfach bleibt vor der Bestandsübernahme prüfbar; Holo-/Reverse-Holo-Druckvarianten können aus dem Artwork allein nicht bestätigt werden.

## Messung mit den 34 privaten Binderseiten

Der vorliegende Fotosatz ist eine **Testbasis, kein bereits bestandener Benchmark**. Er enthält deutsche und japanische Drucke, Duplikate, stark reflektierende Karten und leere Fächer. Die 306 Positionen müssen mit exakter Set-ID, Karten-ID, Sprache, tatsächlicher Belegung und bei Bedarf Variante annotiert werden.

Erst mit Modell und freigegebenem Referenzindex werden folgende Werte vergleichbar gemessen: korrektes Top-1/Top-5 pro besetztem Fach, falsche Zuordnungen, falsche Leertaschen, Anteil manueller Korrekturen, p50/p95 je Karte und je Seite, maximaler RAM-Verbrauch und Modell-Erstladezeit auf dem echten iPhone. Die privaten Fotos dürfen **nicht** ins öffentliche GitHub-Repository hochgeladen werden.

## Reproduzierbarer Weg von Referenzbildern zum lokalen Index

Ein vorbereitender Offline-Schritt kann die Referenzen jetzt **aus lokal vorliegenden, rechtmäßig nutzbaren Kartenbildern** erzeugen, ohne die Fotografien zu einem Dienst hochzuladen:

```sh
python -m pip install 'numpy>=1.26,<3' 'pillow>=10,<13' 'onnxruntime>=1.20,<2'
python scripts/embed-card-references.py ./image-manifest.json ./approved-model.onnx ./embeddings.json
node scripts/pack-visual-index.mjs ./embeddings.json ./approved-model.onnx ./public/assets/vision
```

Das `image-manifest.json` enthält `modelId`, `preprocessing` sowie `references` mit Karten-ID, Sprache, Set, Sammlernummer und relativem lokalen `path` zum Bild. Der Embedding-Generator akzeptiert ausschließlich Dateien unterhalb des Manifest-Verzeichnisses und validiert die Modellantwort. Anschließend packt das Node-Skript die Vektoren und Originalreferenzen in die konsistente `int8`-Datenbank. **Weder Skript noch App laden eigenständig fremde Kartenbilder massenhaft herunter.**

Als technisch nachvollziehbarer, grundsätzlich offener Kandidat eignet sich `facebook/dinov2-small` (Apache-2.0-Modell, 384 Dimensionen); ONNX-Konvertierungen davon existieren unter `onnx-community/dinov2-small-ONNX`. Anders als die 14-MB-Angabe aus dem Wettbewerbsbeispiel ist das unquantisierte Modell deutlich größer; Größe, iPhone-Laufzeit, echte Bildtreffer und die Lizenz der verwendeten Bilder müssen vor der produktiven Auslieferung geprüft werden. Für DINOv2 setzt der Manifest-Vertrag `preprocessing: "imagenet-meanstd-chw-stretch"` voraus. Die Python- und Browser-Vorverarbeitung verwenden dieselben Kanalmittelwerte und Standardabweichungen, kleine Unterschiede beim Resampling sind im Realfoto-Benchmark zu messen. Der vorherige `rgb-0-1-chw-stretch`-Modus bleibt für entsprechend trainierte Modelle erhalten.

Wird später ein neues Set hinzugefügt, reicht es, seine **lizenzierten Referenzbilder** mit der gleichen Modellversion einzubetten, die Kandidatenliste zu erweitern und den Index neu zu paketieren. Wird das Modell verändert, muss dagegen der **gesamte Katalog** mit neuer `modelId` neu eingebettet werden. Ein modellübergreifend gemischter Index ist nicht zulässig.
