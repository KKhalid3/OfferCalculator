/**
 * ============================================================================
 * WORKFLOW-PLANUNG - HAUPTMODUL
 * ============================================================================
 * 
 * Zentrale Schnittstelle für die Workflow-Planung.
 * 
 * ZWEI PLANUNGSMODI:
 * 
 * 1. SEQUENZIELL (customerApproval = false):
 *    - Nur 1 MA gleichzeitig vor Ort
 *    - Keine Parallelarbeit in verschiedenen Räumen
 *    - Projektdauer = Basisdauer
 * 
 * 2. PARALLEL (customerApproval = true):
 *    - Mehrere MA können gleichzeitig arbeiten
 *    - Parallelarbeit in verschiedenen Räumen
 *    - Projektdauer wird durch Parallelarbeit verkürzt
 */

import { planSequential } from './sequentialPlanning';
import { planParallel } from './parallelPlanning';
import { 
  calculateOptimalEmployeesAdvanced,
  calculateOptimalEmployees,
  calculateEmployeesByBaselineRule,
  getBaselineRangeForEmployees,
  findValidEmployeeConfiguration
} from './employeeCalculation';
import { sortServicesByWorkflow, checkWaitTimesAndParallelWork } from './taskPreparation';

// Re-Export aller relevanten Funktionen
export {
  // Planungsfunktionen
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
};

/**
 * Hauptfunktion: Plant den Workflow basierend auf customerApproval
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @param {boolean} customerApproval - Kundenfreigabe für Parallelarbeit
 * @returns {Object} Workflow-Planung
 */
export async function planWorkflow(calculations, customerApproval) {
  console.log(`🔄 Workflow-Planung gestartet (Parallelarbeit: ${customerApproval ? 'AN' : 'AUS'})`);
  
  if (customerApproval) {
    return planParallel(calculations);
  } else {
    return planSequential(calculations);
  }
}

/**
 * Optimierte Workflow-Planung (Alias für planWorkflow)
 * Für Abwärtskompatibilität
 */
export async function planWorkflowOptimized(calculations, customerApproval) {
  return planWorkflow(calculations, customerApproval);
}
