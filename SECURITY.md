# Sicherheit

Die Webapp liefert öffentliche redaktionelle Daten aus und verarbeitet keine Konten oder Zahlungen. Besucher laden Karten und Schriften vom selben Host. Externe Angebote werden erst über einen gekennzeichneten Link geöffnet.

Zugangsdaten gehören weder in `public/`, Quellcode noch Vite-Umgebungsvariablen. Client-Builds sind öffentlich lesbar. Produktlinks werden gegen das festgelegte HTTPS-Cardmarket-Format geprüft. Dynamische Texte werden nicht als HTML interpretiert.

Bei Sicherheitsproblemen keine Zugangsdaten oder personenbezogenen Daten in öffentlichen Issues veröffentlichen. Den Repository-Inhaber über einen bereits verfügbaren privaten Kontaktweg informieren. Abhängigkeiten vor Aktualisierungen prüfen; den Lockfile und die automatischen Prüfungen gemeinsam aktualisieren.
