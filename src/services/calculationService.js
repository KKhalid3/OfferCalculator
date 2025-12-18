import { calculateObjectQuantities } from './quantityService';
import { getServicesWithSubServices } from './serviceService';
import { getBaselineTime } from './baselineService';
import { applySpecialNoteFactors, getRequiredServicesFromSpecialNotes, isSpecialNoteRelevantForService } from './specialNotesService';
import { calculateEfficiencyWithDetails } from './efficiencyService';
import { planWorkflow } from './workflowService';
import { databaseService } from './databaseService';
import { store } from '../store';
import { setResults } from '../store/slices/calculationsSlice';
import { defaultCompanySettings } from '../database/schemas/companySettingsSchema';
import { WINDOW_SIZES } from '../constants';

/**
 * Wendet die Mindestzeit-Regel nach der Tagesplanung an
 * 
 * Regel: "Mindestzeit wird nur angewendet, wenn am selben Tag keine weitere Leistung ausgeführt wird
 * bzw. die Leistungen an einem Tag zusammengefasst die Mindestzeit nicht überschreiten"
 * 
 * @param {Array} workflowDays - Die geplanten Tage mit Tasks
 * @param {Array} allCalculations - Alle Berechnungen
 * @param {Object} companySettings - Unternehmenseinstellungen
 * @returns {Map} Map von calculationId -> { shouldApplyMinTime: boolean, minTime: number }
 */
async function applyMinimumTimeAfterPlanning(workflowDays, allCalculations, companySettings) {
  const minTimeDecisions = new Map(); // calculationId -> { shouldApplyMinTime: boolean, minTime: number, reason: string }

  // Erstelle eine Map von calculationId -> calculation für schnellen Zugriff
  const calculationsById = new Map();
  for (const calc of allCalculations) {
    calculationsById.set(calc.id, calc);
  }

  // Erstelle eine Map von calculationId -> service für schnellen Zugriff
  const servicesByCalculationId = new Map();
  for (const calc of allCalculations) {
    const service = await databaseService.getServiceById(calc.serviceId);
    if (service) {
      servicesByCalculationId.set(calc.id, service);
    }
  }

  // Für jeden Tag prüfen
  for (const day of workflowDays) {
    if (!day.tasks || day.tasks.length === 0) continue;

    // Sammle alle Calculation-IDs für diesen Tag
    const calculationIdsOnDay = day.tasks.map(t => t.taskId).filter(id => id);

    if (calculationIdsOnDay.length === 0) continue;

    // Prüfe für jede Calculation auf diesem Tag
    for (const calcId of calculationIdsOnDay) {
      const calculation = calculationsById.get(calcId);
      const service = servicesByCalculationId.get(calcId);

      if (!calculation || !service || !service.minTime || service.minTime <= 0) {
        continue; // Keine Mindestzeit für diesen Service
      }

      // Berechne die ursprünglich berechnete Basiszeit (ohne Faktoren, ohne Mindestzeit)
      // Diese wird aus dem Service und der Quantity neu berechnet
      const quantity = calculation.quantity || 1;
      let calculatedBaseTime = 0;

      if (service.standardValuePerUnit && service.standardValuePerUnit > 0) {
        calculatedBaseTime = service.standardValuePerUnit * quantity;
      } else if (service.standardTime && service.standardQuantity && service.standardQuantity > 0) {
        calculatedBaseTime = (service.standardTime / service.standardQuantity) * quantity;
      }

      // Wenn berechnete Zeit bereits >= Mindestzeit, keine Anwendung nötig
      if (calculatedBaseTime >= service.minTime) {
        minTimeDecisions.set(calcId, {
          shouldApplyMinTime: false,
          minTime: service.minTime,
          reason: `Berechnete Zeit (${calculatedBaseTime.toFixed(2)} min) >= Mindestzeit (${service.minTime} min)`
        });
        continue;
      }

      // Prüfe ob nur dieser Service am Tag ist (oder nur Unterleistungen)
      const otherCalculationsOnDay = calculationIdsOnDay.filter(id => id !== calcId);

      // Prüfe ob andere Services Hauptleistungen sind (nicht nur Unterleistungen)
      let hasOtherMainServices = false;
      for (const otherCalcId of otherCalculationsOnDay) {
        const otherCalc = calculationsById.get(otherCalcId);
        const otherService = servicesByCalculationId.get(otherCalcId);

        if (otherCalc && otherService) {
          // Prüfe ob es eine Unterleistung ist (durch Prüfung ob es zu einem Hauptservice gehört)
          // Für jetzt nehmen wir an, dass Unterleistungen durch isSubService markiert sind
          // Da wir das hier nicht direkt haben, prüfen wir ob es andere Services mit unterschiedlichen serviceIds sind
          if (otherService.id !== service.id) {
            hasOtherMainServices = true;
            break;
          }
        }
      }

      // Regel 1: Wenn nur dieser Service am Tag (oder nur Unterleistungen) → Mindestzeit anwenden
      if (!hasOtherMainServices) {
        minTimeDecisions.set(calcId, {
          shouldApplyMinTime: true,
          minTime: service.minTime,
          reason: `Nur dieser Service am Tag (oder nur Unterleistungen)`
        });
        console.log(`⏱️ Mindestzeit angewendet für "${service.title}": ${calculatedBaseTime.toFixed(2)} min → ${service.minTime} min (nur dieser Service am Tag)`);
        continue;
      }

      // Regel 2: Wenn mehrere Services am Tag → Gesamtzeit des Tages prüfen
      // Berechne Gesamtzeit aller Services an diesem Tag
      let totalDayTime = 0;
      for (const dayCalcId of calculationIdsOnDay) {
        const dayCalc = calculationsById.get(dayCalcId);
        if (dayCalc) {
          totalDayTime += dayCalc.finalTime; // finalTime ist die bereits berechnete Zeit
        }
      }

      // Wenn Gesamtzeit < Mindestzeit → Mindestzeit anwenden
      if (totalDayTime < service.minTime) {
        minTimeDecisions.set(calcId, {
          shouldApplyMinTime: true,
          minTime: service.minTime,
          reason: `Gesamtzeit des Tages (${totalDayTime.toFixed(2)} min) < Mindestzeit (${service.minTime} min)`
        });
        console.log(`⏱️ Mindestzeit angewendet für "${service.title}": Gesamtzeit des Tages (${totalDayTime.toFixed(2)} min) < Mindestzeit (${service.minTime} min)`);
      } else {
        minTimeDecisions.set(calcId, {
          shouldApplyMinTime: false,
          minTime: service.minTime,
          reason: `Gesamtzeit des Tages (${totalDayTime.toFixed(2)} min) >= Mindestzeit (${service.minTime} min)`
        });
      }
    }
  }

  return minTimeDecisions;
}

/**
 * Berechnet die Preise basierend auf Zeit, Stundenlohn und Material
 */
function calculatePrice(finalTimeMinutes, quantity, service, companySettings) {
  const settings = companySettings || defaultCompanySettings;

  // Arbeitskosten: Zeit * Stundenlohn
  const hours = finalTimeMinutes / 60;
  const laborCost = hours * settings.laborRate;

  // Materialkosten
  let materialCost = 0;
  if (service.materialType === 'percent' && service.materialValue) {
    // Prozentualer Zuschlag auf Lohnkosten
    materialCost = laborCost * (service.materialValue / 100);
  } else if (service.materialType === 'fixed' && service.materialValue) {
    // Fester Betrag pro Einheit
    materialCost = quantity * service.materialValue;
  }

  return {
    hours,
    laborCost: Math.round(laborCost * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    totalCost: Math.round((laborCost + materialCost) * 100) / 100,
  };
}

/**
 * Bestimmt die Menge für einen Service basierend auf dem Objekt
 * Unterstützt m², Stk (Fenster/Türen) und h
 */
function getQuantityForService(service, object, quantities) {
  // Für Fenster-Objekte: Anzahl aus dem Objekt verwenden
  if (object.objectCategory === 'fenster') {
    if (service.unit === 'Stk' || service.unit === 'Stk (m²)') {
      return object.windowCount || 1;
    }
    return 1;
  }

  // Für Tür-Objekte: Anzahl aus dem Objekt verwenden
  if (object.objectCategory === 'tuer') {
    if (service.unit === 'Stk') {
      return object.doorCount || 1;
    }
    return 1;
  }

  // Für Stück-basierte Services (Fenster, Türen) bei Raum-Objekten
  if (service.unit === 'Stk') {
    return 1; // Standard: 1 Stück pro Objekt (kann später erweitert werden)
  }

  // Für m²-basierte Services
  if (service.unit === 'm²') {
    const hasWalls = service.title.includes('Wand') || service.title.includes('Wände');
    const hasCeiling = service.title.includes('Decke') || service.title.includes('Decken');
    const hasFloor = service.title.includes('Boden');

    if (hasWalls && hasCeiling) {
      return quantities.wallArea + quantities.ceilingArea;
    } else if (hasCeiling) {
      return quantities.ceilingArea;
    } else if (hasFloor) {
      return quantities.ceilingArea; // Boden = Grundfläche
    } else {
      return quantities.wallArea;
    }
  }

  // Standard: 1
  return 1;
}

/**
 * PHASE 1: Sammelt alle Mengen pro Service über ALLE Objekte
 * Dies ermöglicht die kumulierte Effizienzberechnung
 */
async function collectTotalQuantitiesPerService(objects) {
  const serviceQuantities = new Map(); // serviceId -> { totalQuantity, objectBreakdown: [{objectId, quantity}] }

  for (const object of objects) {
    // Mengen für dieses Objekt berechnen
    // Fenster und Türen brauchen keine Flächen, nur Stückzahlen
    const quantities = (object.objectCategory === 'fenster' || object.objectCategory === 'tuer')
      ? { wallArea: 0, ceilingArea: 0, quantityFactor: 1, serviceFactor: 1 }
      : await calculateObjectQuantities(object);

    // Zusatzleistungen aus Sonderangaben
    const additionalServiceIds = await getRequiredServicesFromSpecialNotes(object.specialNotes || []);

    // Alle Service-IDs für dieses Objekt
    const allServiceIds = [...(object.services || [])];
    for (const addId of additionalServiceIds) {
      if (!allServiceIds.includes(addId)) {
        allServiceIds.push(addId);
      }
    }

    // Services mit Unterleistungen sammeln
    const processedServiceIds = new Set();

    for (const serviceId of allServiceIds) {
      const allServices = await getServicesWithSubServices(serviceId);

      for (const service of allServices) {
        if (processedServiceIds.has(service.id)) continue;
        processedServiceIds.add(service.id);

        const quantity = getQuantityForService(service, object, quantities);

        if (!serviceQuantities.has(service.id)) {
          serviceQuantities.set(service.id, {
            totalQuantity: 0,
            objectBreakdown: [],
            service: service
          });
        }

        const entry = serviceQuantities.get(service.id);
        entry.totalQuantity += quantity;
        entry.objectBreakdown.push({
          objectId: object.id,
          objectName: object.name,
          quantity: quantity
        });
      }
    }
  }

  return serviceQuantities;
}

/**
 * Hauptkalkulationsfunktion - führt alle Schritte aus
 * 
 * WICHTIG: Die Effizienz wird KUMULIERT über alle Objekte berechnet!
 * Das bedeutet: Wenn in 3 Räumen je 20m² gestrichen werden, 
 * gilt die Effizienz für 60m² und wird rückwirkend auf alle Räume angewendet.
 */
export async function performCalculation() {
  const state = store.getState();
  const { objects } = state.objects;
  const { customerApproval } = state.settings;

  // Unternehmens-Einstellungen laden
  const companySettings = await databaseService.getCompanySettings() || defaultCompanySettings;
  console.log('Preiskalkulation mit Einstellungen:', companySettings);

  if (!objects || objects.length === 0) {
    return null;
  }

  // Alte Berechnungen löschen
  for (const obj of objects) {
    try {
      await databaseService.deleteCalculationsByObject(obj.id);
    } catch (error) {
      console.warn(`Fehler beim Löschen von Berechnungen für Objekt ${obj.id}:`, error.message);
    }
  }

  // ========================================
  // PHASE 1: Kumulierte Mengen pro Service sammeln
  // ========================================
  console.log('📊 PHASE 1: Sammle kumulierte Mengen pro Service...');
  const serviceQuantities = await collectTotalQuantitiesPerService(objects);

  // ========================================
  // PHASE 2: Effizienz für ALLE Services vorberechnen (mit kumulierten Mengen)
  // ========================================
  console.log('📈 PHASE 2: Berechne Effizienz mit kumulierten Mengen...');
  const efficiencyCache = new Map(); // serviceId -> { efficiency, details }

  for (const [serviceId, data] of serviceQuantities) {
    const efficiencyResult = await calculateEfficiencyWithDetails(
      serviceId,
      data.totalQuantity, // KUMULIERTE Menge über alle Objekte!
      customerApproval
    );

    efficiencyCache.set(serviceId, efficiencyResult);

    console.log(`📈 ${data.service.title}: Gesamt ${data.totalQuantity.toFixed(1)} ${data.service.unit} → Effizienz ${efficiencyResult.efficiency.toFixed(2)} (${efficiencyResult.details.reason})`);
  }

  // ========================================
  // PHASE 3: Eigentliche Berechnung pro Objekt (mit vorberechneter Effizienz)
  // ========================================
  console.log('🧮 PHASE 3: Berechne pro Objekt mit kumulierter Effizienz...');

  const results = {
    objects: [],
    totalTime: 0,
    totalDays: 0,
    totalLaborCost: 0,
    totalMaterialCost: 0,
    totalCost: 0,
    siteSetupCost: 0,
    siteClearanceCost: 0,
  };

  const allCalculations = [];

  for (const object of objects) {
    const objectResult = {
      id: object.id,
      name: object.name,
      type: object.type,
      objectCategory: object.objectCategory || 'raum',
      quantities: {},
      services: [],
      specialNotes: [],
      totalTime: 0,
      totalLaborCost: 0,
      totalMaterialCost: 0,
      totalCost: 0,
    };

    // Mengen berechnen (für Räume)
    // Fenster und Türen brauchen keine Flächen, nur Stückzahlen
    const quantities = (object.objectCategory === 'fenster' || object.objectCategory === 'tuer')
      ? { wallArea: 0, ceilingArea: 0, quantityFactor: 1, serviceFactor: 1, perimeter: 0 }
      : await calculateObjectQuantities(object);
    objectResult.quantities = quantities;

    // Sonderangaben laden
    const additionalServiceIds = await getRequiredServicesFromSpecialNotes(object.specialNotes || []);

    if (object.specialNotes && object.specialNotes.length > 0) {
      for (const noteId of object.specialNotes) {
        const specialService = await databaseService.getSpecialServiceById(noteId);
        if (specialService) {
          objectResult.specialNotes.push({
            id: specialService.id,
            title: specialService.title,
            factor: specialService.factor || 1.0,
            uxDescription: specialService.uxDescription || null,
            requiredService: specialService.requiredService || null,
          });
        }
      }
    }

    // Service-IDs sammeln
    const allServiceIds = [...(object.services || [])];
    for (const addId of additionalServiceIds) {
      if (!allServiceIds.includes(addId)) {
        allServiceIds.push(addId);
      }
    }

    const processedServiceIds = new Set();
    const bundledServiceIds = new Set(); // Services die gebündelt wurden (nicht separat anzeigen)

    for (const serviceId of allServiceIds) {
      const allServices = await getServicesWithSubServices(serviceId);
      const mainService = allServices[0];
      const mainServiceName = mainService?.title || '';

      for (let svcIndex = 0; svcIndex < allServices.length; svcIndex++) {
        const service = allServices[svcIndex];
        const isSubService = svcIndex > 0;

        if (processedServiceIds.has(service.id)) continue;

        // Skip services die bereits gebündelt wurden
        if (bundledServiceIds.has(service.id)) {
          console.log(`⏭️ ${service.title}: Bereits gebündelt, überspringe separate Berechnung`);
          continue;
        }

        processedServiceIds.add(service.id);

        // Menge für DIESES Objekt
        const quantity = getQuantityForService(service, object, quantities);

        // Baseline-Zeit
        let baseTime = await getBaselineTime(service.id, quantity);

        // ========================================
        // GEBÜNDELTE BERECHNUNG (bundleCalculation)
        // ========================================
        // Prüfe ob Unterleistungen mit bundleCalculation=true existieren
        // Deren Zeit wird VOR der Effizienzberechnung addiert
        const bundledServices = [];
        let bundledTimeAdded = 0;

        if (!isSubService) {
          // Finde alle Unterleistungen die zu diesem Service gehören und bundleCalculation haben
          for (let subIdx = 1; subIdx < allServices.length; subIdx++) {
            const subService = allServices[subIdx];
            if (subService.bundleCalculation === true) {
              const subQuantity = getQuantityForService(subService, object, quantities);
              const subBaseTime = await getBaselineTime(subService.id, subQuantity);

              bundledTimeAdded += subBaseTime;
              bundledServices.push({
                id: subService.id,
                title: subService.title,
                time: subBaseTime,
                quantity: subQuantity,
                standardValuePerUnit: subService.standardValuePerUnit
              });

              // Markiere als gebündelt (wird nicht separat verarbeitet)
              bundledServiceIds.add(subService.id);

              console.log(`🔗 Bündelung: "${subService.title}" (${subBaseTime.toFixed(1)} min) → "${service.title}"`);
            }
          }

          if (bundledTimeAdded > 0) {
            console.log(`📦 Kombinierte Zeit für "${service.title}": ${baseTime.toFixed(1)} + ${bundledTimeAdded.toFixed(1)} = ${(baseTime + bundledTimeAdded).toFixed(1)} min`);
            baseTime += bundledTimeAdded;
          }
        }

        // Sonderangaben-Faktoren
        // WICHTIG: Sonderfaktoren werden NUR auf Hauptleistungen angewendet, NICHT auf Unterleistungen
        let specialNoteFactor = 1;
        if (!isSubService) {
          // Nur für Hauptleistungen: Sonderfaktoren anwenden
          for (const noteId of (object.specialNotes || [])) {
            const isRelevant = await isSpecialNoteRelevantForService(noteId, serviceId);
            if (isRelevant) {
              const specialService = await databaseService.getSpecialServiceById(noteId);
              if (specialService && !specialService.requiredService && specialService.factor && specialService.factor !== 1) {
                specialNoteFactor *= specialService.factor;
              }
            }
          }
          baseTime = baseTime * specialNoteFactor;
        } else {
          // Für Unterleistungen: Keine Sonderfaktoren anwenden
          console.log(`🔒 "${service.title}": Unterleistung - Sonderfaktoren werden nicht angewendet`);
        }

        // ========================================
        // OBJEKTSPEZIFISCHE FAKTOREN
        // ========================================
        let objectSpecificFactor = 1;

        // Fenster-Faktoren (nur für Fensterlackierung)
        if (object.objectCategory === 'fenster' && service.id.includes('fensterfluegel')) {
          // Fenstergrößen-Faktor (Klein=1.0, Mittel=1.5, Groß=2.5)
          if (object.windowSize) {
            const windowSizeConfig = WINDOW_SIZES.find(s => s.id === object.windowSize);
            if (windowSizeConfig && windowSizeConfig.timeFactor) {
              objectSpecificFactor *= windowSizeConfig.timeFactor;
              console.log(`🪟 Fenstergrößen-Faktor (${object.windowSize}): ${windowSizeConfig.timeFactor}x`);
            }
          }

          // Sprossenfenster-Faktor (2.5x)
          if (object.hasSprossen) {
            objectSpecificFactor *= 2.5;
            console.log(`⚡ Sprossenfenster-Faktor: 2.5x`);
          }
        }

        // Tür-Faktoren (nur für Türlackierung)
        if (object.objectCategory === 'tuer' && service.id.includes('tuerfluegel')) {
          // Kassettentüren-Faktor (1.5x)
          if (object.hasKassette) {
            objectSpecificFactor *= 1.5;
            console.log(`⚡ Kassettentüren-Faktor: 1.5x`);
          }
        }

        if (objectSpecificFactor !== 1) {
          baseTime = baseTime * objectSpecificFactor;
        }

        // ========================================
        // EFFIZIENZ aus Cache (kumuliert berechnet!)
        // ========================================
        const efficiencyResult = efficiencyCache.get(service.id) || { efficiency: 1, details: {} };
        let efficiency = efficiencyResult.efficiency;
        const efficiencyDetails = efficiencyResult.details;

        // WICHTIG: Effizienz begrenzen, damit Zeit pro Einheit nie unter maxProductivityPerDay-Grenze fällt
        // Die Effizienz darf nicht so hoch sein, dass die Zeit pro Einheit unter das durch
        // maxProductivityPerDay definierte Minimum fällt
        if (service.maxProductivityPerDay && service.maxProductivityPerDay > 0 && quantity > 0) {
          const MINUTES_PER_DAY = 8 * 60; // 480 Minuten
          const timePerUnitAtMax = MINUTES_PER_DAY / service.maxProductivityPerDay;

          // Berechne aktuelle Zeit pro Einheit ohne Effizienz (mit serviceFactor)
          const timePerUnitWithoutEfficiency = (baseTime * quantities.serviceFactor) / quantity;

          // Maximale erlaubte Effizienz: timePerUnit darf nicht unter timePerUnitAtMax fallen
          // finalTime / quantity >= timePerUnitAtMax
          // (baseTime / efficiency * serviceFactor) / quantity >= timePerUnitAtMax
          // baseTime * serviceFactor / (efficiency * quantity) >= timePerUnitAtMax
          // efficiency <= (baseTime * serviceFactor) / (quantity * timePerUnitAtMax)
          const maxAllowedEfficiency = timePerUnitWithoutEfficiency / timePerUnitAtMax;

          if (efficiency > maxAllowedEfficiency) {
            console.log(`⚠️ Effizienz begrenzt für "${service.title}": ${efficiency.toFixed(2)} → ${maxAllowedEfficiency.toFixed(2)} (minTimePerUnit: ${timePerUnitAtMax.toFixed(2)} Min/${service.unit}, maxProductivityPerDay: ${service.maxProductivityPerDay} ${service.unit}/Tag)`);
            efficiency = maxAllowedEfficiency;
            efficiencyDetails.cappedAtMaxProductivity = true;
            efficiencyDetails.maxAllowedEfficiency = maxAllowedEfficiency;
            efficiencyDetails.timePerUnitAtMax = timePerUnitAtMax;
          }
        }

        const finalTime = (baseTime / efficiency) * quantities.serviceFactor;

        // Preisberechnung
        const pricing = calculatePrice(finalTime, quantity, service, companySettings);

        // In DB speichern
        const calculation = await databaseService.saveCalculation({
          objectId: object.id,
          serviceId: service.id,
          quantity,
          quantityType: service.unit === 'Stk' ? 'pieces' : (service.title.includes('Decke') ? 'ceiling' : 'walls'),
          baseTime,
          efficiency,
          finalTime,
          laborCost: pricing.laborCost,
          materialCost: pricing.materialCost,
          totalCost: pricing.totalCost,
          factors: {
            quantityFactor: quantities.quantityFactor,
            serviceFactor: quantities.serviceFactor,
            specialNoteFactor: specialNoteFactor,
            objectSpecificFactor: objectSpecificFactor
          },
          specialNotes: object.specialNotes || []
        });

        // Objektinformationen für Workflow-Planung hinzufügen
        allCalculations.push({
          ...calculation,
          objectName: object.name,
          objectType: object.objectCategory || '',
          serviceName: service.title,
          unit: service.unit || ''
        });

        const isFromSpecialNote = additionalServiceIds.includes(service.id);

        // Mindestzeit-Check
        const calculatedBaseTime = service.standardValuePerUnit
          ? service.standardValuePerUnit * quantity
          : (service.standardTime && service.standardQuantity
            ? (service.standardTime / service.standardQuantity) * quantity
            : 0);
        const minTimeApplied = service.minTime && service.minTime > 0 && calculatedBaseTime < service.minTime;

        // Service-Ergebnis mit allen Details
        objectResult.services.push({
          serviceId: service.id,
          serviceName: service.title,
          quantity,
          unit: service.unit,
          baseTime,
          efficiency,
          finalTime,
          serviceFactor: quantities.serviceFactor,
          specialNoteFactor: specialNoteFactor !== 1 ? specialNoteFactor : null,
          isFromSpecialNote,
          isSubService,
          parentServiceName: isSubService ? mainServiceName : null,
          // Preisfelder
          hours: pricing.hours,
          laborCost: pricing.laborCost,
          materialCost: pricing.materialCost,
          totalCost: pricing.totalCost,
          // === ZEITBERECHNUNG ===
          standardValuePerUnit: service.standardValuePerUnit || null,
          calculatedBaseTime: calculatedBaseTime,
          minTime: service.minTime || null,
          minTimeApplied: minTimeApplied,
          waitTime: service.waitTime || null,
          // === MATERIAL ===
          materialType: service.materialType || 'none',
          materialValue: service.materialValue || 0,
          // === EFFIZIENZ-DETAILS (KUMULIERT!) ===
          efficiencyStart: service.efficiencyStart || null,
          efficiencyCap: service.efficiencyCap || null,
          efficiencyStepPercent: service.efficiencyStepPercent || null,
          maxProductivityPerDay: service.maxProductivityPerDay || null,
          // NEU: Detaillierte Effizienz-Informationen
          efficiencyDetails: {
            totalQuantityAllObjects: efficiencyDetails.totalQuantity || quantity,
            quantityThisObject: quantity,
            efficiencyCapApplied: efficiencyDetails.cappedAtLimit || false,
            stepsCalculated: efficiencyDetails.stepsCalculated || 0,
            reason: efficiencyDetails.reason || 'Keine Effizienzsteigerung'
          },
          // === GEBÜNDELTE UNTERLEISTUNGEN ===
          // Services deren Zeit in diese Leistung integriert wurde
          hasBundledServices: bundledServices.length > 0,
          bundledServices: bundledServices.length > 0 ? bundledServices : null,
          bundledTimeAdded: bundledTimeAdded > 0 ? bundledTimeAdded : null,
          // === WORKFLOW ===
          workflowOrder: service.workflowOrder || 20,
          workflowPhase: service.workflowPhase || 'beschichtung',
          workflowExplanation: service.workflowExplanation || null,
          workflowTip: service.workflowTip || null,
          subWorkflowOrder: service.subWorkflowOrder || null,
          subWorkflowTotal: service.subWorkflowTotal || null,
          subWorkflowExplanation: service.subWorkflowExplanation || null,
          createsDust: service.createsDust || false,
        });

        objectResult.totalTime += finalTime;
        objectResult.totalLaborCost += pricing.laborCost;
        objectResult.totalMaterialCost += pricing.materialCost;
        objectResult.totalCost += pricing.totalCost;
      }
    }

    results.objects.push(objectResult);
    results.totalTime += objectResult.totalTime;
    results.totalLaborCost += objectResult.totalLaborCost;
    results.totalMaterialCost += objectResult.totalMaterialCost;
    results.totalCost += objectResult.totalCost;
  }

  // Baustellenpauschale
  if (companySettings.siteSetup > 0) {
    const siteSetupHours = companySettings.siteSetup / 60;
    results.siteSetupCost = Math.round(siteSetupHours * companySettings.laborRate * 100) / 100;
    results.totalTime += companySettings.siteSetup;
    results.totalLaborCost += results.siteSetupCost;
    results.totalCost += results.siteSetupCost;
  }

  if (companySettings.siteClearance > 0) {
    const siteClearanceHours = companySettings.siteClearance / 60;
    results.siteClearanceCost = Math.round(siteClearanceHours * companySettings.laborRate * 100) / 100;
    results.totalTime += companySettings.siteClearance;
    results.totalLaborCost += results.siteClearanceCost;
    results.totalCost += results.siteClearanceCost;
  }

  // Workflow planen
  let workflow = null;
  if (allCalculations.length > 0) {
    workflow = await planWorkflow(allCalculations, customerApproval);
    results.totalDays = workflow.totalDays;
    results.optimalEmployees = workflow.optimalEmployees;
    
    // NEU: Workflow-Daten an results übergeben für UI
    results.workflow = {
      days: workflow.days,
      totalDays: workflow.totalDays,
      plannedDays: workflow.plannedDays,
      totalHours: workflow.totalHours,
      optimalEmployees: workflow.optimalEmployees,
      employeeExplanation: workflow.employeeExplanation,
      employeeCount: workflow.employeeCount,
      workPerEmployee: workflow.workPerEmployee,
      projectDays: workflow.projectDays,
      isParallel: workflow.isParallel
    };

    // ========================================
    // PHASE 4: Mindestzeit nach Tagesplanung anwenden
    // ========================================
    console.log('⏱️ PHASE 4: Wende Mindestzeit-Regel nach Tagesplanung an...');
    const minTimeDecisions = await applyMinimumTimeAfterPlanning(
      workflow.days || [],
      allCalculations,
      companySettings
    );

    // Aktualisiere Berechnungen mit Mindestzeit
    let totalTimeAdjustment = 0;
    let totalCostAdjustment = 0;

    for (const [calcId, decision] of minTimeDecisions) {
      if (decision.shouldApplyMinTime) {
        const calculation = allCalculations.find(c => c.id === calcId);
        if (!calculation) continue;

        const service = await databaseService.getServiceById(calculation.serviceId);
        if (!service) continue;

        // Berechne die ursprünglich berechnete Basiszeit neu
        const quantity = calculation.quantity || 1;
        let calculatedBaseTime = 0;

        if (service.standardValuePerUnit && service.standardValuePerUnit > 0) {
          calculatedBaseTime = service.standardValuePerUnit * quantity;
        } else if (service.standardTime && service.standardQuantity && service.standardQuantity > 0) {
          calculatedBaseTime = (service.standardTime / service.standardQuantity) * quantity;
        }

        // Die Mindestzeit wird auf die ursprünglich berechnete Basiszeit angewendet
        // Dann müssen wir baseTime und finalTime neu berechnen
        const originalBaseTime = calculatedBaseTime;

        if (originalBaseTime <= 0) {
          console.warn(`⚠️ "${service.title}": originalBaseTime ist 0, überspringe Mindestzeit-Anwendung`);
          continue;
        }

        const adjustedBaseTime = Math.max(originalBaseTime, decision.minTime);

        // Berechne die Differenz in baseTime
        const baseTimeDifference = adjustedBaseTime - originalBaseTime;

        if (baseTimeDifference > 0) {
          // Aktualisiere baseTime (mit allen Faktoren, die bereits angewendet wurden)
          // Die Faktoren wurden bereits auf originalBaseTime angewendet, also müssen wir sie auch auf adjustedBaseTime anwenden
          const factorMultiplier = calculation.baseTime / originalBaseTime; // Verhältnis der Faktoren
          const newBaseTime = adjustedBaseTime * factorMultiplier;

          // Neuberechnung von finalTime mit der neuen baseTime
          const efficiency = calculation.efficiency || 1;
          const serviceFactor = calculation.factors?.serviceFactor || 1;
          const newFinalTime = (newBaseTime / efficiency) * serviceFactor;

          // Berechne die Differenz in finalTime
          const currentFinalTime = calculation.finalTime;
          const timeDifference = newFinalTime - currentFinalTime;

          // Neuberechnung der Preise
          const newPricing = calculatePrice(newFinalTime, quantity, service, companySettings);

          // Berechne Kosten-Differenz
          const costDifference = newPricing.totalCost - calculation.totalCost;

          // Aktualisiere Calculation in DB
          await databaseService.updateCalculation(calcId, {
            baseTime: newBaseTime,
            finalTime: newFinalTime,
            laborCost: newPricing.laborCost,
            materialCost: newPricing.materialCost,
            totalCost: newPricing.totalCost
          });

          // Aktualisiere auch in allCalculations Array
          calculation.baseTime = newBaseTime;
          calculation.finalTime = newFinalTime;
          calculation.laborCost = newPricing.laborCost;
          calculation.materialCost = newPricing.materialCost;
          calculation.totalCost = newPricing.totalCost;

          // Aktualisiere Ergebnisse
          totalTimeAdjustment += timeDifference;
          totalCostAdjustment += costDifference;

          // Finde und aktualisiere das entsprechende Service-Ergebnis in results
          for (const objResult of results.objects) {
            const serviceResult = objResult.services.find(s => s.serviceId === service.id);
            if (serviceResult) {
              // Finde die Calculation für dieses Objekt
              const objCalculation = allCalculations.find(
                c => c.objectId === objResult.id && c.serviceId === service.id
              );

              if (objCalculation && objCalculation.id === calcId) {
                // Aktualisiere Service-Ergebnis
                serviceResult.baseTime = newBaseTime;
                serviceResult.finalTime = newFinalTime;
                serviceResult.hours = newPricing.hours;
                serviceResult.laborCost = newPricing.laborCost;
                serviceResult.materialCost = newPricing.materialCost;
                serviceResult.totalCost = newPricing.totalCost;
                serviceResult.minTimeApplied = true;

                // Aktualisiere Objekt-Gesamtsummen
                objResult.totalTime = objResult.totalTime - currentFinalTime + newFinalTime;
                objResult.totalLaborCost = objResult.totalLaborCost - calculation.laborCost + newPricing.laborCost;
                objResult.totalMaterialCost = objResult.totalMaterialCost - calculation.materialCost + newPricing.materialCost;
                objResult.totalCost = objResult.totalCost - calculation.totalCost + newPricing.totalCost;

                // Aktualisiere Gesamtergebnisse
                results.totalTime = results.totalTime - currentFinalTime + newFinalTime;
                results.totalLaborCost = results.totalLaborCost - calculation.laborCost + newPricing.laborCost;
                results.totalMaterialCost = results.totalMaterialCost - calculation.materialCost + newPricing.materialCost;
                results.totalCost = results.totalCost - calculation.totalCost + newPricing.totalCost;

                console.log(`💰 "${service.title}": Zeit ${currentFinalTime.toFixed(2)} → ${newFinalTime.toFixed(2)} min (+${timeDifference.toFixed(2)} min), Kosten +${costDifference.toFixed(2)} €`);
                break;
              }
            }
          }
        }
      }
    }

    if (totalTimeAdjustment > 0 || totalCostAdjustment > 0) {
      console.log(`📊 Mindestzeit-Anpassung: +${totalTimeAdjustment.toFixed(2)} min, +${totalCostAdjustment.toFixed(2)} €`);
    }
  }

  // Runden
  results.totalLaborCost = Math.round(results.totalLaborCost * 100) / 100;
  results.totalMaterialCost = Math.round(results.totalMaterialCost * 100) / 100;
  results.totalCost = Math.round(results.totalCost * 100) / 100;

  console.log('✅ Kalkulation abgeschlossen:', {
    totalTime: `${Math.round(results.totalTime)} min`,
    totalLaborCost: `${results.totalLaborCost} €`,
    totalMaterialCost: `${results.totalMaterialCost} €`,
    totalCost: `${results.totalCost} €`,
  });

  store.dispatch(setResults(results));

  return results;
}
