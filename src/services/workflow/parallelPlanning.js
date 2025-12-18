/**
 * ============================================================================
 * PARALLELE PLANUNG (MIT PARALLELARBEIT)
 * ============================================================================
 * 
 * Bei aktivierter Parallelarbeit:
 * - Mehrere Mitarbeiter können gleichzeitig in verschiedenen Räumen arbeiten
 * - Während Trocknungszeiten wird in anderen Räumen weitergearbeitet
 * - Die Projektdauer wird durch Parallelarbeit verkürzt
 */

import { databaseService } from '../databaseService';
import { HOURS_PER_DAY } from '../../constants';
import { sortServicesByWorkflow, groupAndPrepareTasks, checkCrossObjectDependencies } from './taskPreparation';
import { canWorkDuringDrying, addDryingPhase, updateDryingPhases } from './dryingRules';
import { createNewDay, createEmployeeSchedule, finalizeDay, findLeastBusyEmployee, resetEmployeeSchedulesForNewDay, groupTasksByRoom, formatMinutesToTime } from './dayHelpers';
import { calculateOptimalEmployeesAdvanced } from './employeeCalculation';
import { defaultCompanySettings } from '../../database/schemas/companySettingsSchema';

/**
 * Plant den Workflow MIT Parallelarbeit
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @returns {Object} Workflow-Planung
 */
export async function planParallel(calculations) {
  // Lade Settings und verwende Defaults wenn nicht vorhanden
  const loadedSettings = await databaseService.getCompanySettings();
  const companySettings = { ...defaultCompanySettings, ...loadedSettings };
  
  const dailyMinutes = (companySettings.dailyHours || HOURS_PER_DAY) * 60;
  const maxOvertimePercent = companySettings.maxOvertimePercent ?? 15;
  const maxDayMinutes = Math.round(dailyMinutes * (1 + maxOvertimePercent / 100));
  
  // Baustellenzeiten aus Settings (mit Defaults: 60 Min je)
  const siteSetupMinutes = companySettings.siteSetup || 60;
  const siteClearanceMinutes = companySettings.siteClearance || 60;
  
  console.log('🏗️ Parallele Planung - Baustellenzeiten:', { siteSetupMinutes, siteClearanceMinutes });
  
  // Alle Objekte laden
  const allObjects = await databaseService.getAllObjects();

  // Tasks vorbereiten
  const enrichedCalcs = await sortServicesByWorkflow(calculations);
  const { allTasks, tasksByObject } = groupAndPrepareTasks(enrichedCalcs);
  
  // Gesamtarbeitszeit berechnen (inkl. Baustelleneinrichtung/-räumung)
  const taskTotalMinutes = allTasks.reduce((sum, t) => sum + t.totalTime, 0);
  const totalMinutesWithSite = taskTotalMinutes + siteSetupMinutes + siteClearanceMinutes;
  const totalHours = totalMinutesWithSite / 60;
  const uniqueObjects = new Set(allTasks.map(t => t.objectId)).size;
  
  // MA-Berechnung (mit Parallelarbeit)
  const employeeResult = await calculateOptimalEmployeesAdvanced(
    totalHours,
    companySettings,
    enrichedCalcs,
    uniqueObjects,
    true // customerApproval = true
  );
  
  const numberOfEmployees = employeeResult.optimalEmployees || 1;
  const projectDays = employeeResult.recommendedDays;
  
  console.log(`📋 Parallele Planung: ${totalHours.toFixed(1)}h Arbeit → ${projectDays} Tage, ${numberOfEmployees} MA gleichzeitig`);

  // Mitarbeiter-Schedules erstellen
  const employeeSchedules = [];
  for (let i = 0; i < numberOfEmployees; i++) {
    employeeSchedules.push(createEmployeeSchedule(i + 1));
  }
  
  // Planung
  const days = [];
  let currentDay = createNewDay(1);
  
  let activeDryingPhases = [];
  const objectIds = Object.keys(tasksByObject);
  
  // ========================================================================
  // SCHRITT 1: Baustelleneinrichtung am Anfang (nur MA 1)
  // ========================================================================
  if (siteSetupMinutes > 0) {
    const setupEmployee = employeeSchedules[0];
    const setupTask = {
      id: "site-setup",
      objectId: "project",
      objectName: "Baustelle",
      objectType: "Projekt",
      serviceId: "site-setup",
      serviceName: "Baustelleneinrichtung",
      startTime: 0,
      duration: siteSetupMinutes,
      endTime: siteSetupMinutes,
      employeeId: setupEmployee.id,
      employeeName: setupEmployee.name,
      workArea: "setup",
      workflowPhase: "vorbereitung",
      waitTime: 0,
      isPartial: false,
      isContinuation: false,
    };
    currentDay.tasks.push(setupTask);
    setupEmployee.currentDayMinutes = siteSetupMinutes;
    console.log(`🚀 Baustelleneinrichtung eingeplant: ${formatMinutesToTime(siteSetupMinutes)} (${setupEmployee.name})`);
  }
  
  // ========================================================================
  // SCHRITT 2: Hauptschleife - Arbeite alle Tasks ab
  // ========================================================================
  let iteration = 0;
  const maxIterations = allTasks.length * 100;
  
  while (hasUnfinishedTasks(allTasks) && iteration < maxIterations) {
    iteration++;
    
    // Für jeden Mitarbeiter einen Task suchen
    let anyTaskScheduled = false;
    
    for (const employee of employeeSchedules) {
      // Prüfe ob Mitarbeiter noch Zeit hat
      if (employee.currentDayMinutes >= dailyMinutes) continue;
      
      // Finde Task für diesen Mitarbeiter
      const nextTask = findNextAvailableTaskParallel(
        tasksByObject,
        objectIds,
        activeDryingPhases,
        allObjects,
        employeeSchedules,
        employee
      );
      
      if (nextTask) {
        // Task einplanen
        const result = scheduleTaskParallel(
          nextTask,
          currentDay,
          employee,
          dailyMinutes,
          maxDayMinutes
        );
        
        if (result.scheduledTask) {
          anyTaskScheduled = true;
          
          // Trocknungsphase hinzufügen wenn Task komplett
          if (nextTask.waitTime > 0 && nextTask.remainingTime <= 0) {
            activeDryingPhases = addDryingPhase(
              activeDryingPhases,
              nextTask,
              employee.currentDayMinutes
            );
            console.log(`⏱️ Trocknungsphase: "${nextTask.serviceName}" - ${formatMinutesToTime(nextTask.waitTime)}`);
          }
        }
      }
    }
    
    // Wenn kein Task geplant werden konnte
    if (!anyTaskScheduled) {
      // Prüfe ob alle Mitarbeiter fertig für den Tag sind
      const allEmployeesDone = employeeSchedules.every(e => e.currentDayMinutes >= dailyMinutes);
      
      if (allEmployeesDone || activeDryingPhases.length === 0) {
        // Neuer Tag
        currentDay = finalizeDay(currentDay, employeeSchedules, dailyMinutes);
        currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
        days.push(currentDay);
        
        currentDay = createNewDay(days.length + 1);
        resetEmployeeSchedulesForNewDay(employeeSchedules);
        
        // Trocknungsphasen über Nacht
        const overnightMinutes = (24 - (companySettings?.dailyHours || 8)) * 60;
        activeDryingPhases = updateDryingPhases(activeDryingPhases, overnightMinutes);
        
        console.log(`📅 Neuer Tag ${days.length + 1}`);
      } else {
        // Warte auf Trocknung
        const minWaitTime = Math.min(...activeDryingPhases.map(d => d.remainingTime));
        const minEmployeeTime = Math.min(...employeeSchedules.map(e => dailyMinutes - e.currentDayMinutes));
        const timeToAdvance = Math.min(minWaitTime, minEmployeeTime, 30); // Max 30 Min pro Iteration
        
        // Zeit für alle Mitarbeiter erhöhen
        employeeSchedules.forEach(e => {
          e.currentDayMinutes += timeToAdvance;
        });
        
        activeDryingPhases = updateDryingPhases(activeDryingPhases, timeToAdvance);
      }
    }
  }
  
  // ========================================================================
  // SCHRITT 3: Baustellenräumung am Ende (nach allen Trocknungszeiten!)
  // ========================================================================
  if (siteClearanceMinutes > 0) {
    // Warte auf alle aktiven Trocknungsphasen
    while (activeDryingPhases.length > 0) {
      const minWaitTime = Math.min(...activeDryingPhases.map(d => d.remainingTime));
      const availableMinutes = Math.max(...employeeSchedules.map(e => dailyMinutes - e.currentDayMinutes));
      
      if (minWaitTime <= availableMinutes) {
        // Warte innerhalb des aktuellen Tages
        console.log(`⏳ Warte ${formatMinutesToTime(minWaitTime)} auf Trocknung vor Räumung...`);
        employeeSchedules.forEach(e => {
          e.currentDayMinutes = Math.max(e.currentDayMinutes, e.currentDayMinutes + minWaitTime);
        });
        activeDryingPhases = updateDryingPhases(activeDryingPhases, minWaitTime);
      } else {
        // Neuer Tag für Wartezeit
        console.log(`📅 Neuer Tag für Trocknungs-Wartezeit vor Räumung`);
        
        if (currentDay.tasks.length > 0) {
          currentDay = finalizeDay(currentDay, employeeSchedules, dailyMinutes);
          currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
          days.push(currentDay);
        }
        
        currentDay = createNewDay(days.length + 1);
        resetEmployeeSchedulesForNewDay(employeeSchedules);
        
        const overnightMinutes = (24 - (companySettings?.dailyHours || 8)) * 60;
        activeDryingPhases = updateDryingPhases(activeDryingPhases, overnightMinutes);
      }
    }
    
    // Finde Mitarbeiter mit wenigsten Minuten für Räumung
    const clearanceEmployee = findLeastBusyEmployee(employeeSchedules);
    const availableMinutes = maxDayMinutes - clearanceEmployee.currentDayMinutes;
    
    if (availableMinutes < siteClearanceMinutes) {
      // Neuer Tag für Räumung
      if (currentDay.tasks.length > 0) {
        currentDay = finalizeDay(currentDay, employeeSchedules, dailyMinutes);
        currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
        days.push(currentDay);
      }
      
      currentDay = createNewDay(days.length + 1);
      resetEmployeeSchedulesForNewDay(employeeSchedules);
    }
    
    // Räumung einplanen
    const clearanceTask = {
      id: "site-clearance",
      objectId: "project-end",
      objectName: "Baustelle",
      objectType: "Projekt",
      serviceId: "site-clearance",
      serviceName: "Baustellenräumung / Entsorgung",
      startTime: clearanceEmployee.currentDayMinutes,
      duration: siteClearanceMinutes,
      endTime: clearanceEmployee.currentDayMinutes + siteClearanceMinutes,
      employeeId: clearanceEmployee.id,
      employeeName: clearanceEmployee.name,
      workArea: "cleanup",
      workflowPhase: "finish",
      waitTime: 0,
      isPartial: false,
      isContinuation: false,
    };
    currentDay.tasks.push(clearanceTask);
    clearanceEmployee.currentDayMinutes += siteClearanceMinutes;
    console.log(`🧹 Baustellenräumung eingeplant: ${formatMinutesToTime(siteClearanceMinutes)} (${clearanceEmployee.name})`);
  }
  
  // Letzten Tag finalisieren
  if (currentDay.tasks.length > 0) {
    currentDay = finalizeDay(currentDay, employeeSchedules, dailyMinutes);
    currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
    days.push(currentDay);
  }
  
  console.log(`📅 Parallele Planung abgeschlossen: ${days.length} Tage geplant`);
  
  return {
    days,
    totalDays: projectDays,
    plannedDays: days.length,
    totalHours,
    optimalEmployees: numberOfEmployees,
    employeeExplanation: employeeResult.reasoning,
    employeeCount: numberOfEmployees,
    workPerEmployee: totalHours / numberOfEmployees,
    projectDays: projectDays,
    isParallel: true
  };
}

/**
 * Prüft ob es noch unfertige Tasks gibt
 */
function hasUnfinishedTasks(allTasks) {
  return allTasks.some(t => t.remainingTime > 0);
}

/**
 * Findet den nächsten verfügbaren Task für parallele Planung
 */
function findNextAvailableTaskParallel(tasksByObject, objectIds, activeDryingPhases, allObjects, employeeSchedules, currentEmployee) {
  // Sammle bereits zugewiesene Objekte
  const assignedObjects = new Set();
  employeeSchedules.forEach(emp => {
    if (emp.id !== currentEmployee.id && emp.currentObjectId) {
      assignedObjects.add(emp.currentObjectId);
    }
  });
  
  for (const objectId of objectIds) {
    // Überspringe wenn anderer Mitarbeiter hier arbeitet (außer Parallelarbeit im Raum erlaubt)
    if (assignedObjects.has(objectId)) continue;
    
    const tasks = tasksByObject[objectId];
    
    for (const task of tasks) {
      if (task.remainingTime <= 0) continue;
      
      // Prüfe Vorgänger
      const taskIndex = tasks.indexOf(task);
      const predecessorsComplete = tasks.slice(0, taskIndex).every(t => t.remainingTime <= 0);
      if (!predecessorsComplete) continue;
      
      // Prüfe Cross-Object Abhängigkeiten
      if (!checkCrossObjectDependencies(task, tasksByObject, allObjects)) continue;
      
      // Prüfe Trocknungsphasen
      const dryingPhase = activeDryingPhases.find(d => d.objectId === objectId);
      if (dryingPhase) {
        const canWork = canWorkDuringDrying(
          dryingPhase.area,
          task.workArea,
          false, // sameRoom = false (Parallelarbeit)
          task.createsDust
        );
        if (!canWork.canWork) continue;
      }
      
      // Task gefunden - merke Objekt für Mitarbeiter
      currentEmployee.currentObjectId = objectId;
      return task;
    }
  }
  
  return null;
}

/**
 * Plant einen Task für parallele Planung ein
 */
function scheduleTaskParallel(task, currentDay, employee, dailyMinutes, maxDayMinutes) {
  const availableMinutes = maxDayMinutes - employee.currentDayMinutes;
  const timeToSchedule = Math.min(task.remainingTime, availableMinutes);
  
  if (timeToSchedule <= 0) {
    return { needsNewDay: true };
  }
  
  // Berechne Menge proportional zur Zeit, wenn Task aufgeteilt wird
  const isPartial = timeToSchedule < task.remainingTime;
  const totalQuantity = task.quantity || 0; // Gesamtmenge des gesamten Tasks
  let quantity = totalQuantity;
  
  // Wenn Task aufgeteilt wird, berechne die Teilmenge proportional zur Zeit
  if (isPartial && task.totalTime > 0 && totalQuantity > 0) {
    // Berechne den Anteil der eingeplanten Zeit an der Gesamtzeit
    const timeRatio = timeToSchedule / task.totalTime;
    quantity = totalQuantity * timeRatio;
  }
  
  // Task (oder Teil davon) einplanen
  const scheduledTask = {
    id: task.id,
    objectId: task.objectId,
    objectName: task.objectName,
    objectType: task.objectType,
    serviceId: task.serviceId,
    serviceName: task.serviceName,
    startTime: employee.currentDayMinutes,
    duration: timeToSchedule,
    endTime: employee.currentDayMinutes + timeToSchedule,
    employeeId: employee.id,
    employeeName: employee.name,
    workArea: task.workArea,
    workflowPhase: task.workflowPhase,
    workflowExplanation: task.workflowExplanation,
    waitTime: task.waitTime,
    quantity: quantity, // Teilmenge für diesen Task-Teil
    totalQuantity: totalQuantity, // Gesamtmenge des gesamten Tasks
    unit: task.unit,
    totalTime: task.totalTime,
    isPartial: isPartial,
    isContinuation: task.totalTime !== task.remainingTime
  };
  
  currentDay.tasks.push(scheduledTask);
  employee.currentDayMinutes += timeToSchedule;
  task.remainingTime -= timeToSchedule;
  
  // Prüfe ob Tag voll ist
  const needsNewDay = employee.currentDayMinutes >= dailyMinutes;
  
  return { needsNewDay, scheduledTask };
}
