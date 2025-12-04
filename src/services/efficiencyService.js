import { databaseService } from './databaseService';
import { MINUTES_PER_DAY } from '../constants';

/**
 * Schritt 9: Effizienzgrad berechnen
 * 
 * Verwendet die Konfiguration aus dem Onboarding:
 * - efficiencyStart: Ab welcher Menge Effizienz beginnt
 * - efficiencyCap: Maximale Menge für Effizienz (Deckel)
 * - efficiencyStepPercent: Steigerung pro Schritt in %
 * - maxProductivityPerDay: Maximale Einheiten pro Tag
 */
export async function calculateEfficiency(serviceId, totalQuantity, customerApproval) {
  // Schritt 10: Nur wenn Kundenfreigabe erteilt
  if (!customerApproval) {
    console.log(`📈 Effizienz: Keine Kundenfreigabe → Faktor 1.0`);
    return 1;
  }
  
  const service = await databaseService.getServiceById(serviceId);
  if (!service) return 1;
  
  const {
    efficiencyStart,
    efficiencyCap,
    efficiencyStepPercent,
    maxProductivityPerDay
  } = service;
  
  // Keine Effizienz-Einstellungen aus Onboarding
  if (!efficiencyStart || efficiencyStart <= 0) {
    console.log(`📈 ${service.title}: Keine Effizienz-Konfiguration (efficiencyStart nicht gesetzt)`);
    return 1;
  }
  
  if (!maxProductivityPerDay || maxProductivityPerDay <= 0) {
    console.log(`📈 ${service.title}: Keine Effizienz-Konfiguration (maxProductivityPerDay nicht gesetzt)`);
    return 1;
  }
  
  // Unter Effektivitätsmenge: keine Effizienz
  if (totalQuantity < efficiencyStart) {
    console.log(`📈 ${service.title}: Menge ${totalQuantity} < Start ${efficiencyStart} → Faktor 1.0`);
    return 1;
  }
  
  // Grenzeffektivität berechnen
  const timePerUnitAtMax = MINUTES_PER_DAY / maxProductivityPerDay;
  
  // Lineare Steigerung
  const stepPercent = efficiencyStepPercent || 1;
  const stepSize = efficiencyStart * (stepPercent / 100);
  const efficiencySteps = stepSize > 0 ? Math.floor((totalQuantity - efficiencyStart) / stepSize) : 0;
  const efficiency = 1 + (efficiencySteps * (stepPercent / 100));
  
  // Deckelung bei efficiencyCap
  let cappedEfficiency = efficiency;
  if (efficiencyCap && efficiencyCap > 0 && totalQuantity > efficiencyCap) {
    // Bei Überschreitung der Cap-Menge, maximale Effizienz verwenden
    const maxSteps = stepSize > 0 ? Math.floor((efficiencyCap - efficiencyStart) / stepSize) : 0;
    cappedEfficiency = 1 + (maxSteps * (stepPercent / 100));
    console.log(`📈 ${service.title}: Menge ${totalQuantity} > Cap ${efficiencyCap} → gedeckelt`);
  }
  
  // Mindestens Grenzeffektivität
  const finalEfficiency = Math.max(cappedEfficiency, timePerUnitAtMax);
  
  console.log(`📈 ${service.title}: Effizienz berechnet → Faktor ${finalEfficiency.toFixed(2)} (Menge: ${totalQuantity}, Start: ${efficiencyStart}, Step: ${stepPercent}%)`);
  
  return finalEfficiency;
}

