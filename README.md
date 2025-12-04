# Malerleistungen Kalkulator

React + Vite + Redux + RxDB Anwendung zur Kalkulation von Malerleistungen.

## 🚀 Schnellstart

### Installation
```bash
pnpm install
```

### Entwicklung starten
```bash
pnpm run dev
```

Die App läuft dann auf `http://localhost:5173`

## 📋 Was ist implementiert?

### ✅ Phase 1: Basis-Setup
- [x] Projekt-Struktur mit Vite
- [x] Redux Toolkit Setup
- [x] RxDB mit IndexedDB Storage
- [x] Alle Dependencies installiert

### ✅ Phase 2: Datenbank
- [x] 6 RxDB-Schemas definiert:
  - Services (Leistungen)
  - SpecialServices (Sonderleistungen)
  - Factors (Faktoren)
  - Objects (Objekte/Räume)
  - Calculations (Berechnungen)
  - Workflows (Tagesplanung)
- [x] Database Service mit CRUD-Operationen
- [x] Initial-Daten für Testing

### ✅ Phase 3: Berechnungslogik
- [x] Schritt 1: Services mit Unterleistungen
- [x] Schritt 3: Mengenberechnung Decke
- [x] Schritt 4: Mengenberechnung Umfang
- [x] Schritt 5: Objekttyp-Faktoren
- [x] Schritt 6: Mengenberechnung Wände
- [x] Schritt 7: Sonderangaben-Faktoren
- [x] Schritt 8: Baseline-Zeit
- [x] Schritt 9: Effizienzgrad
- [x] Schritt 10: Kundenfreigabe
- [x] Schritt 11-13: Workflow-Planung

### ✅ Phase 4: UI-Komponenten
- [x] ObjectSelector - Objekte hinzufügen/bearbeiten
- [x] ServiceSelector - Leistungen zuweisen
- [x] CustomerApproval - Kundenfreigabe
- [x] ResultsDisplay - Ergebnisse anzeigen

## 🧪 Testing-Schritte

### Schritt 1: App starten
1. `pnpm run dev` ausführen
2. Browser öffnen: `http://localhost:5173`
3. Browser-Konsole öffnen (F12) - sollte "✅ RxDB initialized successfully" sehen

### Schritt 2: Objekt hinzufügen
1. Im Formular "Objekte hinzufügen":
   - Name: z.B. "Wohnzimmer"
   - Typ: "Wohnzimmer" auswählen
   - Grundfläche: z.B. "25"
   - Raumhöhe: z.B. "2.5"
2. "Objekt hinzufügen" klicken
3. Objekt sollte in der Liste erscheinen

### Schritt 3: Leistung zuweisen
1. Im Bereich "Leistungen zuweisen" sollte das Objekt erscheinen
2. Checkbox bei "Überholungsanstrich - Streichen (Wände + Decken)" aktivieren
3. Die Berechnung sollte automatisch starten

### Schritt 4: Kundenfreigabe
1. Checkbox "Freigabe für parallele Arbeiten" aktivieren
2. Effizienzen sollten jetzt angewendet werden (wenn Menge groß genug)

### Schritt 5: Ergebnisse prüfen
1. Im Bereich "Kalkulationsergebnisse" sollten erscheinen:
   - Mengen (Deckenfläche, Umfang, Wandfläche)
   - Leistungen mit Zeiten
   - Gesamtübersicht
   - Arbeitsplan (wenn vorhanden)

## 📊 Test-Szenarien

### Szenario 1: Einfaches Wohnzimmer
- Objekt: Wohnzimmer, 25 m², 2.5 m Höhe
- Leistung: Überholungsanstrich
- Erwartung: 
  - Deckenfläche: 25 m²
  - Umfang: ~20 m (4 × √25)
  - Wandfläche: ~50 m²

### Szenario 2: Flur mit Faktor
- Objekt: Flur, 15 m², 2.5 m Höhe
- Leistung: Überholungsanstrich
- Erwartung:
  - Mengenfaktor 1.2 sollte angewendet werden
  - Umfang sollte größer sein

### Szenario 3: Bad mit Leistungsfaktor
- Objekt: Bad, 10 m², 2.5 m Höhe
- Leistung: Überholungsanstrich
- Erwartung:
  - Leistungsfaktor 2.0 sollte angewendet werden
  - Zeit sollte höher sein

## 🔧 Nächste Schritte

### Daten-Import
- [ ] Excel/CSV-Parser für vollständige Leistungsdaten
- [ ] Import-UI für Admin

### Erweiterte Features
- [ ] SpecialNotes-UI (Sonderangaben zu Objekten)
- [ ] Detaillierte Workflow-Timeline
- [ ] Export-Funktionen (CSV, JSON)
- [ ] PDF-Export für Angebote

### Verbesserungen
- [ ] Besseres Error-Handling
- [ ] Loading-States verbessern
- [ ] Responsive Design
- [ ] Unit-Tests

## 📝 Technische Details

### Stack
- **React 18** - UI Framework
- **Vite** - Build Tool
- **Redux Toolkit** - State Management
- **RxDB 15** - Lokale NoSQL-Datenbank
- **Dexie** - IndexedDB Adapter für RxDB
- **pnpm** - Package Manager

### Projektstruktur
```
src/
├── database/          # RxDB Setup & Schemas
├── store/            # Redux Store & Slices
├── services/         # Business Logic
├── components/       # React Components
├── hooks/           # Custom Hooks
├── utils/           # Helper Functions
├── constants/       # Constants
└── data/            # Initial Data
```

## 🐛 Bekannte Probleme

- Initial-Daten sind minimal (nur 2 Services für Testing)
- Workflow-Planung ist vereinfacht
- Keine Validierung für Eingaben
- Keine Persistenz bei Browser-Reload (RxDB speichert aber in IndexedDB)

## 📚 Dokumentation

Siehe:
- `DOKUMENTATION_KALKULATIONSLOGIK.md` - Vollständige Beschreibung der Kalkulationslogik
- `IMPLEMENTIERUNGSPLAN.md` - Detaillierter Implementierungsplan

