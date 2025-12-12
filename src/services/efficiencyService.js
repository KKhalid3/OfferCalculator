import { databaseService } from './databaseService';
import { MINUTES_PER_DAY } from '../constants';

/**
 * Schritt 9: Effizienzgrad berechnen MIT Details
 * 
 * WICHTIG: Die totalQuantity sollte KUMULIERT über alle Objekte sein!
 * 
 * Verwendet die Konfiguration aus dem Onboarding:
 * - efficiencyStart: Ab welcher Menge Effizienz beginnt
 * - efficiencyCap: Maximale Menge für Effizienz (Deckel)
 * - efficiencyStepPercent: Steigerung pro Schritt in %
 * - maxProductivityPerDay: Maximale Einheiten pro Tag
 * 
 * @returns {{ efficiency: number, details: object }}
 */
export async function calculateEfficiencyWithDetails(serviceId, totalQuantity, customerApproval) {
  const defaultResult = {
    efficiency: 1,
    details: {
      reason: 'Keine Effizienzsteigerung',
      totalQuantity: totalQuantity,
      stepsCalculated: 0,
      cappedAtLimit: false,
      efficiencyStart: null,
      efficiencyCap: null,
      stepPercent: null,
      maxProductivityPerDay: null
    }
  };

  // Schritt 10: Nur wenn Kundenfreigabe erteilt
  if (!customerApproval) {
    return {
      ...defaultResult,
      details: { ...defaultResult.details, reason: 'Keine Kundenfreigabe erteilt' }
    };
  }

  const service = await databaseService.getServiceById(serviceId);
  if (!service) {
    return {
      ...defaultResult,
      details: { ...defaultResult.details, reason: 'Service nicht gefunden' }
    };
  }

  const {
    efficiencyStart,
    efficiencyCap,
    efficiencyStepPercent,
    maxProductivityPerDay
  } = service;

  // Details für Transparenz
  const details = {
    reason: '',
    totalQuantity: totalQuantity,
    stepsCalculated: 0,
    cappedAtLimit: false,
    efficiencyStart: efficiencyStart || null,
    efficiencyCap: efficiencyCap || null,
    stepPercent: efficiencyStepPercent || null,
    maxProductivityPerDay: maxProductivityPerDay || null
  };

  // Keine Effizienz-Einstellungen aus Onboarding
  if (!efficiencyStart || efficiencyStart <= 0) {
    details.reason = 'Keine Effizienz-Konfiguration (efficiencyStart nicht gesetzt)';
    console.log(`📈 ${service.title}: ${details.reason}`);
    return { efficiency: 1, details };
  }

  if (!maxProductivityPerDay || maxProductivityPerDay <= 0) {
    details.reason = 'Keine Effizienz-Konfiguration (maxProductivityPerDay nicht gesetzt)';
    console.log(`📈 ${service.title}: ${details.reason}`);
    return { efficiency: 1, details };
  }

  // Unter Effektivitätsmenge: keine Effizienz
  if (totalQuantity < efficiencyStart) {
    details.reason = `Menge ${totalQuantity.toFixed(1)} < Start ${efficiencyStart} → keine Effizienz`;
    console.log(`📈 ${service.title}: ${details.reason}`);
    return { efficiency: 1, details };
  }

  // Grenzeffektivität berechnen
  const timePerUnitAtMax = MINUTES_PER_DAY / maxProductivityPerDay;

  // Lineare Steigerung
  const stepPercent = efficiencyStepPercent || 1;
  const stepSize = efficiencyStart * (stepPercent / 100);
  const efficiencySteps = stepSize > 0 ? Math.floor((totalQuantity - efficiencyStart) / stepSize) : 0;
  const efficiency = 1 + (efficiencySteps * (stepPercent / 100));

  details.stepsCalculated = efficiencySteps;

  // Deckelung bei efficiencyCap
  let finalEfficiency = efficiency;
  if (efficiencyCap && efficiencyCap > 0 && totalQuantity > efficiencyCap) {
    // Bei Überschreitung der Cap-Menge, maximale Effizienz verwenden
    const maxSteps = stepSize > 0 ? Math.floor((efficiencyCap - efficiencyStart) / stepSize) : 0;
    finalEfficiency = 1 + (maxSteps * (stepPercent / 100));
    details.cappedAtLimit = true;
    details.stepsCalculated = maxSteps;
    details.reason = `Menge ${totalQuantity.toFixed(1)} > Cap ${efficiencyCap} → Deckel greift bei Effizienz ${finalEfficiency.toFixed(2)}`;
  } else {
    details.reason = `${efficiencySteps} Stufen × ${stepPercent}% = Effizienz ${finalEfficiency.toFixed(2)}`;
  }

  // Mindestens Grenzeffektivität
  const minEfficiency = timePerUnitAtMax > 0 ? 1 : 1;
  finalEfficiency = Math.max(finalEfficiency, minEfficiency);

  console.log(`📈 ${service.title}: Effizienz ${finalEfficiency.toFixed(2)} (Gesamt: ${totalQuantity.toFixed(1)} ${service.unit}, ${details.stepsCalculated} Stufen, Cap: ${details.cappedAtLimit ? 'JA' : 'nein'})`);

  return { efficiency: finalEfficiency, details };
}

/**
 * Einfache Effizienzberechnung (für Rückwärtskompatibilität)
 * @deprecated Verwende calculateEfficiencyWithDetails für mehr Transparenz
 */
export async function calculateEfficiency(serviceId, totalQuantity, customerApproval) {
  const result = await calculateEfficiencyWithDetails(serviceId, totalQuantity, customerApproval);
  return result.efficiency;
}
