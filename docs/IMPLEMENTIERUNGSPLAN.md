# Implementierungsplan: Malerleistungen Kalkulator

## Übersicht

Dieser Plan beschreibt die konkrete Schritt-für-Schritt Umsetzung der React + Vite + Redux Anwendung zur Kalkulation von Malerleistungen.

**Geschätzte Dauer:** 5-7 Arbeitstage (je nach Detailgrad der UI-Komponenten)

---

## Phase 1: Projekt-Setup und Grundstruktur

### Schritt 1.1: Projekt initialisieren

- [ ] Vite-Projekt mit React erstellen: `npm create vite@latest offer-calculator -- --template react`
- [ ] In Projektverzeichnis wechseln: `cd offer-calculator`
- [ ] Abhängigkeiten installieren: `npm install`
- [ ] Redux Toolkit und React-Redux installieren: `npm install @reduxjs/toolkit react-redux`

### Schritt 1.2: Projektstruktur erstellen

```
offer-calculator/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── store/
│   │   ├── index.js
│   │   └── slices/
│   ├── services/
│   ├── components/
│   │   ├── ObjectSelector/
│   │   ├── ServiceSelector/
│   │   ├── QuantityDisplay/
│   │   ├── SpecialNotes/
│   │   ├── EfficiencyDisplay/
│   │   ├── WorkflowTimeline/
│   │   └── ResultsDisplay/
│   ├── utils/
│   └── constants/
```

### Schritt 1.3: Basis-Konfiguration

- [ ] `vite.config.js` anpassen (falls nötig)
- [ ] `index.html` Titel und Meta-Tags anpassen
- [ ] Basis CSS-Styling erstellen (`index.css`)

---

## Phase 2: Redux Store Setup

### Schritt 2.1: Store-Konfiguration

- [ ] `src/store/index.js` erstellen
  - Store mit configureStore einrichten
  - Alle Reducer registrieren

### Schritt 2.2: Redux Slices erstellen

#### 2.2.1: Objects Slice

- [ ] `src/store/slices/objectsSlice.js` erstellen
  - State: `objects: []` (Array von Objekten)
  - Actions:
    - `addObject` - Neues Objekt hinzufügen
    - `updateObject` - Objekt aktualisieren
    - `removeObject` - Objekt entfernen
    - `addServiceToObject` - Leistung zu Objekt hinzufügen
    - `removeServiceFromObject` - Leistung von Objekt entfernen
    - `addSpecialNote` - Sonderangabe hinzufügen
    - `removeSpecialNote` - Sonderangabe entfernen

#### 2.2.2: Settings Slice

- [ ] `src/store/slices/settingsSlice.js` erstellen
  - State: Onboarding-Daten
    - `services: []` - Leistungskatalog
    - `objectTypeFactors: {}` - Faktoren je Objekttyp
    - `specialNoteFactors: {}` - Faktoren für Sonderangaben
    - `waitTimes: {}` - Wartezeiten je Leistung
    - `parallelWorkRules: {}` - Regeln für Parallelarbeit
    - `workflowOrder: {}` - Reihenfolge der Leistungen
    - `maxProductivityPerDay: {}` - Max. Produktivität je Tag
    - `efficiencySettings: {}` - Effizienz-Einstellungen
  - Actions:
    - `loadSettings` - Settings laden (aus JSON/API)

#### 2.2.3: Calculations Slice

- [ ] `src/store/slices/calculationsSlice.js` erstellen
  - State:
    - `quantities: {}` - Berechnete Mengen je Objekt
    - `baselines: {}` - Baseline-Zeiten je Leistung
    - `efficiencies: {}` - Angewandte Effizienzen
    - `customerApproval: false` - Kundenfreigabe
    - `results: null` - Finale Kalkulationsergebnisse
  - Actions:
    - `setQuantities` - Mengen setzen
    - `setBaselines` - Baselines setzen
    - `setEfficiencies` - Effizienzen setzen
    - `setCustomerApproval` - Freigabe setzen
    - `setResults` - Ergebnisse setzen
    - `clearResults` - Ergebnisse zurücksetzen

#### 2.2.4: Workflow Slice

- [ ] `src/store/slices/workflowSlice.js` erstellen
  - State:
    - `days: []` - Tagesplanung
    - `waitTimes: []` - Aktive Wartezeiten
    - `parallelWork: []` - Parallele Arbeiten
    - `optimalEmployees: 1` - Optimale Mitarbeiteranzahl
  - Actions:
    - `setDays` - Tagesplanung setzen
    - `addWaitTime` - Wartezeit hinzufügen
    - `addParallelWork` - Parallele Arbeit hinzufügen
    - `setOptimalEmployees` - Mitarbeiteranzahl setzen

### Schritt 2.3: Provider einrichten

- [ ] `src/main.jsx` anpassen
  - Redux Provider um App wrappen
  - Store importieren und übergeben

---

## Phase 3: Services (Berechnungslogik)

### Schritt 3.1: Constants und Utilities

- [ ] `src/constants/index.js` erstellen

  - HOURS_PER_DAY = 8
  - Weitere Konstanten

- [ ] `src/utils/formulas.js` erstellen
  - `calculateCeilingArea(floorArea)` - Schritt 3
  - `calculatePerimeter(floorArea)` - Schritt 4
  - `calculateWallArea(perimeter, height)` - Schritt 6
  - Weitere mathematische Hilfsfunktionen

### Schritt 3.2: Quantity Service

- [ ] `src/services/quantityService.js` erstellen
  - `calculateObjectQuantities(object)` - Berechnet alle Mengen für ein Objekt
    - Deckenfläche (Schritt 3)
    - Umfang (Schritt 4)
    - Wandfläche (Schritt 6)
  - `applyObjectTypeFactors(quantity, objectType, factors)` - Schritt 5
    - Mengenfaktor anwenden
    - Leistungsfaktor zurückgeben

### Schritt 3.3: Service Management

- [ ] `src/services/serviceService.js` erstellen
  - `getServicesWithSubServices(serviceId, services)` - Schritt 1
    - Hauptleistung finden
    - Unterleistungen anhängen
    - Array zurückgeben

### Schritt 3.4: Baseline Service

- [ ] `src/services/baselineService.js` erstellen
  - `getBaselineTime(serviceId, quantity, services)` - Schritt 8
    - Service finden
    - Baseline-Zeit je Einheit berechnen
    - Mit Menge multiplizieren

### Schritt 3.5: Special Notes Service

- [ ] `src/services/specialNotesService.js` erstellen
  - `applySpecialNoteFactors(baseTime, specialNotes, factors)` - Schritt 7
    - Alle Sonderangaben durchgehen
    - Faktoren multiplizieren
    - Angepasste Zeit zurückgeben

### Schritt 3.6: Efficiency Service

- [ ] `src/services/efficiencyService.js` erstellen
  - `calculateEfficiency(serviceId, totalQuantity, settings, maxProductivity)` - Schritt 9
    - Effektivitätsmenge prüfen
    - Lineare Steigerung berechnen
    - Grenzeffektivität berücksichtigen
    - Effizienzfaktor zurückgeben
  - `checkCustomerApproval(customerApproval)` - Schritt 10
    - Prüft ob Effizienzen angewendet werden dürfen

### Schritt 3.7: Workflow Service

- [ ] `src/services/workflowService.js` erstellen
  - `checkWaitTimesAndParallelWork(services, waitTimes, parallelRules)` - Schritt 11
    - Wartezeiten identifizieren
    - Parallelarbeit prüfen
    - Inkompatible Arbeiten erkennen
  - `sortServicesByWorkflow(services, workflowOrder)` - Schritt 12
    - Services nach Workflow-Order sortieren
  - `calculateOptimalEmployees(totalHours, maxEfficiencyHours)` - Schritt 13
    - Optimale Mitarbeiteranzahl berechnen
    - Effizienzverlust vermeiden
  - `planWorkflow(calculationResults, settings)` - Hauptfunktion
    - Alle Services sammeln
    - Nach Workflow sortieren
    - Über Tage verteilen
    - Wartezeiten berücksichtigen
    - Parallelarbeit planen
    - Personal optimieren

### Schritt 3.8: Main Calculation Service

- [ ] `src/services/calculationService.js` erstellen
  - `performCalculation()` - Hauptkalkulationsfunktion
    - Alle Objekte durchgehen
    - Für jedes Objekt:
      - Schritt 1: Services mit Unterleistungen holen
      - Schritt 3-6: Mengen berechnen
      - Schritt 5: Faktoren anwenden
      - Schritt 7: Sonderangaben anwenden
      - Schritt 8: Baseline-Zeit berechnen
      - Schritt 9: Effizienz berechnen (wenn Freigabe)
    - Ergebnisse sammeln
    - An Workflow-Service übergeben
    - Finale Ergebnisse zurückgeben

---

## Phase 4: UI-Komponenten

### Schritt 4.1: Basis-Komponenten

#### 4.1.1: Object Selector

- [ ] `src/components/ObjectSelector/ObjectSelector.jsx` erstellen
  - Formular zum Hinzufügen von Objekten
  - Felder:
    - Objektname
    - Objekttyp (Dropdown: Wohnzimmer, Flur, Bad, Treppenhaus, etc.)
    - Grundfläche (m²)
    - Raumhöhe (m)
  - Liste der hinzugefügten Objekte
  - Möglichkeit Objekte zu bearbeiten/löschen

#### 4.1.2: Service Selector

- [ ] `src/components/ServiceSelector/ServiceSelector.jsx` erstellen
  - Dropdown/Checkbox-Liste aller verfügbaren Leistungen
  - Zuordnung zu Objekten
  - Anzeige von Unterleistungen (automatisch angehängt)

#### 4.1.3: Special Notes Component

- [ ] `src/components/SpecialNotes/SpecialNotes.jsx` erstellen
  - Checkbox-Liste für Sonderangaben:
    - Stuck vorhanden
    - Nikotinbelastung
    - Starke Verschmutzung
    - Sprossenfenster
    - Kassettentüren
    - etc.
  - Zuordnung zu Objekten

#### 4.1.4: Customer Approval Component

- [ ] `src/components/CustomerApproval/CustomerApproval.jsx` erstellen
  - Checkbox: "Freigabe für parallele Arbeiten an mehreren Objekten"
  - Erklärung der Auswirkung

### Schritt 4.2: Display-Komponenten

#### 4.2.1: Quantity Display

- [ ] `src/components/QuantityDisplay/QuantityDisplay.jsx` erstellen
  - Zeigt berechnete Mengen je Objekt:
    - Deckenfläche
    - Umfang
    - Wandfläche
    - Angewandte Faktoren

#### 4.2.2: Efficiency Display

- [ ] `src/components/EfficiencyDisplay/EfficiencyDisplay.jsx` erstellen
  - Zeigt angewandte Effizienzen
  - Erklärung warum Effizienz angewendet wurde
  - Effizienzfaktor anzeigen

#### 4.2.3: Workflow Timeline

- [ ] `src/components/WorkflowTimeline/WorkflowTimeline.jsx` erstellen
  - Visuelle Darstellung der Tagesplanung
  - Zeigt:
    - Tag 1, Tag 2, etc.
    - Leistungen je Tag
    - Wartezeiten
    - Parallele Arbeiten
    - Mitarbeiteranzahl

#### 4.2.4: Results Display

- [ ] `src/components/ResultsDisplay/ResultsDisplay.jsx` erstellen
  - Hauptkomponente für Ergebnisanzeige
  - Zeigt:
    - Zusammenfassung je Objekt
    - Gesamtübersicht
    - Alle Details (Mengen, Zeiten, Faktoren, etc.)
  - Nutzt andere Display-Komponenten

### Schritt 4.3: Layout-Komponenten

- [ ] `src/components/Layout/Header.jsx` erstellen
- [ ] `src/components/Layout/Sidebar.jsx` erstellen (optional)
- [ ] `src/components/Layout/MainContent.jsx` erstellen

---

## Phase 5: App-Integration

### Schritt 5.1: App.jsx Struktur

- [ ] `src/App.jsx` erstellen/anpassen
  - Layout-Komponenten einbinden
  - Eingabe-Komponenten einbinden
  - Display-Komponenten einbinden
  - Navigation/Stepper (optional)

### Schritt 5.2: Berechnungs-Trigger

- [ ] useEffect Hook in App.jsx
  - Wacht auf Änderungen in objects, settings
  - Ruft `performCalculation()` auf
  - Speichert Ergebnisse im Store

### Schritt 5.3: Export-Funktionalität

- [ ] `src/services/exportService.js` erstellen
  - `exportToCSV(results)` - CSV-Export
  - `exportToJSON(results)` - JSON-Export
- [ ] Export-Button in ResultsDisplay einbauen

---

## Phase 6: Testdaten und Onboarding-Simulation

### Schritt 6.1: Mock-Daten erstellen

- [ ] `src/data/mockSettings.js` erstellen
  - Beispiel-Leistungskatalog
  - Beispiel-Faktoren
  - Beispiel-Einstellungen
- [ ] `src/data/mockObjects.js` erstellen
  - Beispiel-Objekte für Tests

### Schritt 6.2: Settings-Loader

- [ ] `src/services/settingsLoader.js` erstellen
  - Lädt Settings aus JSON-Datei
  - Oder aus API (später)
  - Speichert im Settings-Slice

### Schritt 6.3: Initialisierung

- [ ] Settings beim App-Start laden
- [ ] Mock-Daten für Entwicklung bereitstellen

---

## Phase 7: Styling und UX

### Schritt 7.1: Basis-Styling

- [ ] CSS-Module oder Styled-Components einrichten
- [ ] Responsive Design
- [ ] Grundlegende UI-Komponenten stylen

### Schritt 7.2: Form-Validierung

- [ ] Eingabe-Validierung für alle Formulare
- [ ] Fehlermeldungen anzeigen
- [ ] Required-Felder markieren

### Schritt 7.3: Loading States

- [ ] Loading-Indikatoren während Berechnung
- [ ] Disabled States für Buttons während Berechnung

### Schritt 7.4: Error Handling

- [ ] Error Boundaries einrichten
- [ ] Fehlermeldungen für Benutzer
- [ ] Console-Logging für Entwicklung

---

## Phase 8: Testing und Optimierung

### Schritt 8.1: Manuelle Tests

- [ ] Alle 12 Schritte manuell testen
- [ ] Verschiedene Objekttypen testen
- [ ] Verschiedene Leistungskombinationen testen
- [ ] Edge Cases testen (leere Eingaben, extreme Werte)

### Schritt 8.2: Berechnungsvalidierung

- [ ] Ergebnisse mit Excel-Vorlage vergleichen
- [ ] Alle Formeln verifizieren
- [ ] Faktoren korrekt anwenden

### Schritt 8.3: Performance-Optimierung

- [ ] React.memo für teure Komponenten
- [ ] useMemo/useCallback wo nötig
- [ ] Redux-Selectors optimieren

### Schritt 8.4: Code-Review

- [ ] Code auf Konsistenz prüfen
- [ ] Kommentare ergänzen
- [ ] Unused Code entfernen

---

## Phase 9: Dokumentation und Deployment

### Schritt 9.1: Code-Dokumentation

- [ ] JSDoc-Kommentare für alle Services
- [ ] README.md mit Setup-Anleitung
- [ ] Kommentare in komplexen Funktionen

### Schritt 9.2: Build

- [ ] Production Build erstellen: `npm run build`
- [ ] Build testen: `npm run preview`

### Schritt 9.3: Deployment-Vorbereitung

- [ ] Environment-Variablen konfigurieren
- [ ] API-Endpoints vorbereiten (falls nötig)
- [ ] Deployment-Strategie festlegen

---

## Detaillierte Implementierungsreihenfolge (Tagesplan)

### Tag 1: Setup und Redux

- Phase 1 komplett
- Phase 2 komplett
- Basis-Tests der Store-Struktur

### Tag 2: Services - Berechnungslogik

- Phase 3 komplett
- Alle Services implementieren
- Unit-Tests für Formeln

### Tag 3: UI-Komponenten - Eingabe

- Phase 4.1 komplett
- ObjectSelector
- ServiceSelector
- SpecialNotes
- CustomerApproval

### Tag 4: UI-Komponenten - Anzeige

- Phase 4.2 komplett
- QuantityDisplay
- EfficiencyDisplay
- WorkflowTimeline
- ResultsDisplay

### Tag 5: Integration und Styling

- Phase 5 komplett
- Phase 6 komplett
- Phase 7.1 und 7.2

### Tag 6: Testing und Feinschliff

- Phase 7.3 und 7.4
- Phase 8 komplett
- Bug-Fixes

### Tag 7: Finalisierung

- Phase 9 komplett
- Finale Tests
- Deployment

---

## Wichtige Hinweise

1. **Schritt-für-Schritt vorgehen:** Jeden Schritt einzeln implementieren und testen
2. **Redux DevTools:** Während Entwicklung nutzen für Debugging
3. **Konsistenz:** Alle Berechnungen müssen mit Excel-Vorlage übereinstimmen
4. **Erweiterbarkeit:** Code so strukturieren, dass später API-Integration einfach ist
5. **Performance:** Bei vielen Objekten/Leistungen auf Performance achten

---

## Checkliste für jeden Service

Für jeden Service sollte folgendes implementiert werden:

- [ ] Funktion implementiert
- [ ] Kommentare/ Dokumentation
- [ ] Edge Cases behandelt
- [ ] Mit Testdaten getestet
- [ ] Integration in Hauptberechnung getestet

---

## Nächste Schritte nach Implementierung

1. API-Integration für Settings (Onboarding-Daten)
2. Backend-Integration für Datenspeicherung
3. Erweiterte Export-Funktionen (PDF)
4. Benutzer-Authentifizierung (falls nötig)
5. Multi-Tenant-Support (falls nötig)
