/**
 * ============================================================================
 * SEQUENZIELLE PLANUNG (OHNE PARALLELARBEIT)
 * ============================================================================
 * 
 * Bei deaktivierter Parallelarbeit:
 * - Nur 1 Mitarbeiter darf gleichzeitig vor Ort arbeiten
 * - Während Trocknungszeiten wird NICHT in anderen Räumen gearbeitet
 * - Die Projektdauer entspricht der Basisdauer
 * 
 * Die berechnete MA-Anzahl (z.B. "4 MA") bedeutet:
 * - 4 verschiedene MA werden NACHEINANDER eingesetzt
 * - Jeder MA arbeitet ca. projectDays/4 Tage
 * - Aber nur 1 MA ist gleichzeitig vor Ort
 */

import { databaseService } from '../databaseService';
import { HOURS_PER_DAY } from '../../constants';
import { sortServicesByWorkflow, groupAndPrepareTasks, checkCrossObjectDependencies } from './taskPreparation';
import { canWorkDuringDrying, addDryingPhase, updateDryingPhases } from './dryingRules';
import { createNewDay, createEmployeeSchedule, finalizeDay, formatMinutesToTime, groupTasksByRoom } from './dayHelpers';
import { calculateOptimalEmployeesAdvanced } from './employeeCalculation';
import { defaultCompanySettings } from '../../database/schemas/companySettingsSchema';

/**
 * Plant den Workflow OHNE Parallelarbeit (sequenziell)
 * Die Mitarbeiter wechseln sich ab - jeder arbeitet eine bestimmte Anzahl von Tagen
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @returns {Object} Workflow-Planung
 */
export async function planSequential(calculations) {
  // Lade Settings und verwende Defaults wenn nicht vorhanden
  const loadedSettings = await databaseService.getCompanySettings();
  const companySettings = { ...defaultCompanySettings, ...loadedSettings };
  
  const dailyMinutes = (companySettings.dailyHours || HOURS_PER_DAY) * 60;
  const maxOvertimePercent = companySettings.maxOvertimePercent ?? 15;
  const maxDayMinutes = Math.round(dailyMinutes * (1 + maxOvertimePercent / 100));
  
  // Baustellenzeiten aus Settings (mit Defaults: 60 Min je)
  const siteSetupMinutes = companySettings.siteSetup || 60;
  const siteClearanceMinutes = companySettings.siteClearance || 60;
  
  console.log('🏗️ Baustellenzeiten:', { siteSetupMinutes, siteClearanceMinutes });
  
  // Alle Objekte laden für Cross-Object Abhängigkeiten
  const allObjects = await databaseService.getAllObjects();

  // Tasks vorbereiten
  const enrichedCalcs = await sortServicesByWorkflow(calculations);
  const { allTasks, tasksByObject } = groupAndPrepareTasks(enrichedCalcs);
  
  // Gesamtarbeitszeit berechnen (inkl. Baustelleneinrichtung/-räumung)
  const taskTotalMinutes = allTasks.reduce((sum, t) => sum + t.totalTime, 0);
  const totalMinutesWithSite = taskTotalMinutes + siteSetupMinutes + siteClearanceMinutes;
  const totalHours = totalMinutesWithSite / 60;
  const uniqueObjects = new Set(allTasks.map(t => t.objectId)).size;
  
  // MA-Berechnung (ohne Parallelarbeit)
  const employeeResult = await calculateOptimalEmployeesAdvanced(
    totalHours,
    companySettings,
    enrichedCalcs,
    uniqueObjects,
    false // customerApproval = false
  );
  
  const numberOfEmployees = employeeResult.optimalEmployees || 1;
  const projectDays = employeeResult.recommendedDays;
  
  // Berechne Tage pro Mitarbeiter
  const daysPerEmployee = Math.ceil(projectDays / numberOfEmployees);
  
  console.log(`📋 Sequenzielle Planung: ${totalHours.toFixed(1)}h Arbeit → ${projectDays} Tage, ${numberOfEmployees} MA`);
  console.log(`   → Jeder MA arbeitet ca. ${daysPerEmployee} Tage (abwechselnd, nur 1 MA gleichzeitig vor Ort)`);

  // Alle Mitarbeiter-Schedules erstellen
  const employeeSchedules = [];
  for (let i = 0; i < numberOfEmployees; i++) {
    employeeSchedules.push(createEmployeeSchedule(i + 1));
  }
  
  // Planung
  const days = [];
  let currentDay = createNewDay(1);
  let currentEmployeeIndex = 0;
  
  // Funktion um den aktuellen MA basierend auf dem Tag zu bestimmen
  const getCurrentEmployee = (dayNumber) => {
    // Wechsle den MA alle daysPerEmployee Tage
    const employeeIndex = Math.floor((dayNumber - 1) / daysPerEmployee) % numberOfEmployees;
    return employeeSchedules[employeeIndex];
  };
  
  let activeDryingPhases = [];
  const objectIds = Object.keys(tasksByObject);
  let currentObjectIndex = 0;
  
  // Aktueller Mitarbeiter für den Tag
  let currentEmployee = getCurrentEmployee(1);
  
  // ========================================================================
  // SCHRITT 1: Baustelleneinrichtung am Anfang
  // ========================================================================
  if (siteSetupMinutes > 0) {
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
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      workArea: "setup",
      workflowPhase: "vorbereitung",
      waitTime: 0,
      isPartial: false,
      isContinuation: false,
    };
    currentDay.tasks.push(setupTask);
    currentEmployee.currentDayMinutes = siteSetupMinutes;
    console.log(`🚀 Baustelleneinrichtung eingeplant: ${formatMinutesToTime(siteSetupMinutes)} (${currentEmployee.name})`);
  }
  
  // ========================================================================
  // SCHRITT 2: Hauptschleife - Arbeite alle Tasks ab
  // ========================================================================
  let maxIterations = allTasks.length * 100;
  let iteration = 0;
  
  while (hasUnfinishedTasks(allTasks) && iteration < maxIterations) {
    iteration++;
    
    // Finde nächsten verfügbaren Task
    const nextTask = findNextAvailableTaskSequential(
      tasksByObject,
      objectIds,
      currentObjectIndex,
      activeDryingPhases,
      allObjects
    );
    
    if (nextTask) {
      // Task einplanen mit aktuellem MA
      const result = scheduleTaskSequential(
        nextTask,
        currentDay,
        currentEmployee,
        dailyMinutes,
        maxDayMinutes,
        activeDryingPhases
      );
      
      // Trocknungsphase hinzufügen wenn nötig
      if (nextTask.waitTime > 0 && nextTask.remainingTime <= 0) {
        activeDryingPhases = addDryingPhase(
          activeDryingPhases,
          nextTask,
          currentEmployee.currentDayMinutes
        );
        console.log(`⏱️ Trocknungsphase gestartet für "${nextTask.serviceName}": ${formatMinutesToTime(nextTask.waitTime)}`);
      }
      
      // Tag wechseln wenn nötig
      if (result.needsNewDay) {
        // Tag finalisieren mit dem aktuellen MA
        currentDay = finalizeDay(currentDay, [currentEmployee], dailyMinutes);
        currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
        days.push(currentDay);
        
        // Neuer Tag
        const newDayNumber = days.length + 1;
        currentDay = createNewDay(newDayNumber);
        
        // Bestimme den MA für den neuen Tag
        currentEmployee = getCurrentEmployee(newDayNumber);
        currentEmployee.currentDayMinutes = 0;
        
        // Trocknungsphasen über Nacht reduzieren (z.B. 16h = 960 Minuten)
        const overnightMinutes = (24 - (companySettings.dailyHours || 8)) * 60;
        activeDryingPhases = updateDryingPhases(activeDryingPhases, overnightMinutes);
        
        console.log(`📅 Neuer Tag ${newDayNumber} - ${currentEmployee.name} übernimmt`);
      }
    } else {
      // Keine Task verfügbar - prüfe ob Trocknungszeit überbrückt werden muss
      if (activeDryingPhases.length > 0) {
        // Warte auf Trocknung (Zeit überspringen)
        const minWaitTime = Math.min(...activeDryingPhases.map(d => d.remainingTime));
        const remainingDayMinutes = dailyMinutes - currentEmployee.currentDayMinutes;
        
        if (minWaitTime <= remainingDayMinutes) {
          // Wartezeit innerhalb des Tages
          console.log(`⏳ Warte ${formatMinutesToTime(minWaitTime)} auf Trocknung...`);
          currentEmployee.currentDayMinutes += minWaitTime;
          activeDryingPhases = updateDryingPhases(activeDryingPhases, minWaitTime);
        } else {
          // Wartezeit geht über den Tag hinaus - neuer Tag
          console.log(`📅 Tag ${currentDay.day} endet - Trocknung läuft über Nacht`);
          currentDay = finalizeDay(currentDay, [currentEmployee], dailyMinutes);
          currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
          days.push(currentDay);
          
          const newDayNumber = days.length + 1;
          currentDay = createNewDay(newDayNumber);
          
          // Bestimme den MA für den neuen Tag
          currentEmployee = getCurrentEmployee(newDayNumber);
          currentEmployee.currentDayMinutes = 0;
          
          const overnightMinutes = (24 - (companySettings.dailyHours || 8)) * 60;
          activeDryingPhases = updateDryingPhases(activeDryingPhases, overnightMinutes);
        }
      } else {
        // Nächstes Objekt versuchen
        currentObjectIndex = (currentObjectIndex + 1) % objectIds.length;
        
        // Sicherheitscheck: Endlosschleife vermeiden
        if (currentObjectIndex === 0 && !hasUnfinishedTasks(allTasks)) {
          break;
        }
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
      const remainingDayMinutes = dailyMinutes - currentEmployee.currentDayMinutes;
      
      if (minWaitTime <= remainingDayMinutes) {
        // Wartezeit innerhalb des aktuellen Tages
        console.log(`⏳ Warte ${formatMinutesToTime(minWaitTime)} auf letzte Trocknung vor Räumung...`);
        currentEmployee.currentDayMinutes += minWaitTime;
        activeDryingPhases = updateDryingPhases(activeDryingPhases, minWaitTime);
      } else {
        // Neuer Tag für Wartezeit
        console.log(`📅 Neuer Tag für Trocknungs-Wartezeit vor Räumung`);
        
        if (currentDay.tasks.length > 0) {
          currentDay = finalizeDay(currentDay, [currentEmployee], dailyMinutes);
          currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
          days.push(currentDay);
        }
        
        const newDayNumber = days.length + 1;
        currentDay = createNewDay(newDayNumber);
        
        // Bestimme den MA für den neuen Tag
        currentEmployee = getCurrentEmployee(newDayNumber);
        currentEmployee.currentDayMinutes = 0;
        
        const overnightMinutes = (24 - (companySettings.dailyHours || 8)) * 60;
        activeDryingPhases = updateDryingPhases(activeDryingPhases, overnightMinutes);
      }
    }
    
    // Prüfe ob noch Platz für Räumung am aktuellen Tag
    const availableMinutes = maxDayMinutes - currentEmployee.currentDayMinutes;
    
    if (availableMinutes < siteClearanceMinutes) {
      // Neuer Tag für Räumung
      if (currentDay.tasks.length > 0) {
        currentDay = finalizeDay(currentDay, [currentEmployee], dailyMinutes);
        currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
        days.push(currentDay);
      }
      
      const newDayNumber = days.length + 1;
      currentDay = createNewDay(newDayNumber);
      
      // Bestimme den MA für den neuen Tag
      currentEmployee = getCurrentEmployee(newDayNumber);
      currentEmployee.currentDayMinutes = 0;
    }
    
    // Räumung einplanen mit aktuellem MA
    const clearanceTask = {
      id: "site-clearance",
      objectId: "project-end",
      objectName: "Baustelle",
      objectType: "Projekt",
      serviceId: "site-clearance",
      serviceName: "Baustellenräumung / Entsorgung",
      startTime: currentEmployee.currentDayMinutes,
      duration: siteClearanceMinutes,
      endTime: currentEmployee.currentDayMinutes + siteClearanceMinutes,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      workArea: "cleanup",
      workflowPhase: "finish",
      waitTime: 0,
      isPartial: false,
      isContinuation: false,
    };
    currentDay.tasks.push(clearanceTask);
    currentEmployee.currentDayMinutes += siteClearanceMinutes;
    console.log(`🧹 Baustellenräumung eingeplant: ${formatMinutesToTime(siteClearanceMinutes)} (${currentEmployee.name})`);
  }
  
  // Letzten Tag finalisieren
  if (currentDay.tasks.length > 0) {
    currentDay = finalizeDay(currentDay, [currentEmployee], dailyMinutes);
    currentDay.tasksByRoom = groupTasksByRoom(currentDay.tasks);
    days.push(currentDay);
  }
  
  // Zusammenfassung der MA-Verteilung
  const employeeDayCount = {};
  days.forEach(day => {
    day.tasks.forEach(task => {
      const empName = task.employeeName;
      employeeDayCount[empName] = (employeeDayCount[empName] || new Set()).add(day.day);
    });
  });
  
  console.log(`📅 Sequenzielle Planung abgeschlossen: ${days.length} Tage geplant`);
  console.log('👷 MA-Verteilung:', Object.entries(employeeDayCount).map(([name, days]) => `${name}: ${days.size} Tage`).join(', '));
  
  return {
    days,
    totalDays: projectDays, // Berechnete Projektdauer
    plannedDays: days.length, // Tatsächlich geplante Tage
    totalHours,
    optimalEmployees: numberOfEmployees,
    employeeExplanation: employeeResult.reasoning,
    employeeCount: numberOfEmployees,
    workPerEmployee: totalHours / numberOfEmployees,
    projectDays: projectDays,
    isParallel: false
  };
}

/**
 * Prüft ob es noch unfertige Tasks gibt
 */
function hasUnfinishedTasks(allTasks) {
  return allTasks.some(t => t.remainingTime > 0);
}

/**
 * Findet den nächsten verfügbaren Task für sequenzielle Planung
 */
function findNextAvailableTaskSequential(tasksByObject, objectIds, currentObjectIndex, activeDryingPhases, allObjects) {
  // Erst im aktuellen Objekt suchen
  for (let i = 0; i < objectIds.length; i++) {
    const objIndex = (currentObjectIndex + i) % objectIds.length;
    const objectId = objectIds[objIndex];
    const tasks = tasksByObject[objectId];
    
    for (const task of tasks) {
      if (task.remainingTime <= 0) continue;
      
      // Prüfe Vorgänger-Tasks
      const taskIndex = tasks.indexOf(task);
      const predecessorsComplete = tasks.slice(0, taskIndex).every(t => t.remainingTime <= 0);
      if (!predecessorsComplete) continue;
      
      // Prüfe Cross-Object Abhängigkeiten
      if (!checkCrossObjectDependencies(task, tasksByObject, allObjects)) continue;
      
      // Prüfe Trocknungsphasen (nur im gleichen Raum relevant)
      const dryingPhase = activeDryingPhases.find(d => d.objectId === objectId);
      if (dryingPhase) {
        const canWork = canWorkDuringDrying(
          dryingPhase.area,
          task.workArea,
          true, // sameRoom = true
          task.createsDust
        );
        if (!canWork.canWork) continue;
      }
      
      return task;
    }
  }
  
  return null;
}

/**
 * Plant einen Task für sequenzielle Planung ein
 */
function scheduleTaskSequential(task, currentDay, employee, dailyMinutes, maxDayMinutes, activeDryingPhases) {
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
  
  // Task (oder Teil davon) einplanen mit dem aktuellen MA
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
