/**
 * ============================================================================
 * TASK-VORBEREITUNG
 * ============================================================================
 * 
 * Funktionen für die Vorbereitung und Sortierung von Tasks.
 */

import { databaseService } from '../databaseService';
import { WORKFLOW_PHASES } from './constants';

/**
 * Sortiert Services nach Workflow-Phasen und Reihenfolge
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @returns {Array} Sortierte und angereicherte Berechnungen
 */
export async function sortServicesByWorkflow(calculations) {
  // Services mit Workflow-Daten anreichern
  const enrichedCalcs = await Promise.all(
    calculations.map(async (calc) => {
      const service = await databaseService.getServiceById(calc.serviceId);
      return {
        ...calc,
        workflowOrder: service?.workflowOrder || 20,
        workflowPhase: service?.workflowPhase || 'beschichtung',
        workflowExplanation: service?.workflowExplanation || null,
        waitTime: service?.waitTime || 0,
        createsDust: service?.createsDust || false,
        canSplit: service?.canSplit ?? true,
        showInWorkflow: service?.showInWorkflow ?? true,
        bundleCalculation: service?.bundleCalculation || false,
        allowMultiEmployee: service?.allowMultiEmployee ?? true,
        multiEmployeeEfficiencyKeep: service?.multiEmployeeEfficiencyKeep ?? true,
        minQuantityForMultiEmployee: service?.minQuantityForMultiEmployee || null,
        maxEmployeesForService: service?.maxEmployeesForService || null,
        efficiencyStart: service?.efficiencyStart || null
      };
    })
  );

  // Filtere gebündelte Services heraus
  const visibleCalcs = enrichedCalcs.filter(calc => calc.showInWorkflow !== false);

  if (enrichedCalcs.length !== visibleCalcs.length) {
    const hiddenCount = enrichedCalcs.length - visibleCalcs.length;
    console.log(`📦 ${hiddenCount} gebündelte Unterleistung(en) aus Workflow-Anzeige entfernt`);
  }

  // Zweistufige Sortierung: Phase → workflowOrder
  return visibleCalcs.sort((a, b) => {
    const phaseA = WORKFLOW_PHASES[a.workflowPhase] || 7;
    const phaseB = WORKFLOW_PHASES[b.workflowPhase] || 7;

    if (phaseA !== phaseB) {
      return phaseA - phaseB;
    }

    return a.workflowOrder - b.workflowOrder;
  });
}

/**
 * Prüft Cross-Object Abhängigkeiten
 * 
 * 1. Schleifen auf Türen/Fenstern MUSS vor Anstrich auf Wänden/Decken erfolgen
 * 2. Schleifen auf Türen/Fenstern MUSS NACH Spachteln erfolgen
 * 
 * @param {Object} task - Der zu prüfende Task
 * @param {Object} tasksByObject - Alle Tasks gruppiert nach Objekten
 * @param {Array} objects - Alle Objekt-Definitionen
 * @returns {boolean} true wenn Task ausgeführt werden darf
 */
export function checkCrossObjectDependencies(task, tasksByObject, objects) {
  const taskObject = objects?.find(obj => obj.id === task.objectId);
  if (!taskObject) return true;

  const roomId = task.objectId;

  // Finde alle Türen/Fenster die diesem Raum zugeordnet sind
  const relatedDoorWindowObjects = objects?.filter(obj =>
    (obj.objectCategory === 'tuer' || obj.objectCategory === 'fenster') &&
    obj.assignedToRoomId === roomId
  ) || [];

  // REGEL 1: Schleifen auf Türen/Fenstern vor Anstrich auf Wänden/Decken
  if (task.workflowPhase === 'beschichtung') {
    if (['anstrich', 'wand', 'decke', 'allgemein'].includes(task.workArea)) {
      if (taskObject.objectCategory === 'raum') {
        for (const relObj of relatedDoorWindowObjects) {
          const relTasks = tasksByObject[relObj.id] || [];

          for (const relTask of relTasks) {
            if (relTask.workflowPhase === 'untergrund' && relTask.remainingTime > 0) {
              console.log(`⏳ Cross-Object: "${task.serviceName}" wartet auf "${relTask.serviceName}"`);
              return false;
            }
          }
        }
      }
    }
  }

  // REGEL 2: Schleifen auf Türen/Fenstern NACH Spachteln
  if (task.workflowPhase === 'untergrund') {
    if (taskObject.objectCategory === 'tuer' || taskObject.objectCategory === 'fenster') {
      const isSanding = task.workArea === 'lackierung' ||
        (task.serviceName && task.serviceName.toLowerCase().includes('schleif'));

      if (isSanding && taskObject.assignedToRoomId) {
        const roomTasks = tasksByObject[taskObject.assignedToRoomId] || [];

        for (const roomTask of roomTasks) {
          const isSpackling = roomTask.workArea === 'spachtel' ||
            (roomTask.serviceName && roomTask.serviceName.toLowerCase().includes('spachtel'));
          const isWallOrCeiling = roomTask.workArea === 'wand' || roomTask.workArea === 'decke';

          if (isSpackling && isWallOrCeiling && roomTask.remainingTime > 0) {
            console.log(`⏳ Abhängigkeit: "${task.serviceName}" wartet auf Spachteln`);
            return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Erkennt den Arbeitsbereich aus dem Service-Namen
 * 
 * @param {string} serviceName - Name des Services
 * @returns {string} Erkannter Arbeitsbereich
 */
export function detectWorkArea(serviceName) {
  const name = (serviceName || '').toLowerCase();

  if (name.includes('decke') || name.includes('decken')) return 'decke';
  if (name.includes('wand') || name.includes('wände')) return 'wand';
  if (name.includes('boden') || name.includes('abdecken')) return 'boden';
  if (name.includes('fenster')) return 'fenster';
  if (name.includes('tür') || name.includes('zarge')) return 'tuer';
  if (name.includes('lackier') || name.includes('schleifen')) return 'lackierung';
  if (name.includes('tapete') || name.includes('tapezier') || name.includes('raufaser')) return 'tapete';
  if (name.includes('spachtel')) return 'spachtel';
  if (name.includes('grundierung') || name.includes('grundier')) return 'grundierung';
  if (name.includes('streichen') || name.includes('anstrich')) return 'anstrich';

  return 'allgemein';
}

/**
 * Gruppiert Tasks nach Objekten und sortiert sie
 * 
 * @param {Array} enrichedCalcs - Angereicherte Berechnungen
 * @returns {{ allTasks: Array, tasksByObject: Object }}
 */
export function groupAndPrepareTasks(enrichedCalcs) {
  const tasksByObject = {};
  const allTasks = [];

  for (const calc of enrichedCalcs) {
    const task = {
      id: calc.id,
      objectId: calc.objectId,
      objectName: calc.objectName || '',
      objectType: calc.objectType || '',
      serviceId: calc.serviceId,
      serviceName: calc.serviceName || '',
      totalTime: calc.finalTime,
      remainingTime: calc.finalTime,
      waitTime: calc.waitTime || 0,
      workflowOrder: calc.workflowOrder,
      workflowPhase: calc.workflowPhase,
      workflowExplanation: calc.workflowExplanation || null,
      workArea: detectWorkArea(calc.serviceName),
      createsDust: calc.createsDust || false,
      canSplit: calc.canSplit ?? true,
      quantity: calc.quantity || 0,
      unit: calc.unit || '',
      scheduled: false,
      splitParts: [],
      assignedEmployee: null,
    };

    allTasks.push(task);

    if (!tasksByObject[calc.objectId]) {
      tasksByObject[calc.objectId] = [];
    }
    tasksByObject[calc.objectId].push(task);
  }

  // Sortiere Tasks innerhalb jedes Objekts
  for (const objectId in tasksByObject) {
    tasksByObject[objectId].sort((a, b) => {
      const phaseA = WORKFLOW_PHASES[a.workflowPhase] || 7;
      const phaseB = WORKFLOW_PHASES[b.workflowPhase] || 7;
      if (phaseA !== phaseB) return phaseA - phaseB;

      const waitDiff = (b.waitTime || 0) - (a.waitTime || 0);
      if (waitDiff !== 0) return waitDiff;

      return a.workflowOrder - b.workflowOrder;
    });
  }

  return { allTasks, tasksByObject };
}

/**
 * Prüft Wartezeiten und Parallelarbeit
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @returns {Array} Warteperioden
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
