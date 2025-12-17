import { calculateBaselineTime } from '../utils/formulas';
import { databaseService } from './databaseService';

/**
 * Schritt 8: Baseline-Zeit heranziehen
 * 
 * Verwendet die Konfiguration aus dem Onboarding:
 * - standardValuePerUnit: Zeit pro Einheit in Minuten (bevorzugt)
 * - Fallback: standardTime / standardQuantity (für alte Daten)
 * - minTime: Mindestzeit pro Leistung
 */
export async function getBaselineTime(serviceId, quantity) {
  const service = await databaseService.getServiceById(serviceId);
  if (!service) {
    console.warn(`Service ${serviceId} nicht gefunden`);
    return 0;
  }

  let baseTime = 0;

  // PRIORITÄT 1: standardValuePerUnit aus Onboarding verwenden
  if (service.standardValuePerUnit && service.standardValuePerUnit > 0) {
    baseTime = service.standardValuePerUnit * quantity;
    console.log(`⏱️ ${service.title}: ${service.standardValuePerUnit} min/Einheit × ${quantity} = ${baseTime.toFixed(2)} min`);
  }
  // FALLBACK: standardTime / standardQuantity berechnen
  else if (service.standardTime && service.standardQuantity && service.standardQuantity > 0) {
    baseTime = calculateBaselineTime(
      service.standardTime,
      service.standardQuantity,
      quantity
    );
    console.log(`⏱️ ${service.title}: (${service.standardTime} min / ${service.standardQuantity}) × ${quantity} = ${baseTime.toFixed(2)} min (Fallback)`);
  }
  // Keine Zeitwerte vorhanden
  else {
    console.warn(`⚠️ ${service.title}: Keine Zeitwerte konfiguriert (standardValuePerUnit oder standardTime/standardQuantity)`);
    return 0;
  }

  // MINDESTZEIT wird NACH der Tagesplanung angewendet (siehe calculationService.js)
  // Die Mindestzeit wird nur angewendet, wenn am selben Tag keine weitere Leistung ausgeführt wird
  // bzw. die Leistungen an einem Tag zusammengefasst die Mindestzeit nicht überschreiten

  return baseTime;
}

/**
 * Gibt die Wartezeit für eine Leistung zurück (für Workflow-Planung)
 */
export async function getWaitTime(serviceId) {
  const service = await databaseService.getServiceById(serviceId);
  if (!service) return 0;

  return service.waitTime || 0;
}

