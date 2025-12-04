# Dokumentation: Kalkulationslogik für Malerleistungen

## Einleitung

Diese Dokumentation beschreibt die vollständige Kalkulationslogik für die Berechnung von Malerleistungen. Die Anwendung basiert auf einem 12-stufigen Berechnungsprozess, der alle relevanten Faktoren berücksichtigt und eine präzise Zeit- und Kostenkalkulation ermöglicht.

## Übersicht der Berechnungsschritte

Die Kalkulation erfolgt in 12 aufeinander aufbauenden Schritten, die sicherstellen, dass alle Aspekte einer Malerleistung korrekt erfasst und berechnet werden:

1. **Leistungserfassung** - Auswahl und Prüfung von Haupt- und Unterleistungen
2. _(Schritt 2 ist in der Excel nicht definiert)_
3. **Mengenberechnung Decke** - Berechnung der Deckenfläche je Raum
4. **Mengenberechnung Umfang** - Berechnung des Raumumfangs
5. **Objekttyp-Faktoren** - Anwendung von Mengen- und Leistungsfaktoren
6. **Mengenberechnung Wände** - Berechnung der Wandflächen
7. **Sonderangaben** - Berücksichtigung von Erschwernissen und Sonderfällen
8. **Baseline-Zeit** - Heranziehung der Standardkalkulationszeit
9. **Effizienzgrad** - Berechnung von Effizienzsteigerungen bei größeren Mengen
10. **Kundenfreigabe** - Prüfung der Freigabe für parallele Arbeiten
11. **Warte- und Trocknungszeiten** - Planung von Trocknungszeiten und Parallelarbeit
12. **Workflow-Sortierung** - Anordnung der Leistungen nach Arbeitsablauf
13. **Mehrpersonal** - Optimale Personalplanung
14. **Ausgabe** - Zusammenfassung aller Ergebnisse

---

## Detaillierte Beschreibung der Berechnungsschritte

### Schritt 1: Leistungserfassung und Prüfung auf Unterleistungen

**Ziel:** Alle ausgewählten Leistungen inklusive ihrer automatisch angehängten Unterleistungen erfassen.

**Beschreibung:**
Zu Beginn der Kalkulation werden alle vom Kunden ausgewählten Hauptleistungen erfasst. Für jede Hauptleistung wird automatisch geprüft, ob dieser Leistung Unterleistungen zugeordnet sind, die zwingend mit ausgeführt werden müssen.

**Beispiel:**

- Wird die Leistung "Überholungsanstrich" ausgewählt, wird automatisch die Unterleistung "Abdecken" hinzugefügt
- Weitere mögliche Unterleistungen können sein: "Dübellöcher verschließen", "Stuck reparieren" etc.

**Auswirkung:**

- Alle Leistungen (Haupt- und Unterleistungen) werden in die weitere Berechnung einbezogen
- Jede Leistung wird individuell kalkuliert, auch wenn sie als Unterleistung angehängt wurde

**Quelle:** Angabe Verbraucher Shop

---

### Schritt 3: Mengenberechnung Decke je Raum

**Ziel:** Berechnung der zu bearbeitenden Deckenfläche für jeden Raum.

**Beschreibung:**
Die Deckenfläche wird direkt aus der vom Kunden angegebenen Grundfläche des Raumes übernommen. Es erfolgt eine 1:1-Übernahme der Quadratmeterangabe.

**Formel:**

```
Deckenfläche = Grundfläche des Raumes (in m²)
```

**Beispiel:**

- Ein Raum mit 20 m² Grundfläche hat eine Deckenfläche von 20 m²

**Auswirkung:**

- Bestimmt die zu kalkulierende Menge für alle deckenbezogenen Leistungen
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Angabe Verbraucher Shop

---

### Schritt 4: Mengenberechnung Raumumfang je Raum

**Ziel:** Berechnung des Umfangs eines Raumes für die spätere Wandflächenberechnung.

**Beschreibung:**
Der Umfang eines Raumes wird aus der Grundfläche berechnet, indem die Quadratwurzel der Grundfläche gezogen und mit 4 multipliziert wird. Diese Formel basiert auf der Annahme eines quadratischen Grundrisses als Näherungswert.

**Formel:**

```
Umfang = 4 × √(Grundfläche in m²)
```

**Beispiel:**

- Ein Raum mit 25 m² Grundfläche: Umfang = 4 × √25 = 4 × 5 = 20 m

**Auswirkung:**

- Basis für die Berechnung der Wandflächen
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Admin SE

---

### Schritt 5: Prüfung auf Objekttyp mit Faktoren

**Ziel:** Anwendung von Mengen- und Leistungsfaktoren basierend auf dem Objekttyp.

**Beschreibung:**
Jeder Objekttyp (z.B. Wohnzimmer, Flur, Bad, Treppenhaus) kann mit spezifischen Faktoren belegt sein, die sich auf zwei verschiedene Aspekte beziehen können:

1. **Mengenfaktor:** Beeinflusst die berechnete Menge (z.B. L-förmiger Grundriss oder Flur haben einen Faktor > 1, da mehr Wandfläche entsteht)
2. **Leistungsfaktor:** Beeinflusst den Schwierigkeitsgrad der Arbeit (z.B. Bad oder Treppenhaus haben einen Faktor > 1 wegen schwierigerer Arbeitsbedingungen)

**Wichtige Unterscheidung:**

- **Mengenfaktor:** Wird auf die berechneten Mengen (Umfang, Flächen) angewendet
- **Leistungsfaktor:** Wird auf die Zeit für die Leistungserbringung angewendet

**Beispiele:**

- **Wohnzimmer (Quadrat):** Mengenfaktor = 1, Leistungsfaktor = 1
- **Flur:** Mengenfaktor > 1 (mehr Wandfläche), Leistungsfaktor = 1
- **Bad:** Mengenfaktor = 1, Leistungsfaktor > 1 (schwierigere Arbeit wegen Installationen)
- **Treppenhaus:** Mengenfaktor = 1, Leistungsfaktor > 1 (schwierigere Arbeit)

**Anwendung:**
Falls ein Objekttyp sowohl einen Mengenfaktor als auch einen Leistungsfaktor hat, werden beide nacheinander angewendet:

1. Zuerst wird der Mengenfaktor auf die berechneten Mengen angewendet
2. Dann wird der Leistungsfaktor auf die Zeit für die Leistungserbringung angewendet

**Auswirkung:**

- Korrigiert die Mengenberechnung für unregelmäßige Grundrisse
- Berücksichtigt unterschiedliche Schwierigkeitsgrade je nach Objekttyp
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Admin SE und Onboarding

---

### Schritt 6: Mengenberechnung der Wandflächen je Raum

**Ziel:** Berechnung der zu bearbeitenden Wandfläche für jeden Raum.

**Beschreibung:**
Die Wandfläche wird berechnet, indem der (ggf. durch Mengenfaktoren angepasste) Umfang mit der Raumhöhe multipliziert wird. Aktuell werden Bauteile wie Fenster oder Türen nicht von der Menge abgezogen.

**Formel:**

```
Wandfläche = Umfang × Raumhöhe
```

**Hinweis zur Genauigkeit:**
Falls eine hohe Genauigkeit gefordert wird, könnten getrennt betrachtete Flächengrößen über 2,5 m² abgezogen werden. In diesem Fall müssten jedoch sämtliche Flächen der Bauteile (Fenster, Türen) in die Position "Abdecken" mit einbezogen werden.

**Beispiel:**

- Umfang: 20 m, Raumhöhe: 2,5 m → Wandfläche = 20 × 2,5 = 50 m²

**Auswirkung:**

- Bestimmt die zu kalkulierende Menge für alle wandbezogenen Leistungen
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Admin SE und Angabe Verbraucher Shop

---

### Schritt 7: Prüfung auf Sonderangaben zu Objekt

**Ziel:** Berücksichtigung von Erschwernissen und Sonderfällen, die die Arbeitszeit beeinflussen.

**Beschreibung:**
Zu jedem Objekt können Sonderangaben gemacht werden, die den Schwierigkeitsgrad der Arbeit erhöhen. Diese Sonderangaben werden mit einem Erschwernisfaktor multipliziert, der im Onboarding durch das Unternehmen festgelegt wurde.

**Beispiele für Sonderangaben:**

- **Stuck an der Decke:** Erhöhter Zeitaufwand für die Bearbeitung
- **Nikotinbelastung:** Erschwerte Vorbereitung der Oberfläche (Faktor z.B. 1,8)
- **Vergraute/verschmutzte Oberfläche:** Erhöhter Reinigungsaufwand (Faktor z.B. 1,45)
- **Getönter Untergrund:** Bei Überholungsanstrich erforderlich
- **Sprossenfenster:** Erhöhter Zeitaufwand für Fensterlackierung (100% Zuschlag auf flächenbezogene Leistungen)
- **Kassettentüren:** Erhöhter Zeitaufwand (90% Zuschlag)
- **Stuck/Profilflächen:** 25% Zuschlag auf flächenbezogene Leistungen

**Anwendung:**
Der Erschwernisfaktor wird mit der kalkulierten Zeit für die betroffene Leistung multipliziert.

**Formel:**

```
Angepasste Zeit = Basis-Zeit × Erschwernisfaktor
```

**Auswirkung:**

- Erhöht die kalkulierte Zeit für betroffene Leistungen
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Onboarding und Angabe Verbraucher Shop

---

### Schritt 8: Baseline-Zeit heranziehen

**Ziel:** Verwendung der Standardkalkulationszeit als Basis für die Zeitberechnung.

**Beschreibung:**
Jede Leistung hat eine Baseline-Zeit, die sich auf einen individuell definierten Standardfall bezieht. Dieser Standardfall wird im Onboarding durch das Unternehmen festgelegt.

**Beispiel für Standardfall:**

- Ein Zimmer mit 40 m² zu streichender Fläche (Decke + Wände)
- Ein Mitarbeiter benötigt dafür 3 Stunden
- Baseline-Zeit = 3 Stunden ÷ 40 m² = 0,075 Stunden/m²

**Alternative Standardfälle:**

- 2 Zimmer mit insgesamt 100 m², benötigen 5 Stunden
- Baseline-Zeit = 5 Stunden ÷ 100 m² = 0,05 Stunden/m²

**Wichtig:**
Der Standardfall kann von Betrieb zu Betrieb unterschiedlich sein. Wichtig ist nur, dass eine konsistente Standardkalkulation festgelegt wird.

**Berechnung:**

```
Baseline-Zeit je Einheit = Standard-Zeit ÷ Standard-Menge
```

**Anwendung:**
Die Baseline-Zeit wird mit der zu kalkulierenden Menge multipliziert, um die Basis-Arbeitszeit zu erhalten.

**Auswirkung:**

- Legt die Grundlage für alle Zeitberechnungen fest
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Onboarding Leistung

---

### Schritt 9: Effizienzgrad linear identifizieren

**Ziel:** Berechnung von Effizienzsteigerungen bei größeren Mengen.

**Beschreibung:**
Ab einer bestimmten Menge (Effektivitätsmenge) wird eine Leistung effizienter ausgeführt als im Standardfall. Diese Effizienz steigt linear mit der Menge, bis eine Grenzeffektivität erreicht ist.

**Effektivitätsmenge:**

- Ab dieser Menge beginnt die Effizienzsteigerung
- Beispiel: Ab dem 2. Raum mit 15 m² Grundfläche (ca. 50 m² Decken- und Wandfläche) wird eine erhöhte Effizienz erkannt

**Lineare Steigerung:**

- Die Effizienz steigt linear mit jeder weiteren Effektivitätsmenge
- Beispiel: 1. Effektivitätsmenge (50 m²) → erste Effizienzsteigerung
- 2. Effektivitätsmenge (100 m²) → weitere Effizienzsteigerung
- 3. Effektivitätsmenge (150 m²) → weitere Effizienzsteigerung

**Grenzeffektivität:**

- Nach oben begrenzende Grenze, die aus dem Onboarding generiert wird
- Frage im Onboarding: "Wie viele Einheiten schafft ein Mitarbeiter am Tag (8 Stunden)?"
- Beispiel: Ein Mitarbeiter schafft 150 m² Decken und Wände am Tag
- Grenzeffektivität = 8 Stunden ÷ 150 m² = 0,0533 Stunden/m²

**Tagesgrenze:**

- Sobald die benötigte Zeit + die vorweg benötigte Zeit für eine zuvor benötigte Leistung den Arbeitstag (8 Stunden) überschreitet, endet der Tag
- Die Zeitwerte fließen in den nächsten Tag

**Auswirkung:**

- Reduziert die kalkulierte Zeit bei größeren Mengen
- Fließt in Preis- und Zeitrahmen ein
- Wichtig: Effizienzen können nur bei Freigabe durch den Kunden greifen (siehe Schritt 10)

**Quelle:** Onboarding Leistung

---

### Schritt 10: Effizienz - Kundenfreigabe erteilt?

**Ziel:** Prüfung, ob der Kunde die Freigabe für parallele Arbeiten an mehreren Objekten erteilt hat.

**Beschreibung:**
Damit die beschriebenen Effizienzen (Schritt 9) greifen können, muss der Kunde im Shop angegeben haben, dass gleichzeitig an mehreren Objekten mit der gleichen Leistung gearbeitet werden kann.

**Wichtig:**

- **Ohne Freigabe:** Effizienzen können nicht freigesetzt werden
- **Mit Freigabe:** Effizienzen können angewendet werden, wenn mehrere Objekte gleichzeitig bearbeitet werden

**Hinweis:**
Das Mischen von verschiedenen Leistungen hilft nicht bei der Effizienzsteigerung einer einzelnen Leistung. Es ermöglicht jedoch, den Gesamtzeitrahmen zu kürzen.

**Auswirkung:**

- Bestimmt, ob Effizienzen angewendet werden können
- Fließt in Preis- und Zeitrahmen ein

**Quelle:** Angabe Verbraucher im Shop

---

### Schritt 11: Warte-/Trocknungszeiten prüfen und Parallelarbeit

**Ziel:** Planung von Trocknungszeiten und Prüfung, welche Leistungen parallel ausgeführt werden können.

**Beschreibung:**
Für bestimmte Leistungen sind Warte- oder Trocknungszeiten vorgesehen. Während dieser Zeiten müssen andere Arbeiten geplant werden, die nicht die Trocknung beeinträchtigen.

**Beispiel für inkompatible Arbeiten:**

- Nach dem Lackieren einer Tür (6 Stunden Arbeit) muss diese trocknen (12 Stunden)
- Während der Trocknung darf im gleichen Raum nicht geschliffen werden, da Staub sich in der feuchten Lackierung festsetzen könnte
- Die Arbeit für diesen Tag ist beendet und kann erst nach Trocknung am nächsten Tag fortgesetzt werden

**Beispiel für kompatible Arbeiten:**

- Wenn Leistungen gegenseitig zur Parallelarbeit freigeschaltet sind, können sie während der Trocknungsphase der ersten Leistung ausgeführt werden
- Beispiel: Abdecken des Bodens bedarf keiner Wartezeit für das nachfolgende Streichen

**Räumliche Trennung:**

- Leistungen in verschiedenen Räumen greifen nicht in die Trocknungszeiten des anderen Raumes ein
- Beispiel: Ein Fenster kann in Raum A geschliffen werden, während in Raum B noch ein Fenster nach der Lackierung trocknet

**Auswirkung:**

- Bestimmt die zeitliche Abfolge der Arbeiten
- Fließt in den Zeitrahmen ein
- Kann die Anzahl der benötigten Arbeitstage erhöhen

**Quelle:** Onboarding

---

### Schritt 12: Sortierung je Raum nach Abfolge/Workflow der Leistungen

**Ziel:** Anordnung der Leistungen in der richtigen Reihenfolge gemäß Arbeitsablauf.

**Beschreibung:**
Im Onboarding ist für jede Leistung angegeben, welche Leistungen und Unterleistungen aufeinander folgen sollen/können/dürfen. Die vom Kunden ausgewählten Leistungen werden entsprechend dieser Vorgabe sortiert.

**Beispiel für Abfolge:**

1. Abdecken
2. Vorbereitung (Spachteln, Schleifen)
3. Grundierung
4. Anstrich
5. Abdecken entfernen

**Auswirkung:**

- Bestimmt die logische Reihenfolge der Arbeiten
- In Kombination mit Ausführungszeiten und Trocknungszeiten bestimmt es, was an welchen Tagen gearbeitet werden kann
- Fließt in den Zeitrahmen ein

**Quelle:** Onboarding

---

### Schritt 13: Mehrpersonal - Prüfung auf sinnvollen Einsatz

**Ziel:** Optimale Personalplanung ohne Effizienzverlust.

**Beschreibung:**
Es wird geprüft, ob und wie viele zusätzliche Mitarbeiter sinnvoll eingesetzt werden können, ohne dass die Effizienz der Leistungen reduziert wird.

**Voraussetzungen für Mehrpersonal:**

- Unterschiedliche Leistungen können parallel ausgeführt werden
- Unterschiedliche Objekte können parallel bearbeitet werden
- Die Effizienz der Leistungen wird durch den Mehreinsatz nicht reduziert

**Beispiel für sinnvollen Einsatz:**

- 3 Räume mit insgesamt 150 m² benötigen 32 Stunden
- Mit 2 Mitarbeitern: 32h ÷ 2 = 16h pro Mitarbeiter (maximale Effizienz weiterhin gegeben)
- Mit 3 Mitarbeitern: 32h ÷ 3 = 10,67h pro Mitarbeiter (maximale Effizienz nur noch für 1 Tag gegeben, da 10,67 - 8 = 2,67h Rest)

**Beispiel für nicht sinnvollen Einsatz:**

- Eine Leistung, die normalerweise knapp einen Tag (7 Stunden) braucht
- Durch 2 Mitarbeiter würde sie nur noch 3,5 Stunden brauchen
- Der Rest des Tages bleibt unproduktiv → erhöhte Kosten für den Handwerksunternehmer

**Grenze für Überlegung:**

- Im Onboarding sollte angegeben sein, ab wie vielen Stunden Arbeitsleistung die Überlegung weiteren Personaleinsatzes erlaubt/geplant ist

**Auswirkung:**

- Optimiert die Personalplanung
- Reduziert die Anzahl der benötigten Arbeitstage
- Fließt in den Zeitrahmen ein

**Quelle:** Onboarding

---

### Schritt 14: Ausgabe der Informationen/Inhalte/Zahlen

**Ziel:** Zusammenfassung aller Kalkulationsergebnisse.

**Beschreibung:**
Die Ausgabe erfolgt sowohl je Objekt als auch kumuliert für das gesamte Projekt.

**Inhalt je Objekt:**

- Alle Leistungen mit Herleitung der Flächenberechnungen
- Sonderangaben, deren Faktoren und Auswirkungen
- Welche Effizienz warum gezogen wurde
- Welche Warte- oder Trocknungszeiten sich ausgewirkt haben
- Wie die Abfolge bzw. der Workflow der Leistungen ist
- Welche Objekttypen und damit verbundene verändernde Faktoren angehängt sind

**Inhalt gesamt:**

- Abfolge der Tage
- Wie viele Mitarbeiter Sinn machen
- Wie sich mehr Mitarbeiter auswirken
- Gesamtzeit
- Gesamtkosten (wenn Preise hinterlegt sind)

**Ausgabeformate:**

- Übersichtliche Darstellung im System
- Export als CSV oder JSON möglich
- Optional: PDF-Export für Angebotserstellung

---

## Zusammenfassung des Berechnungsablaufs

1. **Eingabe:** Kunde wählt Objekte und Leistungen im Shop
2. **Leistungserfassung:** System prüft automatisch auf Unterleistungen
3. **Mengenberechnung:** Decke, Umfang, Wände werden berechnet
4. **Faktoren:** Objekttyp-Faktoren werden angewendet
5. **Sonderangaben:** Erschwernisfaktoren werden berücksichtigt
6. **Baseline:** Standardkalkulationszeit wird herangezogen
7. **Effizienz:** Effizienzsteigerungen werden berechnet (wenn Freigabe erteilt)
8. **Workflow:** Trocknungszeiten und Parallelarbeit werden geplant
9. **Personal:** Optimale Personalplanung wird ermittelt
10. **Ausgabe:** Alle Ergebnisse werden zusammengefasst und dargestellt

---

## Technische Anforderungen

- **Plattform:** Web-basierte Anwendung
- **Framework:** React mit Vite
- **State Management:** Redux für zentrale Datenverwaltung
- **Datenstruktur:** Strukturierte Speicherung aller Eingaben und Berechnungsergebnisse
- **Export:** CSV und JSON Format für weitere Verarbeitung

---

## Nächste Schritte

Nach Freigabe dieser Dokumentation erfolgt die detaillierte technische Planung und Umsetzung der Anwendung.
