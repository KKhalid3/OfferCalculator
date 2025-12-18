/**
 * ============================================================================
 * WORKFLOW SERVICE
 * ============================================================================
 * 
 * Zentrale Schnittstelle für die Workflow-Planung.
 * 
 * Diese Datei dient als Wrapper und exportiert alle Funktionen aus den
 * spezialisierten Modulen im workflow/ Ordner.
 * 
 * ARCHITEKTUR:
 * 
 * src/services/workflow/
 * ├── index.js                 - Haupt-Export
 * ├── constants.js             - Konstanten
 * ├── employeeCalculation.js   - MA-Berechnung
 * ├── taskPreparation.js       - Task-Vorbereitung
 * ├── dryingRules.js           - Trocknungsregeln
 * ├── sequentialPlanning.js    - Planung OHNE Parallelarbeit
 * ├── parallelPlanning.js      - Planung MIT Parallelarbeit
 * └── dayHelpers.js            - Hilfsfunktionen
 * 
 * PLANUNGSMODI:
 * 
 * 1. SEQUENZIELL (customerApproval = false):
 *    - Nur 1 MA gleichzeitig vor Ort
 *    - Projektdauer = Basisdauer (Arbeitszeit / 8h)
 * 
 * 2. PARALLEL (customerApproval = true):
 *    - Mehrere MA können gleichzeitig arbeiten
 *    - Projektdauer wird durch Parallelarbeit verkürzt
 * 
 * MITARBEITER-REGEL:
 * 
 * | Projektdauer | → Mitarbeiter |
 * |--------------|---------------|
 * | 1-4 Tage     | 1 MA          |
 * | 5-9 Tage     | 2 MA          |
 * | 10-14 Tage   | 3 MA          |
 * | 15-19 Tage   | 4 MA          |
 * | usw.         |               |
 */

// Re-Export aller Funktionen aus dem workflow/ Modul
export {
  // Hauptfunktionen
  planWorkflow,
  planWorkflowOptimized,
  planSequential,
  planParallel,
  
  // MA-Berechnung
  calculateOptimalEmployeesAdvanced,
  calculateOptimalEmployees,
  calculateEmployeesByBaselineRule,
  getBaselineRangeForEmployees,
  findValidEmployeeConfiguration,
  
  // Task-Funktionen
  sortServicesByWorkflow,
  checkWaitTimesAndParallelWork
} from './workflow/index';
