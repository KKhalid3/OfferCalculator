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
        let specialNoteFactor = 1;
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
        const efficiency = efficiencyResult.efficiency;
        const efficiencyDetails = efficiencyResult.details;

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

        allCalculations.push(calculation);

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
  if (allCalculations.length > 0) {
    const workflow = await planWorkflow(allCalculations, customerApproval);
    results.totalDays = workflow.totalDays;
    results.optimalEmployees = workflow.optimalEmployees;
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
