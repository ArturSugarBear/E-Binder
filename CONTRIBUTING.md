# Änderungen beitragen

1. Einen Arbeitszweig vom aktuellen `master` erstellen.
2. Änderungen in der passenden Schicht umsetzen. Daten, Benutzeroberfläche und Netzwerkanfragen nicht vermischen.
3. Bei Fehlerbehebungen einen Test ergänzen, der das beobachtete Fehlverhalten nachweist. Reine Textänderungen benötigen keine künstlichen Tests.
4. `npm run check` und bei Verhaltens- oder Layoutänderungen `npm run test:e2e` ausführen.
5. Den Pull Request mit Problem, sichtbarer Auswirkung und tatsächlicher Prüfung beschreiben.

## Karten ergänzen

Kartenmetadaten stehen in `public/collection.json`, Bilder in `public/assets/cards/<id>.webp`. Pro Kapitel sind neun Karten und drei Cover vorgesehen. Karten-ID, Sammlernummer und Cardmarket-Produkt müssen zur konkreten Ausgabe passen. Neue Kapitel nicht vor bestehende Kapitel einfügen, solange numerische Kapitel-Links verwendet werden; dadurch würden geteilte Links ihre Bedeutung ändern.

Abhängigkeiten bewusst aktualisieren und den Lockfile mitführen. `npm ci` ist die verbindliche Installation in CI. Niemals Zugangsdaten, persönliche Tokens, `.env`-Dateien oder Testberichte einchecken. Die öffentliche App darf keine privaten Nutzerdaten enthalten.
