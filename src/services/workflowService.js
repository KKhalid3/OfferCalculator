import { databaseService } from './databaseService';
import { MINUTES_PER_DAY, HOURS_PER_DAY } from '../constants';

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
        workflowExplanation: service?.workflowExplanation || null,
        waitTime: service?.waitTime || 0, // Trocknungszeit
        createsDust: service?.createsDust || false, // Erzeugt Staub (wichtig für Trocknungsphasen)
        canSplit: service?.canSplit ?? true, // Kann über Tage aufgeteilt werden?
        // Mehrpersonal-Infos
        allowMultiEmployee: service?.allowMultiEmployee ?? true,
        multiEmployeeEfficiencyKeep: service?.multiEmployeeEfficiencyKeep ?? true,
        minQuantityForMultiEmployee: service?.minQuantityForMultiEmployee || null,
        maxEmployeesForService: service?.maxEmployeesForService || null,
        efficiencyStart: service?.efficiencyStart || null
      };
    })
  );

  // Nach workflowOrder sortieren (aufsteigend)
  return enrichedCalcs.sort((a, b) => a.workflowOrder - b.workflowOrder);
}

/**
 * Erkennt den Arbeitsbereich aus dem Service-Namen
 */
function detectWorkArea(serviceName) {
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
 * Prüft ob während einer Trocknungsphase andere Arbeiten möglich sind
 * @param {string} dryingArea - Bereich der gerade trocknet (boden, wand, decke, fenster, tuer, lackierung)
 * @param {string} otherArea - Bereich der bearbeitet werden soll
 * @param {boolean} sameRoom - Ist es der gleiche Raum?
 * @param {boolean} otherTaskCreatesDust - Erzeugt die geplante Arbeit Staub?
 */
function canWorkDuringDrying(dryingArea, otherArea, sameRoom, otherTaskCreatesDust = false) {
  // Boden trocknet: Im gleichen Raum NICHTS möglich
  if (dryingArea === 'boden' && sameRoom) {
    return { canWork: false, reason: 'Boden trocknet – Raum nicht betretbar' };
  }

  // Anderer Raum: Immer möglich (wenn Kundenfreigabe)
  if (!sameRoom) {
    return { canWork: true, reason: 'Anderer Raum – unabhängig von Trocknungsphase' };
  }

  // WICHTIG: Stauberzeugende Arbeiten während Lackierung/Anstrich-Trocknung verhindern
  // Staub würde sich in der feuchten Oberfläche festsetzen
  if (otherTaskCreatesDust && ['fenster', 'tuer', 'lackierung', 'anstrich', 'wand', 'decke'].includes(dryingArea) && sameRoom) {
    return {
      canWork: false,
      reason: `Stauberzeugende Arbeit nicht möglich – ${dryingArea} trocknet noch und würde durch Staub verunreinigt`
    };
  }

  // Decke trocknet im gleichen Raum
  if (dryingArea === 'decke' && sameRoom) {
    if (['wand', 'fenster', 'tuer', 'lackierung', 'boden'].includes(otherArea)) {
      return { canWork: true, reason: 'Decke trocknet – Wände/Fenster/Türen/Boden sind unabhängig' };
    }
  }

  // Wände trocknen im gleichen Raum
  if (dryingArea === 'wand' && sameRoom) {
    if (['fenster', 'tuer'].includes(otherArea)) {
      return { canWork: true, reason: 'Wände trocknen – Fenster/Türen können bearbeitet werden' };
    }
    if (otherArea === 'decke') {
      return { canWork: false, reason: 'Wände trocknen – Deckenarbeiten würden Wände beschädigen' };
    }
  }

  // Fenster/Türen trocknen - nur nicht-stauberzeugende Arbeiten erlauben
  if (['fenster', 'tuer', 'lackierung'].includes(dryingArea) && sameRoom) {
    if (['wand', 'decke'].includes(otherArea) && !otherTaskCreatesDust) {
      return { canWork: true, reason: 'Türen/Fenster trocknen – nicht-stauberzeugende Arbeiten an Wänden/Decke möglich' };
    }
  }

  // Gleicher Bereich = warten
  if (dryingArea === otherArea) {
    return { canWork: false, reason: 'Gleicher Arbeitsbereich – muss erst trocknen' };
  }

  return { canWork: true, reason: 'Verschiedene Arbeitsbereiche – parallel möglich' };
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
 * Schritt 13: Optimale Mitarbeiteranzahl berechnen (ERWEITERT)
 * 
 * Berücksichtigt:
 * - Onboarding-Einstellungen für Mehrpersonal
 * - Effizienzgrenzen (Effektivitätsmengen)
 * - Ob parallele Arbeit in verschiedenen Räumen möglich ist
 * - Vermeidung von "Rest des Tages unproduktiv"
 * - Service-spezifische Mehrpersonal-Fähigkeit
 * 
 * @param {number} totalHours - Gesamtstunden
 * @param {Object} companySettings - Unternehmenseinstellungen
 * @param {Array} calculations - Alle Berechnungen mit Service-Infos
 * @param {number} uniqueObjects - Anzahl verschiedener Objekte/Räume
 * @param {boolean} customerApproval - Kundenfreigabe für Parallelarbeit
 */
export async function calculateOptimalEmployeesAdvanced(
  totalHours,
  companySettings,
  calculations = [],
  uniqueObjects = 1,
  customerApproval = false
) {
  const dailyHours = companySettings?.dailyHours || HOURS_PER_DAY;
  const minHoursForMulti = companySettings?.minHoursForMultiEmployee || 16;
  const minHoursPerEmployee = companySettings?.minHoursPerEmployee || 6;
  const maxEfficiencyLoss = companySettings?.maxEfficiencyLossPercent || 10;
  const allowParallelRooms = companySettings?.allowParallelRoomWork ?? true;

  const result = {
    optimalEmployees: 1,
    reasoning: [],
    efficiencyImpact: 0,
    hoursPerEmployee: totalHours,
    recommendedDays: Math.ceil(totalHours / dailyHours)
  };

  // === REGEL 1: Unter Mindestgrenze → immer 1 Mitarbeiter ===
  if (totalHours <= dailyHours) {
    result.reasoning.push({
      type: 'info',
      text: `Gesamtarbeitszeit: ${totalHours.toFixed(1)}h (${(totalHours * 60).toFixed(0)} Stunden)`
    });
    result.reasoning.push({
      type: 'info',
      text: `Arbeitstag: ${dailyHours} Stunden`
    });
    result.reasoning.push({
      type: 'info',
      text: `Berechnung: ${totalHours.toFixed(1)}h ÷ ${dailyHours}h = ${(totalHours / dailyHours).toFixed(1)} → 1 Mitarbeiter`
    });
    return result;
  }

  // === REGEL 2: Unter Mehrpersonal-Schwelle → 1 Mitarbeiter ===
  if (totalHours < minHoursForMulti) {
    result.reasoning.push({
      type: 'info',
      text: `Gesamtarbeitszeit: ${totalHours.toFixed(1)}h (${(totalHours * 60).toFixed(0)} Minuten)`
    });
    result.reasoning.push({
      type: 'info',
      text: `Arbeitstag: ${dailyHours} Stunden`
    });
    result.reasoning.push({
      type: 'info',
      text: `Berechnung: ${totalHours.toFixed(1)}h ÷ ${dailyHours}h = ${(totalHours / dailyHours).toFixed(1)} → 1 Mitarbeiter`
    });
    result.reasoning.push({
      type: 'warning',
      text: `Hinweis: Mehrpersonal wird erst ab ${minHoursForMulti}h erwogen (aktuell ${totalHours.toFixed(1)}h)`
    });
    return result;
  }

  // === REGEL 3: Berechne theoretische Mitarbeiterzahl ===
  const theoreticalEmployees = Math.ceil(totalHours / dailyHours);

  result.reasoning.push({
    type: 'info',
    text: `Gesamtarbeitszeit: ${totalHours.toFixed(1)}h (${(totalHours * 60).toFixed(0)} Minuten)`
  });
  result.reasoning.push({
    type: 'info',
    text: `Arbeitstag: ${dailyHours} Stunden`
  });
  result.reasoning.push({
    type: 'info',
    text: `Berechnung: ${totalHours.toFixed(1)}h ÷ ${dailyHours}h = ${(totalHours / dailyHours).toFixed(1)} → ${theoreticalEmployees} Mitarbeiter`
  });

  // === REGEL 4: Prüfe ob Mehrpersonal überhaupt möglich ist ===
  // Für Mehrpersonal brauchen wir entweder:
  // a) Mehrere Räume/Objekte (mit Kundenfreigabe)
  // b) Leistungen die parallel ausführbar sind

  const canWorkParallel = (customerApproval && allowParallelRooms && uniqueObjects > 1);

  // === REGEL 5: Effizienz-Prüfung ===
  // Beispiel: 32h → 2 MA = 16h/MA (OK), 3 MA = 10.7h/MA (evtl. noch OK), 4 MA = 8h/MA (grenzwertig)

  let optimalEmployees = 1;

  // Maximale Mitarbeiter: begrenzt durch Räume wenn Parallelarbeit, sonst durch theoretische Anzahl
  const maxEmployees = canWorkParallel
    ? Math.min(theoreticalEmployees, uniqueObjects)
    : theoreticalEmployees;

  for (let emp = 1; emp <= maxEmployees; emp++) {
    const hoursPerEmp = totalHours / emp;
    const daysNeeded = Math.ceil(hoursPerEmp / dailyHours);

    // Prüfe ob jeder Mitarbeiter genug Arbeit hat
    if (hoursPerEmp < minHoursPerEmployee) {
      // Zu wenig Stunden pro Mitarbeiter → Leerlauf
      result.reasoning.push({
        type: 'warning',
        text: `${emp} Mitarbeiter: ${hoursPerEmp.toFixed(1)}h pro Person < ${minHoursPerEmployee}h Minimum → Leerlauf`
      });
      break;
    }

    // Prüfe ob der "Rest des Tages unproduktiv" Fall auftritt
    const restOfLastDay = (daysNeeded * dailyHours) - hoursPerEmp;
    if (restOfLastDay > (dailyHours * 0.5) && emp > 1) {
      // Mehr als halber Tag Leerlauf → nicht sinnvoll
      result.reasoning.push({
        type: 'warning',
        text: `${emp} Mitarbeiter: ${restOfLastDay.toFixed(1)}h Leerlauf am letzten Tag → ineffizient`
      });
      continue;
    }

    // Diese Konfiguration ist akzeptabel
    optimalEmployees = emp;
    result.hoursPerEmployee = hoursPerEmp;
  }

  // === REGEL 6: Warnung bei Trocknungszeit ohne Kundenfreigabe ===
  const totalWaitTime = calculations.reduce((sum, c) => sum + (c.waitTime || 0), 0);
  if (totalWaitTime > 0 && !customerApproval) {
    result.reasoning.push({
      type: 'warning',
      text: `Hinweis: Es gibt ${(totalWaitTime / 60).toFixed(1)}h Trocknungszeit. Ohne Kundenfreigabe muss gewartet werden, bis die Oberflächen getrocknet sind.`
    });
  }

  // === REGEL 7: Tipp für Parallelarbeit ===
  if (customerApproval && uniqueObjects > 1 && optimalEmployees < uniqueObjects) {
    result.reasoning.push({
      type: 'tip',
      text: `Tipp: Mit Kundenfreigabe könnten während der Trocknungszeiten Arbeiten in anderen Räumen durchgeführt werden.`
    });
  } else if (!customerApproval && uniqueObjects > 1 && totalWaitTime > 0) {
    result.reasoning.push({
      type: 'parallel',
      text: `Tipp: Mit Kundenfreigabe könnten während der Trocknungszeiten Arbeiten in anderen Räumen durchgeführt werden.`
    });
  }

  result.optimalEmployees = optimalEmployees;
  result.recommendedDays = Math.ceil(result.hoursPerEmployee / dailyHours);

  return result;
}

/**
 * Schritt 13: Optimale Mitarbeiteranzahl berechnen (EINFACH - Fallback)
 */
export function calculateOptimalEmployees(totalHours, dailyHours = HOURS_PER_DAY) {
  if (totalHours <= dailyHours) return 1;

  const employees = Math.ceil(totalHours / dailyHours);

  // Prüfen ob Effizienzverlust auftritt
  const hoursPerEmployee = totalHours / employees;
  if (hoursPerEmployee < 4) {
    // Zu wenig Stunden pro Mitarbeiter = Effizienzverlust
    return Math.max(1, Math.floor(totalHours / 4));
  }

  return employees;
}

/**
 * NEUE INTELLIGENTE TAGESPLANUNG
 * 
 * Optimiert die Tagesfüllung durch:
 * 1. Trocknungszeiten für andere Arbeiten nutzen
 * 2. Tasks über Tage aufteilen wenn nötig
 * 3. Logische Abhängigkeiten respektieren
 * 4. Tage so voll wie möglich füllen
 * 5. Überstunden-Toleranz für kleine Rest-Tasks
 */
export async function planWorkflowOptimized(calculations, customerApproval) {
  const companySettings = await databaseService.getCompanySettings();
  const dailyMinutes = (companySettings?.dailyHours || HOURS_PER_DAY) * 60;

  // Überstunden-Einstellungen
  const maxOvertimePercent = companySettings?.maxOvertimePercent ?? 15;
  const minTaskSplitTime = companySettings?.minTaskSplitTime ?? 60;
  const maxDayMinutes = Math.round(dailyMinutes * (1 + maxOvertimePercent / 100));

  // Schritt 1: Alle Tasks mit Details anreichern und nach Objekten gruppieren
  const enrichedCalcs = await sortServicesByWorkflow(calculations);

  // Gruppiere nach Objekten für intelligente Planung
  const tasksByObject = {};
  const allTasks = [];

  for (const calc of enrichedCalcs) {
    const task = {
      id: calc.id,
      objectId: calc.objectId,
      serviceId: calc.serviceId,
      serviceName: calc.serviceName || '',
      totalTime: calc.finalTime, // Gesamtzeit in Minuten
      remainingTime: calc.finalTime, // Noch zu planende Zeit
      waitTime: calc.waitTime || 0, // Trocknungszeit
      workflowOrder: calc.workflowOrder,
      workflowPhase: calc.workflowPhase,
      workArea: detectWorkArea(calc.serviceName),
      createsDust: calc.createsDust || false, // Stauberzeugung
      canSplit: calc.canSplit ?? true,
      scheduled: false,
      splitParts: [], // Falls aufgeteilt: [{day, startTime, duration}]
    };

    allTasks.push(task);

    if (!tasksByObject[calc.objectId]) {
      tasksByObject[calc.objectId] = [];
    }
    tasksByObject[calc.objectId].push(task);
  }

  // Sortiere Tasks innerhalb jedes Objekts nach workflowOrder
  for (const objectId in tasksByObject) {
    tasksByObject[objectId].sort((a, b) => a.workflowOrder - b.workflowOrder);
  }

  // Schritt 2: Intelligente Tagesplanung
  const days = [];
  let currentDay = createNewDay(1);
  let activeDryingPhases = []; // Aktive Trocknungsphasen: [{objectId, area, endsAt}]
  const objectIds = Object.keys(tasksByObject);
  let currentObjectIndex = 0;

  // Hilfsfunktion: Nächsten verfügbaren Task finden
  function getNextAvailableTask() {
    // Priorität 1: Task im aktuellen Objekt (Workflow-Reihenfolge)
    for (let i = 0; i < objectIds.length; i++) {
      const objIndex = (currentObjectIndex + i) % objectIds.length;
      const objectId = objectIds[objIndex];
      const tasks = tasksByObject[objectId];

      for (const task of tasks) {
        if (task.remainingTime <= 0) continue;

        // Prüfe ob Vorgänger-Tasks im Objekt abgeschlossen sind
        const taskIndex = tasks.indexOf(task);
        const predecessorsComplete = tasks.slice(0, taskIndex).every(t => t.remainingTime <= 0);
        if (!predecessorsComplete) continue;

        // Prüfe ob Objekt gerade in Trocknungsphase ist
        const dryingPhase = activeDryingPhases.find(d => d.objectId === objectId);
        if (dryingPhase) {
          // Prüfe ob diese Arbeit während der Trocknung möglich ist
          // WICHTIG: Stauberzeugende Arbeiten nicht während Trocknung im gleichen Raum
          const canWork = canWorkDuringDrying(dryingPhase.area, task.workArea, true, task.createsDust);
          if (!canWork.canWork) continue;
        }

        return { task, objectId, reason: 'Nächster Task in Workflow-Reihenfolge' };
      }
    }

    // Priorität 2: Task aus anderem Objekt (wenn Kundenfreigabe oder Trocknungszeit)
    if (customerApproval || activeDryingPhases.length > 0) {
      for (const objectId of objectIds) {
        // Überspringe Objekte in Trocknungsphase (nur für gleiche Fläche)
        const tasks = tasksByObject[objectId];

        for (const task of tasks) {
          if (task.remainingTime <= 0) continue;

          // Prüfe Vorgänger
          const taskIndex = tasks.indexOf(task);
          const predecessorsComplete = tasks.slice(0, taskIndex).every(t => t.remainingTime <= 0);
          if (!predecessorsComplete) continue;

          return { task, objectId, reason: 'Parallele Arbeit in anderem Raum' };
        }
      }
    }

    return null;
  }

  // Hilfsfunktion: Task zum Tag hinzufügen (mit Überstunden-Logik)
  function addTaskToDay(task, objectId) {
    const remainingInDay = dailyMinutes - currentDay.minutes;
    const maxRemainingWithOvertime = maxDayMinutes - currentDay.minutes;

    // Wenn Tag schon über Maximum → kein Platz mehr
    if (maxRemainingWithOvertime <= 0) return false;

    let timeToSchedule = 0;
    let isOvertime = false;
    let isPartial = false;

    // ENTSCHEIDUNGSLOGIK:
    // 1. Passt Task komplett in reguläre Zeit?
    if (task.remainingTime <= remainingInDay) {
      timeToSchedule = task.remainingTime;
      isPartial = false;
      isOvertime = false;
    }
    // 2. Passt Task komplett MIT Überstunden?
    else if (task.remainingTime <= maxRemainingWithOvertime) {
      timeToSchedule = task.remainingTime;
      isPartial = false;
      isOvertime = currentDay.minutes + task.remainingTime > dailyMinutes;
    }
    // 3. Task muss aufgeteilt werden
    else {
      const potentialRest = task.remainingTime - maxRemainingWithOvertime;

      // Wenn Rest < minTaskSplitTime → alles mit Überstunden machen (wenn möglich)
      if (potentialRest < minTaskSplitTime && potentialRest > 0) {
        if (task.remainingTime <= maxDayMinutes * 1.1) {
          timeToSchedule = task.remainingTime;
          isPartial = false;
          isOvertime = true;
        } else {
          timeToSchedule = maxRemainingWithOvertime;
          isPartial = true;
          isOvertime = currentDay.minutes + timeToSchedule > dailyMinutes;
        }
      }
      // Wenn heutiger Teil < minTaskSplitTime → lieber alles morgen
      else if (remainingInDay < minTaskSplitTime && remainingInDay > 0) {
        return false; // Task auf morgen verschieben
      }
      // Normale Aufteilung: Mit Überstunden so viel wie möglich heute
      else {
        timeToSchedule = maxRemainingWithOvertime;
        isPartial = true;
        isOvertime = currentDay.minutes + timeToSchedule > dailyMinutes;
      }
    }

    // Task oder Teil davon einplanen
    const taskEntry = {
      taskId: task.id,
      objectId: objectId,
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      workArea: task.workArea,
      startTime: currentDay.minutes,
      duration: timeToSchedule,
      isPartial: isPartial,
      isContinuation: task.totalTime !== task.remainingTime,
      isOvertime: isOvertime,
      waitTime: (!isPartial) ? task.waitTime : 0, // Trocknung nur wenn komplett
    };

    currentDay.tasks.push(taskEntry);
    currentDay.minutes += timeToSchedule;
    currentDay.hours = currentDay.minutes / 60;
    task.remainingTime -= timeToSchedule;

    // Überstunden-Marker
    if (isOvertime) {
      currentDay.hasOvertime = true;
      currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
    }

    // Trocknungsphase starten wenn Task abgeschlossen und Wartezeit > 0
    if (task.remainingTime <= 0 && task.waitTime > 0) {
      currentDay.waitTimes.push({
        serviceId: task.serviceId,
        objectId: objectId,
        duration: task.waitTime,
        startTime: currentDay.minutes,
        workArea: task.workArea
      });

      // Aktive Trocknungsphase hinzufügen
      activeDryingPhases.push({
        objectId: objectId,
        area: task.workArea,
        endsAt: currentDay.minutes + task.waitTime,
        serviceName: task.serviceName
      });
    }

    if (task.remainingTime <= 0) {
      task.scheduled = true;
    }

    return true;
  }

  // Hauptschleife: Tage füllen
  let iterations = 0;
  const maxIterations = 1000; // Sicherheit gegen Endlosschleifen

  while (iterations < maxIterations) {
    iterations++;

    // Prüfe ob alle Tasks erledigt sind
    const allDone = allTasks.every(t => t.remainingTime <= 0);
    if (allDone) break;

    // Abgelaufene Trocknungsphasen entfernen
    activeDryingPhases = activeDryingPhases.filter(d => d.endsAt > currentDay.minutes);

    // Nächsten Task finden
    const next = getNextAvailableTask();

    if (next) {
      const added = addTaskToDay(next.task, next.objectId);

      if (!added) {
        // Tag voll - neuen Tag starten
        days.push(currentDay);
        currentDay = createNewDay(days.length + 1);
        // Trocknungsphasen werden über Nacht abgeschlossen
        activeDryingPhases = [];
        continue;
      }

      // Nach jedem Task: Prüfen ob wir während einer Trocknungsphase sind
      // und ob wir zu einem anderen Objekt wechseln können
      if (activeDryingPhases.length > 0 && customerApproval) {
        // Wechsle zum nächsten Objekt
        currentObjectIndex = (currentObjectIndex + 1) % objectIds.length;
      }
    } else {
      // Kein Task verfügbar - entweder alle in Trocknung oder Tag voll (inkl. Überstunden)
      if (currentDay.minutes >= maxDayMinutes * 0.95) {
        // Tag ist fast voll (inkl. Überstunden)
        // Überstunden-Info setzen
        currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
        currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
        days.push(currentDay);
        currentDay = createNewDay(days.length + 1);
        activeDryingPhases = [];
      } else if (activeDryingPhases.length > 0) {
        // Trocknungszeit - Zeit vorspulen zur nächsten Aktivität
        // oder Tag beenden wenn Trocknung über Nacht (auch mit Überstunden)
        const minDryingEnd = Math.min(...activeDryingPhases.map(d => d.endsAt));

        if (minDryingEnd <= maxDayMinutes) {
          // Trocknung endet heute noch (evtl. mit Überstunden) - Zeit vorspulen
          currentDay.minutes = minDryingEnd;
          currentDay.hours = currentDay.minutes / 60;
          activeDryingPhases = activeDryingPhases.filter(d => d.endsAt > currentDay.minutes);
        } else {
          // Trocknung dauert bis morgen
          // Prüfen ob noch unerledigte Tasks in anderen Objekten gibt
          const unfinishedOtherObjects = allTasks.filter(t =>
            t.remainingTime > 0 &&
            !activeDryingPhases.some(d => d.objectId === t.objectId)
          );

          if (unfinishedOtherObjects.length > 0 && customerApproval) {
            // Es gibt noch Arbeit in anderen Räumen - weitermachen
            continue;
          } else {
            // Tag beenden - Trocknung über Nacht
            currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
            currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
            days.push(currentDay);
            currentDay = createNewDay(days.length + 1);
            activeDryingPhases = [];
          }
        }
      } else {
        // Keine Trocknungsphase und kein Task - sollte nicht passieren
        // Sicherheitshalber neuen Tag starten
        if (currentDay.tasks.length > 0) {
          currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
          currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
          days.push(currentDay);
          currentDay = createNewDay(days.length + 1);
        } else {
          break; // Verhindern von leeren Tagen
        }
      }
    }
  }

  // Letzten Tag hinzufügen
  if (currentDay.tasks.length > 0) {
    currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
    currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
    days.push(currentDay);
  }

  // Schritt 3: Mitarbeiterberechnung
  const totalHours = allTasks.reduce((sum, t) => sum + t.totalTime, 0) / 60;
  const uniqueObjects = new Set(allTasks.map(t => t.objectId)).size;

  const employeeResult = await calculateOptimalEmployeesAdvanced(
    totalHours,
    companySettings,
    enrichedCalcs,
    uniqueObjects,
    customerApproval
  );

  // Workflows in RxDB speichern
  await databaseService.deleteAllWorkflows();
  for (const day of days) {
    await databaseService.saveWorkflow({
      day: day.day,
      hours: day.hours,
      employees: employeeResult.optimalEmployees,
      calculationIds: day.tasks.map(t => t.taskId),
      waitTimes: day.waitTimes,
      parallelWork: []
    });
  }

  return {
    days,
    totalDays: days.length,
    totalHours,
    optimalEmployees: employeeResult.optimalEmployees,
    employeeExplanation: employeeResult.reasoning
  };
}

function createNewDay(dayNumber) {
  return {
    day: dayNumber,
    hours: 0,
    minutes: 0,
    tasks: [],
    waitTimes: [],
    hasOvertime: false,
    overtimeMinutes: 0
  };
}

/**
 * Hauptfunktion: Workflow planen (nutzt jetzt die optimierte Version)
 */
export async function planWorkflow(calculations, customerApproval) {
  return planWorkflowOptimized(calculations, customerApproval);
}

