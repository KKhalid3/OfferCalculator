import { databaseService } from './databaseService';

/**
 * Schritt 7: Sonderangaben-Faktoren anwenden
 */
export async function applySpecialNoteFactors(baseTime, specialNoteIds) {
  if (!specialNoteIds || specialNoteIds.length === 0) {
    return baseTime;
  }

  let multiplier = 1;

  for (const noteId of specialNoteIds) {
    const specialService = await databaseService.getSpecialServiceById(noteId);
    if (specialService && specialService.factor) {
      multiplier *= specialService.factor;
    }
  }

  return baseTime * multiplier;
}

/**
 * Ermittelt die Zusatzleistungen, die durch Sonderangaben aktiviert werden
 * @param {string[]} specialNoteIds - IDs der ausgewählten Sonderangaben
 * @returns {Promise<string[]>} - IDs der zu aktivierenden Zusatzleistungen
 */
export async function getRequiredServicesFromSpecialNotes(specialNoteIds) {
  if (!specialNoteIds || specialNoteIds.length === 0) {
    return [];
  }

  const requiredServiceIds = [];

  for (const noteId of specialNoteIds) {
    const specialService = await databaseService.getSpecialServiceById(noteId);
    if (specialService && specialService.requiredService) {
      // Prüfen ob Service existiert und nicht bereits in der Liste ist
      const service = await databaseService.getServiceById(specialService.requiredService);
      if (service && !requiredServiceIds.includes(specialService.requiredService)) {
        requiredServiceIds.push(specialService.requiredService);
        console.log(`Sonderangabe "${specialService.title}" aktiviert Zusatzleistung: "${service.title}"`);
      }
    }
  }

  // Prioritätslogik: Wenn Isoliergrundierung aktiviert ist, wird der zusätzliche Grundanstrich nicht benötigt
  // Die Isoliergrundierung reicht aus und übernimmt die Funktion des zusätzlichen Grundanstrichs
  const ISOLIERGRUNDIERUNG_ID = 'service_isoliergrundierung';
  const ZUSAETZLICHER_GRUNDANSTRICH_ID = 'service_zusaetzlicher_grundanstrich';

  if (requiredServiceIds.includes(ISOLIERGRUNDIERUNG_ID)) {
    const index = requiredServiceIds.indexOf(ZUSAETZLICHER_GRUNDANSTRICH_ID);
    if (index !== -1) {
      requiredServiceIds.splice(index, 1);
      const zusaetzlicherGrundanstrich = await databaseService.getServiceById(ZUSAETZLICHER_GRUNDANSTRICH_ID);
      console.log(`⚠️ Isoliergrundierung ist aktiviert - "${zusaetzlicherGrundanstrich?.title || ZUSAETZLICHER_GRUNDANSTRICH_ID}" wird nicht hinzugefügt, da Isoliergrundierung bereits ausreicht.`);
    }
  }

  return requiredServiceIds;
}

/**
 * Prüft ob eine Sonderangabe für eine bestimmte Leistung relevant ist
 */
export async function isSpecialNoteRelevantForService(specialNoteId, serviceId) {
  const specialService = await databaseService.getSpecialServiceById(specialNoteId);
  if (!specialService) return false;

  // Wenn keine spezifischen Leistungen definiert, gilt für alle
  if (!specialService.affectsService || specialService.affectsService.length === 0) {
    return true;
  }

  return specialService.affectsService.includes(serviceId);
}

