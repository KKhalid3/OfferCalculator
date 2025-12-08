import { databaseService } from './databaseService';
import { MINUTES_PER_DAY } from '../constants';

/**
 * Schritt 12: Sortierung nach Workflow
 * Sortiert Services nach ihrer workflowOrder für logische Arbeitsreihenfolge
 */
export async function sortServicesByWorkflow(calculations) {
  // Services mit Workflow-Daten anreichern
  const enrichedCalcs = await Promise.all(
    calculations.map(async (calc) => {
      const service = await databaseService.getServiceById(calc.serviceId);
      return {
        ...calc,
        workflowOrder: service?.workflowOrder || 20, // Default: Mitte
        workflowPhase: service?.workflowPhase || 'beschichtung',
        workflowExplanation: service?.workflowExplanation || null
      };
    })
  );
  
  // Nach workflowOrder sortieren (aufsteigend)
  return enrichedCalcs.sort((a, b) => a.workflowOrder - b.workflowOrder);
}

/**
 * Schritt 11: Wartezeiten und Parallelarbeit prüfen
 */
export async function checkWaitTimesAndParallelWork(calculations) {
  const waitPeriods = [];
  
  for (const calc of calculations) {
    const service = await databaseService.getServiceById(calc.serviceId);
    if (service && service.waitTime) {
      waitPeriods.push({
        serviceId: calc.serviceId,
        objectId: calc.objectId,
        duration: service.waitTime,
        startTime: calc.finalTime
      });
    }
  }
  
  return waitPeriods;
}

/**
 * Schritt 13: Optimale Mitarbeiteranzahl berechnen
 */
export function calculateOptimalEmployees(totalHours) {
  if (totalHours <= 8) return 1;
  
  const employees = Math.ceil(totalHours / 8);
  
  // Prüfen ob Effizienzverlust auftritt
  const hoursPerEmployee = totalHours / employees;
  if (hoursPerEmployee < 4) {
    // Zu wenig Stunden pro Mitarbeiter = Effizienzverlust
    return Math.max(1, Math.floor(totalHours / 4));
  }
  
  return employees;
}

/**
 * Hauptfunktion: Workflow planen
 */
export async function planWorkflow(calculations, customerApproval) {
  // Schritt 12: Sortieren
  const sortedCalculations = await sortServicesByWorkflow(calculations);
  
  // Schritt 11: Wartezeiten prüfen
  const waitPeriods = await checkWaitTimesAndParallelWork(sortedCalculations);
  
  const days = [];
  let currentDay = {
    day: 1,
    hours: 0,
    minutes: 0,
    tasks: [],
    waitTimes: []
  };
  
  for (const calc of sortedCalculations) {
    const calcHours = calc.finalTime / 60;
    
    // Prüfen ob in aktuellen Tag passt
    if (currentDay.minutes + calc.finalTime > MINUTES_PER_DAY) {
      // Neuer Tag
      days.push(currentDay);
      currentDay = {
        day: days.length + 1,
        hours: 0,
        minutes: 0,
        tasks: [],
        waitTimes: []
      };
    }
    
    // Task hinzufügen
    currentDay.minutes += calc.finalTime;
    currentDay.hours = currentDay.minutes / 60;
    currentDay.tasks.push({
      calculationId: calc.id,
      serviceId: calc.serviceId,
      objectId: calc.objectId,
      time: calc.finalTime
    });
    
    // Wartezeit prüfen
    const waitPeriod = waitPeriods.find(w => w.serviceId === calc.serviceId);
    if (waitPeriod) {
      currentDay.waitTimes.push(waitPeriod);
    }
  }
  
  // Letzten Tag hinzufügen
  if (currentDay.tasks.length > 0) {
    days.push(currentDay);
  }
  
  // Schritt 13: Optimales Personal
  const totalHours = days.reduce((sum, day) => sum + day.hours, 0);
  const optimalEmployees = calculateOptimalEmployees(totalHours);
  
  // Workflows in RxDB speichern
  await databaseService.deleteAllWorkflows();
  for (const day of days) {
    await databaseService.saveWorkflow({
      day: day.day,
      hours: day.hours,
      employees: optimalEmployees,
      calculationIds: day.tasks.map(t => t.calculationId),
      waitTimes: day.waitTimes,
      parallelWork: []
    });
  }
  
  return {
    days,
    totalDays: days.length,
    totalHours,
    optimalEmployees
  };
}

