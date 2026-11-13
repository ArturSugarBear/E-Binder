# HoloGem Android 1.0.1 · statische Analyse (13. November 2026)

Diese Zusammenfassung ergänzt den [UX-Benchmark vom 10. November](../2026-11-10/ANALYSIS.md). Sie beschreibt die Technik hinter dem HoloGem-Scanner. Sie ist Evidenz für eigene Entscheidungen, keine Vorlage.

**Regel:** Code, Modelle, Assets, Texte und Gestaltung von HoloGem nicht in E-Binder übernehmen. Ideen nur als eigene Umsetzung prüfen.

## Quelle und Methode

| Punkt         | Wert                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| App           | HoloGem TCG Card Value Scanner, Paket `com.ratel.hologem`, Version 1.0.1                                |
| Quelle        | Öffentliche XAPK von APKPure, vom Inhaber geladen                                                       |
| XAPK SHA-256  | `913ed5a1b5e9fee4f26b11932e0ad47baf2b9357f831a99a491537316dd62808`                                      |
| Signatur      | Basis-APK und arm64-Teil deklarieren dasselbe Zertifikat und einen Play-Herkunftsstempel                |
| Methode       | Statische Prüfung mit REA: Archivinhalt, Signaturdaten, Modell-Metadaten, Zeichenketten im Dart-Code    |
| Nicht gemacht | App nicht gestartet, keine Anfrage an HoloGem-Server, keine Genauigkeitsmessung, Signatur nicht geprüft |

Die APK-Dateien und der vollständige Bericht liegen nur lokal beim Inhaber. Sie gehören nicht in dieses Repository.

## Technik (beobachtet)

- Flutter-App mit lokaler Datenbank (Isar).
- Kamera über CameraX.
- Erkennung auf dem Gerät: TensorFlow Lite (LiteRT) mit GPU-Beschleunigung, Google ML Kit OCR, OpenCV.
- Kartenabgleich, Preise und Sammlung über einen eigenen Server.
- Abo über Adapty. Analyse über PostHog, Amplitude und Firebase.

## Scan-Ablauf

| Schritt | Evidenz                                               | Ablauf                                                                                                     |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1       | Eigenes Eckenmodell (6,4 MB) mit Metadaten            | Findet die vier Kartenecken und einen Wert „Karte vorhanden“.                                              |
| 2       | OpenCV, Dateinamen zum Zuschnitt (Folgerung)          | Entzerrt die Karte zu einem geraden Bild.                                                                  |
| 3       | Eigenes Fußzeilenmodell, Varianten für GPU und CPU    | Liest nur die unteren 15 % der Karte: Sammlernummer und Setcode. Zeichensatz: Ziffern, Buchstaben, `/-.#`. |
| 4       | Kalibrierungstabellen je Feld in den Modell-Metadaten | Getrennte, kalibrierte Sicherheit für Nummer und Set (Folgerung aus den Feldnamen).                        |
| 5       | ML Kit OCR, Liste gültiger gedruckter Zeichenketten   | Allgemeine Texterkennung; die Liste begrenzt Lesefehler auf echte Werte (Folgerung).                       |
| 6       | Zeichenketten im Dart-Code                            | Serverabgleich zuerst über Text, danach über Bild. Ein Serverkontingent begrenzt Gratis-Scans.             |
| 7       | Hinweistexte zu Unschärfe und Spiegelung auf Folie    | Live-Hinweise vor der Erfassung.                                                                           |

Jedes Modell hat ein Testbild mit erwarteten Ausgaben. Folgerung: Die App prüft Modell und GPU-Pfad auf dem Gerät selbst.

## Bezug zu E-Binder

| Beobachtung bei HoloGem                     | Mögliche eigene Entscheidung für E-Binder                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Nur der Nummernstreifen wird gelesen        | Exakte Ausgabe über Sammlernummer und Setcode bestimmen, nicht über Volltext der Karte. |
| Sicherheit je Feld, nicht je Karte          | Passt zur Regel: Unsichere Karten erzeugen keinen bestätigten Besitz.                   |
| Liste gültiger Setcodes und Gesamtzahlen    | OCR-Ergebnis gegen den eigenen Katalog prüfen, bevor ein Treffer gilt.                  |
| Erlerntes Eckenmodell statt nur Kantensuche | Für Hüllen und Folien prüfen; zuerst mit den eigenen Ground-Truth-Fotos messen.         |
| Selbsttest der Modelle beim Start           | Defekten GPU-Pfad erkennen, bevor der Nutzer scannt.                                    |
| Serverkontingent für Scans                  | Kein Ziel für E-Binder. Der kostenlose lokale Einstieg bleibt.                          |

## Grenzen

- Nur statische Evidenz. Laufzeitverhalten ist nicht beobachtet.
- Der Dart-Code ist nicht dekompiliert. Die Aussagen stammen aus Dateinamen, Zeichenketten und Modell-Metadaten.
- Die Antwort des Servers beim Abgleich ist unbekannt.
- Schritte 2, 4 und 5 sind Folgerungen.
- Keine Erkennungsquote gemessen. Keine Aussage, dass HoloGem genauer ist als E-Binder.
