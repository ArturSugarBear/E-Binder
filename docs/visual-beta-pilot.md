# Visuelle KI – E-Binder Beta (begrenzter 9-Karten-Pilot)

## Was dieser Release wirklich einschaltet

In **Profil → Visuelle KI · begrenzter Test → Visuelle KI Beta testen** kann jeder Tester die *lokale* DINOv2-Suche auf **diesem Gerät** aktivieren. Der reguläre OCR-Pfad bleibt immer eingeschaltet.

Die erste Beta enthält **exakt neun** bereits gebündelte, unabhängig anhand von Set und Nummer geprüfte deutsche Druckausgaben:
sv01-211, sv01-212, sv01-245, sv02-208, sv02-209, sv02-210, sv03-207, sv03-208, sv03-225.

Das ist ein **Pilottest des Modellpfads** und kein universeller Pokémon-Kartenscanner. Japanische, englische und nicht indizierte deutsche Karten werden nicht anhand des Modells erkannt. Sie bleiben über reguläre OCR/Katalogsuche verfügbar.

Das Bild wird lokal als Vektor eingebettet und nur gegen die neun fest zugeordneten Referenzen verglichen. Ähnlichkeit und Top-5 sind **keine Kalibrierung und keine Druckausgaben-Bestätigung**. Die App zeigt ausschließlich mögliche Karten zur manuellen Prüfung. Sie setzt niemals Bestand oder 1st Edition automatisch.

## Build / Herkunft

GitHub Actions lädt das unveränderte ONNX Community DINOv2-Small INT8-Modell von einer festgelegten Revision und verifiziert dessen SHA-256. Python ONNX Runtime erzeugt die Referenzvektoren aus dem selben Modell und denselben neun lokal vorhandenen Kartendateien. Der gepackte Index und die Modell- und Referenzdatei erhalten SHA-256 in `assets/vision/manifest.json`. Das Produktions-Build scheitert, wenn Modell, Dimensionszahl, Referenzmenge oder Hashes nicht stimmen.

Gewicht: etwa 24,4 MB bei erstem Abruf. Speicherbedarf, iOS Safari-Inferenzzeit und tatsächliche Genauigkeit sind noch nicht bewiesen. Ein langsamer/fehlender Download fällt auf OCR zurück. Einwilligung zur optionalen Spende eines Fotos ist **unabhängig** davon; die visuelle Suche sendet keine Kamera-Pixel an Supabase.

## Nachvollziehbarer Beta-Test

1. Schalter im Profil aktivieren, Scan-Dialog öffnen und den Modell-Abruf im Browser beobachten.
2. Physische **Trasla sv01-211**, **Kirlia sv01-212**, **Guardevoir-ex sv01-245** bzw. die sechs weiteren geprüften Ausgaben aufnehmen. Nicht unterstützte Karten ausdrücklich als Negativfälle testen.
3. In der Kartenprüfung Top-1/Top-5 notieren und prüfen, dass kein Besitz ungefragt gespeichert wird. Unter dem autorisierten Entwicklerkonto werden nur aggregierte Kandidatenzahlen protokolliert, keine Fotos/Transkripte.
4. Auf echten iPhones (Safari/PWA) Kaltstart, Cache, Netzlosigkeit, Fehlkandidaten und Strom-/RAM-Verhalten prüfen; kein Test darf aus synthetischen Browserfixtures abgeleitete Genauigkeitswerte als echt ausgeben.

## Parallel: Beta-Bilder und Gewichtsänderungen

Die 15 freiwillig gespendeten Bilder stehen privat auf `pending`, ohne menschlich bestätigte Labels. Bestehende Operator-Werkzeuge `scripts/export-beta-review.mjs`, `scripts/review-beta-samples.mjs` und `scripts/beta-dataset-audit.mjs` erlauben verschlüsselten Export, unabhängige Einzelprüfung und anonyme Freigabezählung. Sie benötigen private Serverschlüssel außerhalb öffentlicher GitHub-Aktionen. Ein Foto darf erst nach wirklich sichtbarer Set-ID, Nummer, Sprache, Druckausgabe und dokumentierter Zustimmung/Verwendungsberechtigung als Ground Truth gelten. Die Bestätigung in der App allein ist kein fehlerfreies Trainingslabel.

Für jede Modellvariante dieselben unveränderten, separat gehaltenen Fotos in `scripts/benchmark-card-scans.mjs` (OCR allein versus OCR+Visual) durchlaufen lassen und Top-1, Top-3, Top-5, Falschtreffer, Negativfälle und p50/p95 vergleichen. Training oder Änderung der Gewichte erst mit unabhängiger Hold-out-Menge, reproduzierbarer Trainingspipeline und positiver A/B-Messung. Der aktuelle Pilot **ändert keinerlei Modellgewichte**.

Ausbau des Bildindex zuerst durch rechtlich geprüfte Metadaten und Kartenbilder mit eindeutiger ID/Set/Nummer/Sprache, dann erneut mit demselben Modell einbetten. Niemals gleiche historische Nummer oder Artwork allein als Identitätsbeweis benutzen.
