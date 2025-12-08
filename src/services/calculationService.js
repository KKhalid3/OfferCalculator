import { calculateObjectQuantities } from './quantityService';
import { getServicesWithSubServices } from './serviceService';
import { getBaselineTime } from './baselineService';
import { applySpecialNoteFactors, getRequiredServicesFromSpecialNotes, isSpecialNoteRelevantForService } from './specialNotesService';
import { calculateEfficiency } from './efficiencyService';
import { planWorkflow } from './workflowService';
import { databaseService } from './databaseService';
import { store } from '../store';
import { setResults } from '../store/slices/calculationsSlice';
import { defaultCompanySettings } from '../database/schemas/companySettingsSchema';

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
 * Hauptkalkulationsfunktion - führt alle Schritte aus
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
  
  // Alte Berechnungen löschen (mit Fehlerbehandlung)
  for (const obj of objects) {
    try {
      await databaseService.deleteCalculationsByObject(obj.id);
    } catch (error) {
      console.warn(`Fehler beim Löschen von Berechnungen für Objekt ${obj.id}:`, error.message);
      // Fortfahren, auch wenn das Löschen fehlschlägt
    }
  }
  
  const results = {
    objects: [],
    totalTime: 0,
    totalDays: 0,
    totalLaborCost: 0,
    totalMaterialCost: 0,
    totalCost: 0,
    // Baustellenpauschale (einmalig)
    siteSetupCost: 0,
    siteClearanceCost: 0,
  };
  
  const allCalculations = [];
  
  for (const object of objects) {
    const objectResult = {
      id: object.id,
      name: object.name,
      type: object.type,
      quantities: {},
      services: [],
      specialNotes: [], // Array von Sonderangaben-Objekten für Anzeige
      totalTime: 0,
      totalLaborCost: 0,
      totalMaterialCost: 0,
      totalCost: 0,
    };
    
    // Schritt 3-6: Mengen berechnen
    const quantities = await calculateObjectQuantities(object);
    objectResult.quantities = quantities;
    
    // Schritt 7a: Zusatzleistungen aus Sonderangaben ermitteln
    const additionalServiceIds = await getRequiredServicesFromSpecialNotes(object.specialNotes || []);
    console.log(`Objekt "${object.name}": ${additionalServiceIds.length} Zusatzleistungen aus Sonderangaben`);
    
    // Alle Sonderangaben für dieses Objekt laden und im Ergebnis speichern
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
    
    // Alle zu berechnenden Service-IDs: ausgewählte + durch Sonderangaben aktivierte
    const allServiceIds = [...(object.services || [])];
    for (const addId of additionalServiceIds) {
      if (!allServiceIds.includes(addId)) {
        allServiceIds.push(addId);
      }
    }
    
    // Set um bereits berechnete Services zu tracken (vermeidet Duplikate bei Unterleistungen)
    const processedServiceIds = new Set();
    
    // Für jede Leistung
    for (const serviceId of allServiceIds) {
      // Schritt 1: Services mit Unterleistungen
      const allServices = await getServicesWithSubServices(serviceId);
      
      // Die erste Leistung ist die Hauptleistung
      const mainService = allServices[0];
      const mainServiceName = mainService?.title || '';
      
      for (let svcIndex = 0; svcIndex < allServices.length; svcIndex++) {
        const service = allServices[svcIndex];
        const isSubService = svcIndex > 0; // Alle nach der ersten sind Unterleistungen
        
        // Überspringe wenn bereits berechnet
        if (processedServiceIds.has(service.id)) {
          continue;
        }
        processedServiceIds.add(service.id);
        
        // Menge bestimmen (Decke, Wand, Boden, oder Kombination)
        let quantity = 1;
        if (service.unit === 'm²') {
          const hasWalls = service.title.includes('Wand') || service.title.includes('Wände');
          const hasCeiling = service.title.includes('Decke') || service.title.includes('Decken');
          const hasFloor = service.title.includes('Boden');
          
          if (hasWalls && hasCeiling) {
            // Wände + Decken kombiniert
            quantity = quantities.wallArea + quantities.ceilingArea;
          } else if (hasCeiling) {
            // Nur Decke
            quantity = quantities.ceilingArea;
          } else if (hasFloor) {
            // Boden = Grundfläche (entspricht Deckenfläche)
            quantity = quantities.ceilingArea;
          } else {
            // Nur Wände (oder Standard für m²)
            quantity = quantities.wallArea;
          }
        }
        
        // Schritt 8: Baseline-Zeit
        let baseTime = await getBaselineTime(service.id, quantity);
        
        // Schritt 7: Sonderangaben-Faktoren nur auf relevante Leistungen anwenden
        // WICHTIG: Sonderangaben MIT requiredService sind Zusatzleistungen, KEINE Multiplikatoren!
        // Diese werden als separate Positionen gezogen, nicht als Erschwernis multipliziert.
        let specialNoteFactor = 1;
        for (const noteId of (object.specialNotes || [])) {
          const isRelevant = await isSpecialNoteRelevantForService(noteId, serviceId);
          if (isRelevant) {
            const specialService = await databaseService.getSpecialServiceById(noteId);
            // NUR als Multiplikator wenn KEIN requiredService vorhanden ist (= echte Erschwernis)
            // Wenn requiredService vorhanden ist, wird die Leistung als separate Position gezogen
            if (specialService && !specialService.requiredService && specialService.factor && specialService.factor !== 1) {
              specialNoteFactor *= specialService.factor;
            }
          }
        }
        baseTime = baseTime * specialNoteFactor;
        
        // Schritt 9: Effizienz
        const efficiency = await calculateEfficiency(service.id, quantity, customerApproval);
        const finalTime = (baseTime / efficiency) * quantities.serviceFactor;
        
        // Preisberechnung
        const pricing = calculatePrice(finalTime, quantity, service, companySettings);
        
        // Berechnung speichern
        const calculation = await databaseService.saveCalculation({
          objectId: object.id,
          serviceId: service.id,
          quantity,
          quantityType: service.title.includes('Decke') ? 'ceiling' : 'walls',
          baseTime,
          efficiency,
          finalTime,
          // Preisfelder
          laborCost: pricing.laborCost,
          materialCost: pricing.materialCost,
          totalCost: pricing.totalCost,
          factors: {
            quantityFactor: quantities.quantityFactor,
            serviceFactor: quantities.serviceFactor
          },
          specialNotes: object.specialNotes || []
        });
        
        allCalculations.push(calculation);
        
        // Prüfen ob diese Leistung durch eine Sonderangabe aktiviert wurde
        const isFromSpecialNote = additionalServiceIds.includes(service.id);
        
        // Berechne ob Mindestzeit angewendet wurde
        const calculatedBaseTime = service.standardValuePerUnit 
          ? service.standardValuePerUnit * quantity 
          : (service.standardTime && service.standardQuantity 
              ? (service.standardTime / service.standardQuantity) * quantity 
              : 0);
        const minTimeApplied = service.minTime && service.minTime > 0 && calculatedBaseTime < service.minTime;
        
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
          // Unterleistungs-Info
          isSubService,
          parentServiceName: isSubService ? mainServiceName : null,
          // Preisfelder
          hours: pricing.hours,
          laborCost: pricing.laborCost,
          materialCost: pricing.materialCost,
          totalCost: pricing.totalCost,
          // === TRANSPARENZ-DETAILS aus Onboarding ===
          // Zeitberechnung
          standardValuePerUnit: service.standardValuePerUnit || null,
          calculatedBaseTime: calculatedBaseTime, // Zeit vor Mindestzeit
          minTime: service.minTime || null,
          minTimeApplied: minTimeApplied,
          waitTime: service.waitTime || null,
          // Material-Konfiguration
          materialType: service.materialType || 'none',
          materialValue: service.materialValue || 0,
          // Effizienz-Konfiguration
          efficiencyStart: service.efficiencyStart || null,
          efficiencyCap: service.efficiencyCap || null,
          efficiencyStepPercent: service.efficiencyStepPercent || null,
          maxProductivityPerDay: service.maxProductivityPerDay || null,
          // === WORKFLOW-REIHENFOLGE ===
          workflowOrder: service.workflowOrder || 20,
          workflowPhase: service.workflowPhase || 'beschichtung',
          workflowExplanation: service.workflowExplanation || null,
          workflowTip: service.workflowTip || null,
          // === UNTERLEISTUNGS-REIHENFOLGE ===
          subWorkflowOrder: service.subWorkflowOrder || null,
          subWorkflowTotal: service.subWorkflowTotal || null,
          subWorkflowExplanation: service.subWorkflowExplanation || null,
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
  
  // Baustellenpauschale berechnen (einmalig pro Projekt)
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
  
  // Schritt 9-13: Workflow planen
  if (allCalculations.length > 0) {
    const workflow = await planWorkflow(allCalculations, customerApproval);
    results.totalDays = workflow.totalDays;
    results.optimalEmployees = workflow.optimalEmployees;
  }
  
  // Ergebnisse runden
  results.totalLaborCost = Math.round(results.totalLaborCost * 100) / 100;
  results.totalMaterialCost = Math.round(results.totalMaterialCost * 100) / 100;
  results.totalCost = Math.round(results.totalCost * 100) / 100;
  
  console.log('Kalkulation abgeschlossen:', {
    totalTime: `${Math.round(results.totalTime)} min`,
    totalLaborCost: `${results.totalLaborCost} €`,
    totalMaterialCost: `${results.totalMaterialCost} €`,
    totalCost: `${results.totalCost} €`,
  });
  
  // Ergebnisse im Store setzen
  store.dispatch(setResults(results));
  
  return results;
}

