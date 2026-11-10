# Sitzplan

Installierbare Web-App für das Handy, mit der eine Lehrkraft Sitzpläne erstellt. Die App läuft ohne Server und ohne Internet. Klassen, Regeln und Pläne liegen ausschließlich auf dem Gerät.

## Was sie kann

- Klassen anlegen und Kinder aus einer Klassenliste als PDF übernehmen (Klasse als Überschrift, Zeilen als „Nachname, Vorname“) oder als Text einfügen
- Räume als Raster aus Plätzen bauen; die Tafel ist unten, Plätze direkt nebeneinander sind Sitznachbarn, ein leeres Feld ist ein Gang
- Regeln je Klasse, jeweils als „muss“ oder „wäre schön“:
  sitzt neben, sitzt nicht neben (auch für mehrere Kinder, wahlweise „nicht in der Nähe“), sitzt vorn, fester Platz, Einzelplatz
- Sitzplan vorschlagen lassen, neu würfeln, Kinder durch Antippen tauschen, Kinder fixieren, Plätze sperren
- Ein neuer Plan rotiert gegenüber dem letzten Plan derselben Klasse im selben Raum: erst neue Sitznachbarn, dann neue Plätze
- Plan als PDF (A4 quer, Lehrersicht) teilen oder drucken; Regeln stehen nie auf dem Ausdruck
- Sicherung in eine Datei und zurück

## Entwicklung

```
npm install
npm run dev        # lokal starten
npm test           # Tests der Platzvergabe und des Klassenlisten-Imports
npm run typecheck
npm run build      # nach dist/
./deploy.sh        # testen, bauen und nach GitHub Pages veröffentlichen (Zweig gh-pages)
```

Die Platzvergabe liegt in `src/domain/seating.ts`, der Klassenlisten-Import in `src/domain/classlist.ts`. Beide sind reine Funktionen mit Tests daneben. Testdaten enthalten nur erfundene Namen.
