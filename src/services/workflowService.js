import { databaseService } from './databaseService';
import { MINUTES_PER_DAY, HOURS_PER_DAY } from '../constants';

/**
 * Workflow-Phasen mit Prioritäten für logischen Arbeitsablauf
 * Niedrigere Nummer = früher im Ablauf
 */
const WORKFLOW_PHASES = {
  'einrichtung': 1,     // Baustelleneinrichtung
  'vorbereitung': 2,    // Abdecken, Schutz
  'abbruch': 3,         // Tapeten entfernen, Abbruch
  'untergrund': 4,      // Spachteln, Schleifen
  'grundierung': 5,     // Grundierungen
  'tapezieren': 6,      // Tapezieren
  'beschichtung': 7,    // Streichen, Anstrich
  'lackierung': 8,      // Türen, Fenster lackieren
  'abschluss': 9        // Aufräumen, Entsorgen
};

/**
 * Schritt 12: Sortierung nach Workflow
 * Sortiert Services nach ihrer workflowPhase UND workflowOrder für logische Arbeitsreihenfolge
 * 
 * VERBESSERUNG: Zweistufige Sortierung
 * 1. Nach Phase (Vorbereitung → Untergrund → Beschichtung → Lackierung → Abschluss)
 * 2. Innerhalb der Phase nach workflowOrder
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
        // NEU: Gebündelte Services nicht im Workflow anzeigen
        showInWorkflow: service?.showInWorkflow ?? true,
        bundleCalculation: service?.bundleCalculation || false,
        // Mehrpersonal-Infos
        allowMultiEmployee: service?.allowMultiEmployee ?? true,
        multiEmployeeEfficiencyKeep: service?.multiEmployeeEfficiencyKeep ?? true,
        minQuantityForMultiEmployee: service?.minQuantityForMultiEmployee || null,
        maxEmployeesForService: service?.maxEmployeesForService || null,
        efficiencyStart: service?.efficiencyStart || null
      };
    })
  );

  // Filtere gebündelte Services heraus (showInWorkflow: false)
  const visibleCalcs = enrichedCalcs.filter(calc => calc.showInWorkflow !== false);

  if (enrichedCalcs.length !== visibleCalcs.length) {
    const hiddenCount = enrichedCalcs.length - visibleCalcs.length;
    console.log(`📦 ${hiddenCount} gebündelte Unterleistung(en) aus Workflow-Anzeige entfernt`);
  }

  // ZWEISTUFIGE SORTIERUNG: Phase → workflowOrder
  return visibleCalcs.sort((a, b) => {
    // 1. Nach Phase sortieren (niedrigere Phase-Nummer = früher)
    const phaseA = WORKFLOW_PHASES[a.workflowPhase] || 7;
    const phaseB = WORKFLOW_PHASES[b.workflowPhase] || 7;

    if (phaseA !== phaseB) {
      return phaseA - phaseB;
    }

    // 2. Innerhalb der Phase nach workflowOrder
    return a.workflowOrder - b.workflowOrder;
  });
}

/**
 * NEU: Prüft Cross-Object Abhängigkeiten
 * Schleifen auf Türen/Fenstern MUSS vor Anstrich auf Wänden/Decken im selben Raum erfolgen
 * @param {Object} task - Der zu prüfende Task
 * @param {Object} tasksByObject - Alle Tasks gruppiert nach Objekten
 * @param {Array} objects - Alle Objekt-Definitionen
 * @returns {boolean} - true wenn Task ausgeführt werden darf
 */
function checkCrossObjectDependencies(task, tasksByObject, objects) {
  // Nur relevant für 'beschichtung' Phase Tasks (Anstrich auf Wänden)
  if (task.workflowPhase !== 'beschichtung') return true;

  // Nur relevant wenn der Arbeitsbereich 'anstrich', 'wand' oder 'decke' ist
  if (!['anstrich', 'wand', 'decke', 'allgemein'].includes(task.workArea)) return true;

  // Finde das Objekt für diesen Task
  const taskObject = objects?.find(obj => obj.id === task.objectId);
  if (!taskObject) return true;

  // Nur relevant für Raum-Objekte
  if (taskObject.objectCategory !== 'raum') return true;

  const roomId = task.objectId;

  // Finde alle Türen/Fenster die diesem Raum zugeordnet sind
  const relatedDoorWindowObjects = objects?.filter(obj =>
    (obj.objectCategory === 'tuer' || obj.objectCategory === 'fenster') &&
    obj.assignedToRoomId === roomId
  ) || [];

  // Prüfe ob alle Schleifen-Tasks auf diesen Türen/Fenstern abgeschlossen sind
  for (const relObj of relatedDoorWindowObjects) {
    const relTasks = tasksByObject[relObj.id] || [];

    for (const relTask of relTasks) {
      // Prüfe nur Tasks in Phase 'untergrund' (Schleifen)
      if (relTask.workflowPhase === 'untergrund' && relTask.remainingTime > 0) {
        console.log(`⏳ Cross-Object Abhängigkeit: "${task.serviceName}" wartet auf "${relTask.serviceName}" (${relObj.name})`);
        return false; // Schleifen noch nicht fertig → Anstrich muss warten
      }
    }
  }

  return true; // Alle Abhängigkeiten erfüllt
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

    // === NEU: Effizienz-Verlust prüfen ===
    // Pro zusätzlichem Mitarbeiter ca. 5% Effizienzverlust durch Koordination
    const efficiencyLossPerEmployee = 5; // 5% pro zusätzlichem MA
    const totalEfficiencyLoss = (emp - 1) * efficiencyLossPerEmployee;

    if (totalEfficiencyLoss > maxEfficiencyLoss && emp > 1) {
      result.reasoning.push({
        type: 'warning',
        text: `${emp} Mitarbeiter: ${totalEfficiencyLoss}% Effizienzverlust > ${maxEfficiencyLoss}% Maximum`
      });
      continue;
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

    // Effizienz-Info hinzufügen wenn mehr als 1 MA
    if (emp > 1 && totalEfficiencyLoss > 0) {
      result.reasoning.push({
        type: 'info',
        text: `${emp} Mitarbeiter: ${totalEfficiencyLoss}% Koordinations-Overhead (akzeptabel)`
      });
    }
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

  // NEU: Alle Objekte laden für Cross-Object Abhängigkeiten
  const allObjects = await databaseService.getAllObjects();

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
      assignedEmployee: null, // NEU: Zugewiesener Mitarbeiter
    };

    allTasks.push(task);

    if (!tasksByObject[calc.objectId]) {
      tasksByObject[calc.objectId] = [];
    }
    tasksByObject[calc.objectId].push(task);
  }

  // Sortiere Tasks innerhalb jedes Objekts:
  // 1. Nach workflowPhase (Vorbereitung → Beschichtung → Lackierung → Abschluss)
  // 2. Innerhalb der Phase: Längere Trocknungszeiten zuerst (Drying-First!)
  // 3. Dann nach workflowOrder
  for (const objectId in tasksByObject) {
    tasksByObject[objectId].sort((a, b) => {
      // Nach Phase sortieren
      const phaseA = WORKFLOW_PHASES[a.workflowPhase] || 7;
      const phaseB = WORKFLOW_PHASES[b.workflowPhase] || 7;
      if (phaseA !== phaseB) return phaseA - phaseB;

      // Innerhalb der Phase: Trocknungszeit (längere zuerst)
      const waitDiff = (b.waitTime || 0) - (a.waitTime || 0);
      if (waitDiff !== 0) return waitDiff;

      // Nach workflowOrder
      return a.workflowOrder - b.workflowOrder;
    });
  }

  // === NEU: MITARBEITERANZAHL ZUERST BERECHNEN ===
  const totalHours = allTasks.reduce((sum, t) => sum + t.totalTime, 0) / 60;
  const uniqueObjects = new Set(allTasks.map(t => t.objectId)).size;

  const employeeResult = await calculateOptimalEmployeesAdvanced(
    totalHours,
    companySettings,
    enrichedCalcs,
    uniqueObjects,
    customerApproval
  );

  const numberOfEmployees = employeeResult.optimalEmployees || 1;
  console.log(`👷 Plane mit ${numberOfEmployees} Mitarbeiter(n) für ${totalHours.toFixed(1)}h Arbeit`);

  // Schritt 2: Intelligente MEHRPERSONAL-Tagesplanung
  const days = [];
  let currentDay = createNewDay(1);

  // NEU: Mitarbeiter-Zeitslots verwalten
  // Jeder Mitarbeiter hat seine eigene Timeline pro Tag
  const employeeSchedules = [];
  for (let i = 0; i < numberOfEmployees; i++) {
    employeeSchedules.push({
      id: i + 1,
      name: `MA ${i + 1}`,
      currentDayMinutes: 0,
      currentObjectId: null, // Welches Objekt bearbeitet der MA gerade?
      activeDryingPhase: null
    });
  }

  let activeDryingPhases = []; // Aktive Trocknungsphasen: [{objectId, area, endsAt, startedByEmployee}]
  const objectIds = Object.keys(tasksByObject);
  let currentObjectIndex = 0;

  // Hilfsfunktion: Nächsten verfügbaren Task für einen Mitarbeiter finden
  // VERBESSERUNG: "Drying-First" Strategie - Tasks mit langen Trocknungszeiten zuerst
  // NEU: Berücksichtigt welchen Raum der Mitarbeiter gerade bearbeitet
  function getNextAvailableTask(employee) {
    const availableTasks = [];

    // Sammle ALLE verfügbaren Tasks
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

        // NEU: Prüfe Cross-Object Abhängigkeiten (Schleifen Türen/Fenster vor Anstrich Wände)
        if (!checkCrossObjectDependencies(task, tasksByObject, allObjects)) continue;

        // Prüfe ob Objekt gerade in Trocknungsphase ist
        const dryingPhase = activeDryingPhases.find(d => d.objectId === objectId);
        if (dryingPhase) {
          // Prüfe ob diese Arbeit während der Trocknung möglich ist
          // WICHTIG: Stauberzeugende Arbeiten nicht während Trocknung im gleichen Raum
          const canWork = canWorkDuringDrying(dryingPhase.area, task.workArea, true, task.createsDust);
          if (!canWork.canWork) continue;
        }

        // NEU: Prüfe ob ein anderer Mitarbeiter dieses Objekt gerade bearbeitet
        // Mehrere MA können nur in UNTERSCHIEDLICHEN Räumen gleichzeitig arbeiten
        const otherEmployeeInSameObject = employeeSchedules.some(
          e => e.id !== employee.id && e.currentObjectId === objectId && e.currentDayMinutes < dailyMinutes
        );
        if (otherEmployeeInSameObject && numberOfEmployees > 1) {
          // Nur erlauben wenn Kundenfreigabe UND verschiedene Arbeitsbereiche
          if (!customerApproval) continue;
        }

        availableTasks.push({
          task,
          objectId,
          reason: 'Nächster Task in Workflow-Reihenfolge',
          isCurrentObject: employee.currentObjectId === objectId || objIndex === currentObjectIndex
        });
      }
    }

    // Priorität 2: Task aus anderem Objekt (wenn Kundenfreigabe oder Trocknungszeit)
    if ((customerApproval || activeDryingPhases.length > 0) && availableTasks.length === 0) {
      for (const objectId of objectIds) {
        const tasks = tasksByObject[objectId];

        for (const task of tasks) {
          if (task.remainingTime <= 0) continue;

          // Prüfe Vorgänger
          const taskIndex = tasks.indexOf(task);
          const predecessorsComplete = tasks.slice(0, taskIndex).every(t => t.remainingTime <= 0);
          if (!predecessorsComplete) continue;

          // NEU: Prüfe Cross-Object Abhängigkeiten auch bei paralleler Arbeit
          if (!checkCrossObjectDependencies(task, tasksByObject, allObjects)) continue;

          availableTasks.push({
            task,
            objectId,
            reason: 'Parallele Arbeit in anderem Raum',
            isCurrentObject: false
          });
        }
      }
    }

    if (availableTasks.length === 0) return null;

    // === DRYING-FIRST STRATEGIE ===
    // Sortiere verfügbare Tasks:
    // 1. Längere Trocknungszeit = höhere Priorität (früher machen!)
    // 2. Bei gleicher Trocknungszeit: Objekt des Mitarbeiters bevorzugen
    // 3. Bei gleichem Objekt: nach workflowOrder
    availableTasks.sort((a, b) => {
      // Trocknungszeit: Längere zuerst (absteigend)
      const waitDiff = (b.task.waitTime || 0) - (a.task.waitTime || 0);
      if (waitDiff !== 0) return waitDiff;

      // Aktuelles Objekt des Mitarbeiters bevorzugen
      if (a.isCurrentObject && !b.isCurrentObject) return -1;
      if (!a.isCurrentObject && b.isCurrentObject) return 1;

      // Nach Workflow-Order (aufsteigend)
      return a.task.workflowOrder - b.task.workflowOrder;
    });

    const selected = availableTasks[0];

    // Debug-Log wenn Drying-First aktiv
    if (selected.task.waitTime > 0 && availableTasks.length > 1) {
      console.log(`🔄 Drying-First: "${selected.task.serviceName}" priorisiert (${selected.task.waitTime} min Trocknungszeit)`);
    }

    return selected;
  }

  // Hilfsfunktion: Task zum Tag hinzufügen (mit Mitarbeiter-Zuweisung)
  function addTaskToDay(task, objectId, employee) {
    const remainingInDay = dailyMinutes - employee.currentDayMinutes;
    const maxRemainingWithOvertime = maxDayMinutes - employee.currentDayMinutes;

    // Wenn Mitarbeiter-Tag schon über Maximum → kein Platz mehr
    if (maxRemainingWithOvertime <= 0) return false;

    let timeToSchedule = 0;
    let isOvertime = false;
    let isPartial = false;

    // === NEUE ÜBERSTUNDEN-REGEL ===
    // Überstunden NUR wenn:
    // 1. Task wurde HEUTE BEGONNEN (nicht Fortsetzung von gestern)
    // 2. Task kann MIT Überstunden KOMPLETT beendet werden
    // Sonst ergibt es keinen Sinn!

    const isNewTaskToday = task.totalTime === task.remainingTime; // Noch nie angefangen
    const canFinishWithOvertime = task.remainingTime <= maxRemainingWithOvertime;

    // ENTSCHEIDUNGSLOGIK:
    // 1. Passt Task komplett in reguläre Zeit?
    if (task.remainingTime <= remainingInDay) {
      timeToSchedule = task.remainingTime;
      isPartial = false;
      isOvertime = false;
    }
    // 2. Task HEUTE begonnen UND kann MIT Überstunden fertig werden → Überstunden SINNVOLL
    else if (isNewTaskToday && canFinishWithOvertime) {
      timeToSchedule = task.remainingTime;
      isPartial = false;
      isOvertime = employee.currentDayMinutes + task.remainingTime > dailyMinutes;
      console.log(`✅ Überstunden sinnvoll: "${task.serviceName}" wird heute abgeschlossen (${Math.round(timeToSchedule)} min, MA ${employee.id})`);
    }
    // 3. Überstunden NICHT sinnvoll - Task aufteilen oder verschieben
    else {
      // Wenn genug Zeit heute (ohne Überstunden) → regulär arbeiten, Rest morgen
      if (remainingInDay >= minTaskSplitTime) {
        timeToSchedule = remainingInDay;
        isPartial = true;
        isOvertime = false;
        console.log(`⏸️ Keine Überstunden: "${task.serviceName}" wird morgen fortgesetzt (${Math.round(task.remainingTime - remainingInDay)} min übrig)`);
      }
      // Zu wenig Zeit heute → komplett auf morgen verschieben
      else {
        console.log(`⏭️ "${task.serviceName}" auf morgen verschoben (nur ${Math.round(remainingInDay)} min übrig für MA ${employee.id})`);
        return false;
      }
    }

    // Task oder Teil davon einplanen
    const taskEntry = {
      taskId: task.id,
      objectId: objectId,
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      workArea: task.workArea,
      startTime: employee.currentDayMinutes,
      duration: timeToSchedule,
      isPartial: isPartial,
      isContinuation: task.totalTime !== task.remainingTime,
      isOvertime: isOvertime,
      waitTime: (!isPartial) ? task.waitTime : 0, // Trocknung nur wenn komplett
      // NEU: Mitarbeiter-Zuweisung
      employeeId: employee.id,
      employeeName: employee.name,
    };

    currentDay.tasks.push(taskEntry);

    // Mitarbeiter-Zeit aktualisieren
    employee.currentDayMinutes += timeToSchedule;
    employee.currentObjectId = objectId;
    task.assignedEmployee = employee.id;

    // Tag-Gesamtzeit = längste Mitarbeiter-Zeit
    const maxEmployeeMinutes = Math.max(...employeeSchedules.map(e => e.currentDayMinutes));
    currentDay.minutes = maxEmployeeMinutes;
    currentDay.hours = currentDay.minutes / 60;
    task.remainingTime -= timeToSchedule;

    // Überstunden-Marker (wenn ein MA Überstunden macht)
    if (isOvertime) {
      currentDay.hasOvertime = true;
      currentDay.overtimeMinutes = Math.max(currentDay.overtimeMinutes || 0, employee.currentDayMinutes - dailyMinutes);
    }

    // Trocknungsphase starten wenn Task abgeschlossen und Wartezeit > 0
    if (task.remainingTime <= 0 && task.waitTime > 0) {
      currentDay.waitTimes.push({
        serviceId: task.serviceId,
        objectId: objectId,
        duration: task.waitTime,
        startTime: employee.currentDayMinutes,
        workArea: task.workArea,
        employeeId: employee.id
      });

      // Aktive Trocknungsphase hinzufügen
      activeDryingPhases.push({
        objectId: objectId,
        area: task.workArea,
        endsAt: employee.currentDayMinutes + task.waitTime,
        serviceName: task.serviceName,
        startedByEmployee: employee.id
      });
    }

    if (task.remainingTime <= 0) {
      task.scheduled = true;
    }

    return true;
  }

  // NEU: Finde den Mitarbeiter mit der geringsten Arbeitszeit heute
  function getAvailableEmployee() {
    // Sortiere nach verfügbarer Zeit (wer am wenigsten gearbeitet hat)
    const available = employeeSchedules
      .filter(e => e.currentDayMinutes < maxDayMinutes)
      .sort((a, b) => a.currentDayMinutes - b.currentDayMinutes);

    return available.length > 0 ? available[0] : null;
  }

  // Hauptschleife: Tage füllen (MEHRPERSONAL-Version)
  let iterations = 0;
  const maxIterations = 1000; // Sicherheit gegen Endlosschleifen

  while (iterations < maxIterations) {
    iterations++;

    // Prüfe ob alle Tasks erledigt sind
    const allDone = allTasks.every(t => t.remainingTime <= 0);
    if (allDone) break;

    // Abgelaufene Trocknungsphasen entfernen (basierend auf Mitarbeiter-Zeit)
    const maxEmployeeTime = Math.max(...employeeSchedules.map(e => e.currentDayMinutes));
    activeDryingPhases = activeDryingPhases.filter(d => d.endsAt > maxEmployeeTime);

    // NEU: Finde verfügbaren Mitarbeiter
    const employee = getAvailableEmployee();

    if (!employee) {
      // Alle Mitarbeiter haben ihr Tageslimit erreicht → neuen Tag starten
      currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
      currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
      days.push(currentDay);
      currentDay = createNewDay(days.length + 1);
      // Mitarbeiter-Zeiten zurücksetzen für neuen Tag
      employeeSchedules.forEach(e => {
        e.currentDayMinutes = 0;
        e.currentObjectId = null;
      });
      activeDryingPhases = [];
      continue;
    }

    // Nächsten Task für diesen Mitarbeiter finden
    const next = getNextAvailableTask(employee);

    if (next) {
      const added = addTaskToDay(next.task, next.objectId, employee);

      if (!added) {
        // Dieser Mitarbeiter kann nichts mehr hinzufügen
        // Markiere als "voll" für heute
        employee.currentDayMinutes = maxDayMinutes;
        continue;
      }

      // Nach jedem Task: Prüfen ob wir während einer Trocknungsphase sind
      // und ob wir zu einem anderen Objekt wechseln können
      if (activeDryingPhases.length > 0 && customerApproval) {
        // Wechsle zum nächsten Objekt
        currentObjectIndex = (currentObjectIndex + 1) % objectIds.length;
      }
    } else {
      // Kein Task verfügbar für diesen Mitarbeiter
      const allEmployeesFull = employeeSchedules.every(e => e.currentDayMinutes >= maxDayMinutes * 0.95);

      if (allEmployeesFull) {
        // Alle Mitarbeiter voll - Tag beenden
        currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
        currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
        days.push(currentDay);
        currentDay = createNewDay(days.length + 1);
        employeeSchedules.forEach(e => {
          e.currentDayMinutes = 0;
          e.currentObjectId = null;
        });
        activeDryingPhases = [];
      } else if (activeDryingPhases.length > 0) {
        // Trocknungszeit - Zeit vorspulen zur nächsten Aktivität
        const minDryingEnd = Math.min(...activeDryingPhases.map(d => d.endsAt));

        if (minDryingEnd <= maxDayMinutes) {
          // Trocknung endet heute noch - Zeit für alle Mitarbeiter vorspulen
          employeeSchedules.forEach(e => {
            if (e.currentDayMinutes < minDryingEnd) {
              e.currentDayMinutes = minDryingEnd;
            }
          });
          currentDay.minutes = Math.max(...employeeSchedules.map(e => e.currentDayMinutes));
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
            // Markiere aktuellen Mitarbeiter als wartend
            employee.currentDayMinutes = maxDayMinutes;
            continue;
          } else {
            // Tag beenden - Trocknung über Nacht
            currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
            currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
            days.push(currentDay);
            currentDay = createNewDay(days.length + 1);
            employeeSchedules.forEach(e => {
              e.currentDayMinutes = 0;
              e.currentObjectId = null;
            });
            activeDryingPhases = [];
          }
        }
      } else {
        // Keine Trocknungsphase und kein Task für diesen Mitarbeiter
        // Markiere Mitarbeiter als fertig für heute
        employee.currentDayMinutes = maxDayMinutes;

        // Prüfe ob ALLE Mitarbeiter fertig sind
        const allEmployeesDone = employeeSchedules.every(e => e.currentDayMinutes >= maxDayMinutes);
        if (allEmployeesDone) {
          if (currentDay.tasks.length > 0) {
            currentDay.overtimeMinutes = Math.max(0, currentDay.minutes - dailyMinutes);
            currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
            days.push(currentDay);
            currentDay = createNewDay(days.length + 1);
            employeeSchedules.forEach(e => {
              e.currentDayMinutes = 0;
              e.currentObjectId = null;
            });
          } else {
            break; // Verhindern von leeren Tagen
          }
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

  // Mitarbeiter-Statistik zum employeeResult hinzufügen
  employeeResult.reasoning.push({
    type: 'result',
    text: `Planung mit ${numberOfEmployees} Mitarbeiter(n): ${days.length} Arbeitstag(e) benötigt.`
  });

  // Workflows in RxDB speichern
  await databaseService.deleteAllWorkflows();
  for (const day of days) {
    await databaseService.saveWorkflow({
      day: day.day,
      hours: day.hours,
      employees: numberOfEmployees,
      calculationIds: day.tasks.map(t => t.taskId),
      waitTimes: day.waitTimes,
      parallelWork: day.tasks.filter(t => t.employeeId).map(t => ({
        employeeId: t.employeeId,
        employeeName: t.employeeName
      }))
    });
  }

  console.log(`📅 Workflow-Planung: ${days.length} Tage mit ${numberOfEmployees} Mitarbeiter(n)`);

  return {
    days,
    totalDays: days.length,
    totalHours,
    optimalEmployees: numberOfEmployees,
    employeeExplanation: employeeResult.reasoning,
    // NEU: Mitarbeiter-Details
    employeeCount: numberOfEmployees,
    workPerEmployee: totalHours / numberOfEmployees
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

