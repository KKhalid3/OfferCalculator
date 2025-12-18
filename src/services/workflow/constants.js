/**
 * ============================================================================
 * WORKFLOW KONSTANTEN
 * ============================================================================
 * 
 * Zentrale Konstanten für die Workflow-Planung.
 */

import { HOURS_PER_DAY } from '../../constants';

/**
 * Workflow-Phasen mit Prioritäten für logischen Arbeitsablauf
 * Niedrigere Nummer = früher im Ablauf
 */
export const WORKFLOW_PHASES = {
  'einrichtung': 1,     // Baustelleneinrichtung
  'vorbereitung': 2,    // Abdecken, Schutz
  'abbruch': 3,         // Tapeten entfernen, Abbruch
  'untergrund': 4,      // Spachteln, Schleifen
  'grundierung': 5,     // Grundierungen
  'tapezieren': 6,      // Tapezieren
  'beschichtung': 7,    // Streichen, Anstrich
  'lackierung': 8,      // Türen, Fenster lackieren
  'abschluss': 9        // Aufräumen, Entsorgen
};

/**
 * Tage pro Woche für die Mitarbeiter-Regel
 */
export const DAYS_PER_WEEK = 5;

/**
 * Maximale Mitarbeiteranzahl (Sicherheitslimit)
 */
export const MAX_EMPLOYEES = 20;

/**
 * Standard-Arbeitsstunden pro Tag
 */
export const DEFAULT_DAILY_HOURS = HOURS_PER_DAY;

/**
 * Standard-Mindeststunden pro Mitarbeiter
 */
export const DEFAULT_MIN_HOURS_PER_EMPLOYEE = 6;

/**
 * ============================================================================
 * MITARBEITER-REGEL
 * ============================================================================
 * 
 * Die Regel bestimmt die Mitarbeiteranzahl basierend auf der Projektdauer:
 * 
 * | Projektdauer | → Mitarbeiter |
 * |--------------|---------------|
 * | 1-4 Tage     | 1 MA          |
 * | 5-9 Tage     | 2 MA          |
 * | 10-14 Tage   | 3 MA          |
 * | 15-19 Tage   | 4 MA          |
 * | 20-24 Tage   | 5 MA          |
 * | usw.         |               |
 * 
 * WICHTIG: Diese Regel wird als ZIEL verwendet!
 * Der Algorithmus sucht die Kombination (MA, Tage), bei der die Regel erfüllt ist.
 */
export const EMPLOYEE_RULE = {
  DAYS_PER_BLOCK: 5, // Jeder Block von 5 Tagen erhöht die MA-Anzahl um 1
};
