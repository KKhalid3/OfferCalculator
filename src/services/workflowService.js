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
 * 1. Schleifen auf Türen/Fenstern MUSS vor Anstrich auf Wänden/Decken im selben Raum erfolgen
 * 2. Schleifen auf Türen/Fenstern MUSS NACH Spachteln von Decken/Wänden im selben Raum erfolgen
 * @param {Object} task - Der zu prüfende Task
 * @param {Object} tasksByObject - Alle Tasks gruppiert nach Objekten
 * @param {Array} objects - Alle Objekt-Definitionen
 * @returns {boolean} - true wenn Task ausgeführt werden darf
 */
function checkCrossObjectDependencies(task, tasksByObject, objects) {
  // Finde das Objekt für diesen Task
  const taskObject = objects?.find(obj => obj.id === task.objectId);
  if (!taskObject) return true;

  const roomId = task.objectId;

  // Finde alle Türen/Fenster die diesem Raum zugeordnet sind
  const relatedDoorWindowObjects = objects?.filter(obj =>
    (obj.objectCategory === 'tuer' || obj.objectCategory === 'fenster') &&
    obj.assignedToRoomId === roomId
  ) || [];

  // REGEL 1: Schleifen auf Türen/Fenstern MUSS vor Anstrich auf Wänden/Decken im selben Raum erfolgen
  // Nur relevant für 'beschichtung' Phase Tasks (Anstrich auf Wänden)
  if (task.workflowPhase === 'beschichtung') {
    // Nur relevant wenn der Arbeitsbereich 'anstrich', 'wand' oder 'decke' ist
    if (['anstrich', 'wand', 'decke', 'allgemein'].includes(task.workArea)) {
      // Nur relevant für Raum-Objekte
      if (taskObject.objectCategory === 'raum') {
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
      }
    }
  }

  // REGEL 2: Schleifen auf Türen/Fenstern MUSS NACH Spachteln von Decken/Wänden im selben Raum erfolgen
  // Nur relevant für 'untergrund' Phase Tasks (Schleifen)
  if (task.workflowPhase === 'untergrund') {
    // Prüfe ob es sich um Schleifen handelt (Türen/Fenster)
    if (taskObject.objectCategory === 'tuer' || taskObject.objectCategory === 'fenster') {
      // Prüfe ob der Task Schleifen ist (durch workArea oder Service-Name)
      const isSanding = task.workArea === 'lackierung' ||
        (task.serviceName && task.serviceName.toLowerCase().includes('schleif'));

      if (isSanding) {
        // Prüfe ob Spachteln auf Decken/Wänden im zugeordneten Raum abgeschlossen ist
        if (taskObject.assignedToRoomId) {
          const roomTasks = tasksByObject[taskObject.assignedToRoomId] || [];

          for (const roomTask of roomTasks) {
            // Prüfe ob es Spachteln auf Decken/Wänden ist
            const isSpackling = roomTask.workArea === 'spachtel' ||
              (roomTask.serviceName && roomTask.serviceName.toLowerCase().includes('spachtel'));
            const isWallOrCeiling = roomTask.workArea === 'wand' || roomTask.workArea === 'decke';

            if (isSpackling && isWallOrCeiling && roomTask.remainingTime > 0) {
              console.log(`⏳ Abhängigkeit: "${task.serviceName}" (${taskObject.name}) wartet auf "${roomTask.serviceName}" (Spachteln Decken/Wände)`);
              return false; // Spachteln noch nicht fertig → Schleifen muss warten
            }
          }
        }
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

  // WICHTIG: Spachtelung trocknet - Im gleichen Raum KEINE weiteren Arbeiten möglich
  // Wenn Decken und Wände gespachtelt wurden, können während der Trocknungszeit
  // im gleichen Raum keine weiteren Arbeiten (Grundierung, Tapezieren, Streichen) durchgeführt werden
  if (dryingArea === 'spachtel' && sameRoom) {
    // Alle nachfolgenden Arbeiten sind während Spachtel-Trocknung im gleichen Raum NICHT möglich
    if (['grundierung', 'tapete', 'anstrich', 'wand', 'decke'].includes(otherArea)) {
      return {
        canWork: false,
        reason: 'Spachtelung trocknet – Grundierung, Tapezieren und Streichen im gleichen Raum nicht möglich'
      };
    }
    // Nur unabhängige Bereiche (Fenster, Türen, Boden) sind möglich
    if (['fenster', 'tuer', 'boden'].includes(otherArea)) {
      return { canWork: true, reason: 'Spachtelung trocknet – Fenster/Türen/Boden sind unabhängig' };
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
 * ============================================================================
 * SCHRITT 1: KONFIGURIERBARE GEWICHTUNGEN FÜR OPTIMIERUNG
 * ============================================================================
 * 
 * Diese Gewichtungen bestimmen, wie wichtig verschiedene Faktoren bei der
 * Mitarbeiter-Optimierung sind. Sie können in companySettings überschrieben werden.
 * 
 * PRIORITÄTEN:
 * 1. Minimierung der Kalendertage (Hauptziel: weniger Zeit beim Kunden)
 * 2. Maximierung der Mitarbeiter-Auslastung (Nebenziel: jeder MA gut ausgelastet)
 * 3. Minimierung des Effizienz-Verlusts (Trade-off: Koordinations-Overhead)
 * 4. Minimierung des Restes am letzten Tag (kleinerer Faktor)
 */
const DEFAULT_OPTIMIZATION_WEIGHTS = {
  daysWeight: 100,        // Gewichtung für gesparte Tage (höchste Priorität)
  utilizationWeight: 20,   // Gewichtung für Auslastung (max 20 Punkte bei 100%)
  efficiencyWeight: 2,    // Gewichtung für Effizienz (max 20 Punkte bei 0% Verlust)
  restDayWeight: 0.5,     // Gewichtung für Rest am letzten Tag (kleinerer Faktor)
  efficiencyPenalty: 5    // Strafpunkte pro % über maxEfficiencyLoss
};

/**
 * ============================================================================
 * SCHRITT 2: HILFSFUNKTION - Sammelt alle gültigen Mitarbeiter-Konfigurationen
 * ============================================================================
 * 
 * Diese Funktion sammelt alle möglichen Mitarbeiteranzahlen und berechnet
 * für jede die relevanten Metriken (Tage, Auslastung, Effizienz-Verlust).
 * 
 * NEU: Prüft auch die Zeitersparnis-Regel (proportional):
 * Für n Mitarbeiter müssen (n-1) × weeksSavedPerAdditionalEmployee Wochen gespart werden.
 * 
 * @param {number} totalHours - Gesamtarbeitszeit
 * @param {number} dailyHours - Stunden pro Arbeitstag
 * @param {number} minHoursPerEmployee - Mindeststunden pro Mitarbeiter
 * @param {number} maxEmployees - Maximale Anzahl Mitarbeiter
 * @param {number} efficiencyLossPerEmployee - Effizienz-Verlust pro zusätzlichem MA (%)
 * @param {number} baselineDays - Tage für 1 Mitarbeiter (Referenz für Zeitersparnis)
 * @param {number} weeksSavedPerAdditionalEmployee - Wochen pro zusätzlichem MA (Standard: 1)
 * @returns {Array} Array von Konfigurationsobjekten
 */
function collectValidEmployeeConfigurations(
  totalHours,
  dailyHours,
  minHoursPerEmployee,
  maxEmployees,
  efficiencyLossPerEmployee = 5,
  baselineDays = null,
  weeksSavedPerAdditionalEmployee = 1
) {
  const configurations = [];

  // Berechne baselineDays falls nicht übergeben
  const baselineDaysCalc = baselineDays || (totalHours / dailyHours);
  const daysPerWeek = 5; // Arbeitstage pro Woche (Mo-Fr)
  const requiredDaysPerWeek = weeksSavedPerAdditionalEmployee * daysPerWeek;

  for (let emp = 1; emp <= maxEmployees; emp++) {
    const hoursPerEmp = totalHours / emp;
    const daysNeeded = hoursPerEmp / dailyHours;
    const restOfLastDay = (daysNeeded * dailyHours) - hoursPerEmp;
    const totalEfficiencyLoss = (emp - 1) * efficiencyLossPerEmployee;

    // Berechne Auslastung: wie viel % der verfügbaren Zeit wird genutzt
    const totalAvailableHours = daysNeeded * dailyHours;
    const utilizationRate = hoursPerEmp / totalAvailableHours;

    // HARTE GRENZE: Mindeststunden pro Mitarbeiter
    // Wenn diese Grenze unterschritten wird, sind weitere Konfigurationen auch ungültig
    if (hoursPerEmp < minHoursPerEmployee) {
      break; // Weitere Mitarbeiter haben noch weniger Stunden
    }

    // NEU: Schrittweise Mitarbeiter-Regel
    // Regel: Für n Mitarbeiter (n > 1) müssen die benötigten Tage >= (n-1) Wochen UND <= (n-1) Wochen sein
    // - 2 MA: daysNeeded >= 1 Woche (5 Tage) UND daysNeeded <= 1 Woche (5 Tage)
    // - 3 MA: daysNeeded >= 2 Wochen (10 Tage) UND daysNeeded <= 2 Wochen (10 Tage)
    // - 4 MA: daysNeeded >= 3 Wochen (15 Tage) UND daysNeeded <= 3 Wochen (15 Tage)
    // - 6 MA: daysNeeded >= 5 Wochen (25 Tage) UND daysNeeded <= 5 Wochen (25 Tage)
    // Toleranz: ±1 Tag für Rundungsfehler
    const RULE_ALLOWED_DAYS = {
      1: 5,
      2: 5,
      3: 10,
      4: 15
    };

    if (emp > 4) break; // ✅ Regel endet bei 4 MA

    const allowedDays = RULE_ALLOWED_DAYS[emp];

    if (daysNeeded > allowedDays) {
      console.log(`⏭️ ${emp} MA: ${daysNeeded.toFixed(2)} Tage > erlaubt (${allowedDays} Tage)`);
      continue;
    }

    configurations.push({
      employees: emp,
      hoursPerEmp,
      daysNeeded,
      restOfLastDay,
      totalEfficiencyLoss,
      utilizationRate,
      totalAvailableHours,
      daysSaved: baselineDaysCalc - daysNeeded // NEU: Gesparte Tage im Vergleich zu 1 MA
    });
  }

  return configurations;
}

/**
 * ============================================================================
 * SCHRITT 3: HILFSFUNKTION - Berechnet Optimierungs-Score für eine Konfiguration
 * ============================================================================
 * 
 * Diese Funktion bewertet eine Mitarbeiter-Konfiguration basierend auf mehreren
 * Kriterien. Höhere Scores sind besser.
 * 
 * SCORE-KOMPONENTEN:
 * 1. Tage-Score: Jeder gesparte Tag gibt viele Punkte (Hauptziel)
 * 2. Auslastungs-Score: Höhere Auslastung = mehr Punkte (Nebenziel)
 * 3. Effizienz-Score: Niedrigerer Effizienz-Verlust = mehr Punkte (Trade-off)
 * 4. Rest-Tag-Score: Weniger Rest am letzten Tag = mehr Punkte (kleinerer Faktor)
 * 
 * @param {Object} config - Konfigurationsobjekt (von collectValidEmployeeConfigurations)
 * @param {number} baselineDays - Referenz-Tage (für 1 Mitarbeiter)
 * @param {number} maxEfficiencyLoss - Maximal erlaubter Effizienz-Verlust (%)
 * @param {Object} weights - Gewichtungen für Score-Berechnung
 * @returns {Object} Score-Objekt mit Gesamt-Score und Details
 */
function calculateConfigurationScore(
  config,
  baselineDays,
  maxEfficiencyLoss,
  weights = DEFAULT_OPTIMIZATION_WEIGHTS
) {
  // PRIORITÄT 1: Minimierung der Tage (höchste Gewichtung)
  // Jeder gesparte Tag ist sehr wertvoll für den Kunden
  const daysSaved = baselineDays - config.daysNeeded;
  const daysScore = daysSaved * weights.daysWeight;

  // PRIORITÄT 2: Gute Auslastung pro Mitarbeiter
  // Ideal: nah an dailyHours (z.B. 7-8h pro Tag)
  // Bonus wenn Auslastung hoch ist (über 80%)
  const utilizationScore = config.utilizationRate * weights.utilizationWeight;

  // PRIORITÄT 3: Effizienz-Verlust (aber nicht zu restriktiv)
  // Akzeptiere bis maxEfficiencyLoss, darüber Abzug
  let efficiencyScore = 0;
  if (config.totalEfficiencyLoss <= maxEfficiencyLoss) {
    // Innerhalb des Limits: Bonus für niedrigeren Verlust
    efficiencyScore = (maxEfficiencyLoss - config.totalEfficiencyLoss) * weights.efficiencyWeight;
  } else {
    // Über dem Limit: Strafpunkte, aber nicht komplett ausschließen wenn es Tage spart
    efficiencyScore = -(config.totalEfficiencyLoss - maxEfficiencyLoss) * weights.efficiencyPenalty;
  }

  // PRIORITÄT 4: Rest des letzten Tages (kleinerer Faktor)
  // Weniger Rest ist besser, aber nicht so wichtig wie Tage
  const restScore = -config.restOfLastDay * weights.restDayWeight;

  const totalScore = daysScore + utilizationScore + efficiencyScore + restScore;

  return {
    totalScore,
    daysScore,
    utilizationScore,
    efficiencyScore,
    restScore,
    daysSaved
  };
}

/**
 * Schritt 13: Optimale Mitarbeiteranzahl berechnen (ERWEITERT mit Optimierung)
 * 
 * OPTIMIERUNGSZIELE:
 * 1. Minimierung der Kalendertage (Hauptziel: weniger Zeit beim Kunden)
 * 2. Maximierung der Mitarbeiter-Auslastung (Nebenziel: jeder MA gut ausgelastet)
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

  // === REGEL 2: Berechne theoretische Mitarbeiterzahl ===
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
  // WICHTIG: Mehrpersonal ist immer möglich, auch ohne Parallelarbeit!
  // Parallelarbeit (canWorkParallel) beeinflusst nur, ob Mitarbeiter GLEICHZEITIG arbeiten können,
  // nicht ob mehrere Mitarbeiter NACHEINANDER arbeiten können, um die Gesamtzeit zu reduzieren.

  const canWorkParallel = (customerApproval && allowParallelRooms && uniqueObjects > 1);

  // === REGEL 5: OPTIMIERUNG - Minimierung der Tage + Maximierung der Auslastung ===
  // 
  // STRATEGIE:
  // 1. Sammle alle gültigen Konfigurationen (mindestens minHoursPerEmployee pro MA)
  // 2. Bewerte jede Konfiguration mit einem Score-System
  // 3. Wähle die Konfiguration mit dem besten Score
  //
  // ZIELE:
  // - PRIORITÄT 1: Minimierung der Kalendertage (Hauptziel: weniger Zeit beim Kunden)
  // - PRIORITÄT 2: Maximierung der Mitarbeiter-Auslastung (Nebenziel: jeder MA gut ausgelastet)
  // - PRIORITÄT 3: Minimierung des Effizienz-Verlusts (Trade-off: Koordinations-Overhead)
  // - PRIORITÄT 4: Minimierung des Restes am letzten Tag (kleinerer Faktor)

  // Lade konfigurierbare Gewichtungen (falls in companySettings definiert)
  const optimizationWeights = {
    ...DEFAULT_OPTIMIZATION_WEIGHTS,
    ...(companySettings?.optimizationWeights || {})
  };

  // Effizienz-Verlust pro zusätzlichem Mitarbeiter (konfigurierbar)
  const efficiencyLossPerEmployee = companySettings?.efficiencyLossPerEmployee || 5;

  // NEU: Zeitersparnis-Regel (proportional)
  // Für n Mitarbeiter müssen (n-1) × weeksSavedPerAdditionalEmployee Wochen gespart werden
  const weeksSavedPerAdditionalEmployee = companySettings?.weeksSavedPerAdditionalEmployee ?? 1;

  // Maximale Mitarbeiter: 
  // - Wenn Parallelarbeit möglich: begrenzt durch Räume ODER theoretische Anzahl (was kleiner ist)
  // - Wenn keine Parallelarbeit: theoretische Anzahl (Mitarbeiter arbeiten nacheinander)
  // WICHTIG: Auch ohne Parallelarbeit können mehrere Mitarbeiter verwendet werden,
  // sie arbeiten dann nacheinander statt gleichzeitig
  const RULE_MAX_EMPLOYEES = companySettings?.ruleMaxEmployees ?? 4;

  const maxEmployeesRaw = canWorkParallel
    ? Math.min(theoreticalEmployees, uniqueObjects)
    : theoreticalEmployees;

  // ✅ harte Kappung nach Regel
  const maxEmployees = Math.min(maxEmployeesRaw, RULE_MAX_EMPLOYEES);

  // Referenz: Tage für 1 Mitarbeiter (Baseline für Vergleich)
  const baselineDays = result.recommendedDays;

  // SCHRITT 1: Sammle alle gültigen Konfigurationen
  const validConfigurations = collectValidEmployeeConfigurations(
    totalHours,
    dailyHours,
    minHoursPerEmployee,
    maxEmployees,
    efficiencyLossPerEmployee,
    baselineDays,
    weeksSavedPerAdditionalEmployee
  );

  // Logge ungültige Konfigurationen (zu wenig Stunden pro MA)
  if (validConfigurations.length < maxEmployees) {
    const firstInvalid = validConfigurations.length + 1;
    const hoursPerEmpInvalid = totalHours / firstInvalid;
    result.reasoning.push({
      type: 'warning',
      text: `${firstInvalid}+ Mitarbeiter: ${hoursPerEmpInvalid.toFixed(1)}h pro Person < ${minHoursPerEmployee}h Minimum → Leerlauf`
    });
  }

  // SCHRITT 2: Bewerte alle gültigen Konfigurationen
  let optimalEmployees = 1;
  let bestScore = -Infinity;
  let bestConfig = null;
  const scoredConfigurations = [];

  for (const config of validConfigurations) {
    // Score nur für Anzeige / Analyse
    const scoreResult = calculateConfigurationScore(
      config,
      baselineDays,
      maxEfficiencyLoss,
      optimizationWeights
    );

    scoredConfigurations.push({
      ...config,
      ...scoreResult
    });

    // Log bleibt vollständig
    const requiredWeeks = config.employees > 1 ? config.employees - 1 : 0;
    const ruleInfo = config.employees > 1
      ? ` (Regel: ≤ ${requiredWeeks * 5} Tage)`
      : '';

    result.reasoning.push({
      type: 'info',
      text: `${config.employees} MA: ${config.daysNeeded.toFixed(2)} Tage${ruleInfo}, `
        + `${config.hoursPerEmp.toFixed(1)}h/MA `
        + `(${(config.utilizationRate * 100).toFixed(0)}%), `
        + `${config.totalEfficiencyLoss}% Effizienz → Score ${scoreResult.totalScore.toFixed(1)}`
    });

    // ✅ ENTSCHEIDUNG: ERSTE gültige Konfiguration gewinnt
    if (!bestConfig) {
      bestConfig = { ...config, ...scoreResult };
      optimalEmployees = config.employees;
    }
  }

  // SCHRITT 3: Setze Ergebnis basierend auf bester Konfiguration
  if (bestConfig) {
    result.hoursPerEmployee = bestConfig.hoursPerEmp;
    result.recommendedDays = bestConfig.daysNeeded;

    // Zusätzliche Info für gewählte Konfiguration
    if (optimalEmployees > 1) {
      const requiredWeeks = optimalEmployees - 1;
      const maxDaysAllowed = requiredWeeks * 5;
      result.reasoning.push({
        type: 'success',
        text: `✅ Gewählt: ${optimalEmployees} Mitarbeiter → ${bestConfig.daysNeeded} Tage (${bestConfig.hoursPerEmp.toFixed(1)}h pro Person, ${(bestConfig.utilizationRate * 100).toFixed(0)}% Auslastung) - Regel erfüllt: ${optimalEmployees} MA können auf ≤ ${requiredWeeks} Woche(n) (${maxDaysAllowed} Tage) reduziert werden`
      });

      if (bestConfig.totalEfficiencyLoss > 0) {
        result.reasoning.push({
          type: 'info',
          text: `Hinweis: ${bestConfig.totalEfficiencyLoss}% Koordinations-Overhead durch ${optimalEmployees} Mitarbeiter`
        });
      }

      // Zeige Einsparung an Tagen
      if (bestConfig.daysSaved > 0) {
        result.reasoning.push({
          type: 'info',
          text: `Zeitersparnis: ${bestConfig.daysSaved} Tag(e) weniger beim Kunden im Vergleich zu 1 Mitarbeiter`
        });
      }
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

  // === REGEL 7: Info über Parallelarbeit ===
  if (!canWorkParallel && optimalEmployees > 1) {
    result.reasoning.push({
      type: 'info',
      text: `Hinweis: ${optimalEmployees} Mitarbeiter arbeiten nacheinander (keine Parallelarbeit möglich ohne Kundenfreigabe oder bei nur 1 Objekt).`
    });
  } else if (canWorkParallel && optimalEmployees > 1) {
    result.reasoning.push({
      type: 'info',
      text: `Hinweis: ${optimalEmployees} Mitarbeiter können parallel in verschiedenen Räumen arbeiten.`
    });
  }

  // === REGEL 8: Tipp für Parallelarbeit ===
  if (!customerApproval && uniqueObjects > 1 && totalWaitTime > 0) {
    result.reasoning.push({
      type: 'parallel',
      text: `Tipp: Mit Kundenfreigabe könnten während der Trocknungszeiten Arbeiten in anderen Räumen durchgeführt werden.`
    });
  }

  // Setze finale Werte
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
 * ============================================================================
 * NEUE INTELLIGENTE TAGESPLANUNG MIT PARALLELER ARBEIT
 * ============================================================================
 * 
 * OPTIMIERUNGEN:
 * 1. ✅ PARALLELE ARBEIT: Pro Iteration werden ALLE verfügbaren Mitarbeiter
 *    gleichzeitig beschäftigt (nicht mehr sequenziell)
 * 2. ✅ RAUM-BASIERTE PLANUNG: Aufgaben werden pro Raum geplant, damit
 *    mehrere Mitarbeiter gleichzeitig in verschiedenen Räumen arbeiten können
 * 3. ✅ VOLLE AUSLASTUNG: Jeder Mitarbeiter muss mindestens minHoursPerEmployee
 *    arbeiten, bevor ein neuer Tag beginnt
 * 4. ✅ TROCKNUNGSZEITEN NUTZEN: Während Trocknungszeiten werden Arbeiten
 *    in anderen Räumen durchgeführt
 * 5. ✅ LOGISCHE ABHÄNGIGKEITEN: Cross-Object Abhängigkeiten werden respektiert
 * 6. ✅ ÜBERSTUNDEN-TOLERANZ: Kleine Rest-Tasks können mit Überstunden abgeschlossen werden
 * 
 * NEUE DATENSTRUKTUR FÜR VISUALISIERUNG:
 * - tasksByRoom: Gruppiert Tasks nach Räumen für Zeitstrahl-Visualisierung
 * - employeeStats: Statistiken pro Mitarbeiter (Arbeitszeit, Aufgaben)
 * - employeeUtilization: Auslastung pro Mitarbeiter in Prozent
 * - minHoursViolations: Verstöße gegen Mindeststunden-Regel
 * 
 * @param {Array} calculations - Alle Berechnungen
 * @param {boolean} customerApproval - Kundenfreigabe für Parallelarbeit
 * @returns {Object} Workflow-Planung mit Tagen, Mitarbeiter-Statistiken und Raum-basierten Daten
 */
export async function planWorkflowOptimized(calculations, customerApproval) {
  const companySettings = await databaseService.getCompanySettings();
  const dailyMinutes = (companySettings?.dailyHours || HOURS_PER_DAY) * 60;

  // Überstunden-Einstellungen
  const maxOvertimePercent = companySettings?.maxOvertimePercent ?? 15;
  const minTaskSplitTime = companySettings?.minTaskSplitTime ?? 60;
  const maxDayMinutes = Math.round(dailyMinutes * (1 + maxOvertimePercent / 100));

  // WICHTIG: Mehrpersonal-Regeln für Tagesplanung
  // Diese Regeln müssen für JEDEN einzelnen Mitarbeiter gelten, nicht nur für den ersten
  const minHoursPerEmployee = companySettings?.minHoursPerEmployee || 6;
  const minMinutesPerEmployee = minHoursPerEmployee * 60;
  const allowParallelRooms = companySettings?.allowParallelRoomWork ?? true;

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
        // WICHTIG: Diese Regel gilt für ALLE Mitarbeiter, nicht nur für den ersten
        const otherEmployeeInSameObject = employeeSchedules.some(
          e => e.id !== employee.id && e.currentObjectId === objectId && e.currentDayMinutes < dailyMinutes
        );
        if (otherEmployeeInSameObject && numberOfEmployees > 1) {
          // Nur erlauben wenn Kundenfreigabe UND allowParallelRooms aktiviert ist
          if (!customerApproval || !allowParallelRooms) continue;
        }

        availableTasks.push({
          task,
          objectId,
          reason: 'Nächster Task in Workflow-Reihenfolge',
          isCurrentObject: employee.currentObjectId === objectId || objIndex === currentObjectIndex
        });
      }
    }

    // Priorität 2: Task aus anderem Objekt (wenn Kundenfreigabe UND allowParallelRooms oder Trocknungszeit)
    // WICHTIG: allowParallelRooms muss aktiviert sein für Parallelarbeit in verschiedenen Räumen
    if (((customerApproval && allowParallelRooms) || activeDryingPhases.length > 0) && availableTasks.length === 0) {
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

    // WICHTIG: Finde objectName aus allObjects für UI-Visualisierung
    const object = allObjects.find(obj => obj.id === objectId);
    const objectName = object?.name || `Raum ${objectId}`;

    // Task oder Teil davon einplanen
    const taskEntry = {
      taskId: task.id,
      objectId: objectId,
      objectName: objectName, // NEU: Für UI-Visualisierung benötigt
      serviceId: task.serviceId,
      serviceName: task.serviceName,
      workArea: task.workArea,
      startTime: employee.currentDayMinutes,
      duration: timeToSchedule, // WICHTIG: duration ist in Minuten
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

  /**
   * ============================================================================
   * NEUE STRATEGIE: PARALLELE ARBEIT FÖRDERN
   * ============================================================================
   * 
   * Diese Funktion versucht, für ALLE verfügbaren Mitarbeiter gleichzeitig
   * Aufgaben zu finden, um parallele Arbeit in verschiedenen Räumen zu fördern.
   * 
   * PRIORITÄTEN:
   * 1. Mitarbeiter unter minHoursPerEmployee haben höchste Priorität
   * 2. Parallele Arbeit in verschiedenen Räumen wird bevorzugt
   * 3. Jeder Mitarbeiter soll voll ausgelastet werden
   */

  // NEU: Finde alle verfügbaren Mitarbeiter (sortiert nach Priorität)
  function getAllAvailableEmployees() {
    const available = employeeSchedules
      .filter(e => e.currentDayMinutes < maxDayMinutes)
      .sort((a, b) => {
        // PRIORITÄT 1: Mitarbeiter unter minHoursPerEmployee zuerst
        const aUnderMin = (a.currentDayMinutes / 60) < minHoursPerEmployee;
        const bUnderMin = (b.currentDayMinutes / 60) < minHoursPerEmployee;

        if (aUnderMin && !bUnderMin) return -1;
        if (!aUnderMin && bUnderMin) return 1;

        // PRIORITÄT 2: Weniger gearbeitet = höhere Priorität
        return a.currentDayMinutes - b.currentDayMinutes;
      });

    return available;
  }

  // NEU: Finde den Mitarbeiter mit der geringsten Arbeitszeit heute
  // WICHTIG: Berücksichtigt Mehrpersonal-Regeln - bevorzugt Mitarbeiter, die noch unter dem Minimum sind
  function getAvailableEmployee() {
    const available = getAllAvailableEmployees();
    return available.length > 0 ? available[0] : null;
  }

  /**
   * ============================================================================
   * NEUE FUNKTION: Parallele Aufgaben-Zuweisung pro Iteration
   * ============================================================================
   * 
   * Diese Funktion versucht, für ALLE verfügbaren Mitarbeiter gleichzeitig
   * Aufgaben zu finden, um parallele Arbeit zu fördern.
   * 
   * STRATEGIE:
   * 1. Finde alle verfügbaren Mitarbeiter
   * 2. Für jeden Mitarbeiter: Finde beste verfügbare Aufgabe
   * 3. Bevorzuge parallele Arbeit in verschiedenen Räumen
   * 4. Weise Aufgaben zu, wenn möglich
   * 
   * @returns {Object} { assigned: number, employees: Array } - Anzahl zugewiesener Aufgaben
   */
  function assignTasksToAllAvailableEmployees() {
    const availableEmployees = getAllAvailableEmployees();
    if (availableEmployees.length === 0) {
      return { assigned: 0, employees: [] };
    }

    let assignedCount = 0;
    const assignedEmployees = [];
    const usedObjectIds = new Set(); // Verhindere Konflikte im selben Raum (wenn nicht erlaubt)

    // Sortiere Mitarbeiter: Die mit wenigsten Stunden zuerst
    // Dies stellt sicher, dass alle Mitarbeiter gleichmäßig ausgelastet werden
    const sortedEmployees = [...availableEmployees].sort((a, b) => {
      // Mitarbeiter unter Minimum haben höchste Priorität
      const aUnderMin = (a.currentDayMinutes / 60) < minHoursPerEmployee;
      const bUnderMin = (b.currentDayMinutes / 60) < minHoursPerEmployee;

      if (aUnderMin && !bUnderMin) return -1;
      if (!aUnderMin && bUnderMin) return 1;

      // Dann nach Arbeitszeit (weniger = höhere Priorität)
      return a.currentDayMinutes - b.currentDayMinutes;
    });

    // Versuche für jeden verfügbaren Mitarbeiter eine Aufgabe zu finden
    for (const employee of sortedEmployees) {
      // Prüfe ob Mitarbeiter noch Kapazität hat
      if (employee.currentDayMinutes >= maxDayMinutes) continue;

      // Finde beste verfügbare Aufgabe für diesen Mitarbeiter
      const next = getNextAvailableTask(employee);

      if (next) {
        // Prüfe ob parallele Arbeit im selben Raum erlaubt ist
        const otherEmployeeInSameObject = employeeSchedules.some(
          e => e.id !== employee.id &&
            e.currentObjectId === next.objectId &&
            e.currentDayMinutes < maxDayMinutes
        );

        // Wenn anderer Mitarbeiter im selben Raum arbeitet, prüfe ob erlaubt
        if (otherEmployeeInSameObject && numberOfEmployees > 1) {
          if (!customerApproval || !allowParallelRooms) {
            // Parallele Arbeit im selben Raum nicht erlaubt → überspringe
            continue;
          }
        }

        // Versuche Aufgabe zuzuweisen
        const added = addTaskToDay(next.task, next.objectId, employee);

        if (added) {
          assignedCount++;
          assignedEmployees.push({
            employee: employee.name,
            task: next.task.serviceName,
            objectId: next.objectId
          });

          // Markiere Raum als verwendet (wenn nicht erlaubt, mehrere MA im selben Raum)
          if (!customerApproval || !allowParallelRooms) {
            usedObjectIds.add(next.objectId);
          }
        }
      }
    }

    return { assigned: assignedCount, employees: assignedEmployees };
  }

  // NEU: Prüfe ob alle Mitarbeiter die Mindeststunden-Regel erfüllen
  // Diese Funktion wird am Ende jedes Tages aufgerufen, um Verstöße zu erkennen
  function checkMinHoursPerEmployeeRule(employeeSchedules, currentDayNumber) {
    const violations = [];
    for (const emp of employeeSchedules) {
      const empHours = emp.currentDayMinutes / 60;
      // Prüfe nur wenn der Mitarbeiter gearbeitet hat (currentDayMinutes > 0)
      // und unter dem Minimum liegt
      if (empHours > 0 && empHours < minHoursPerEmployee) {
        violations.push({
          employeeId: emp.id,
          employeeName: emp.name,
          hours: empHours,
          minRequired: minHoursPerEmployee
        });
      }
    }
    return violations;
  }

  /**
   * ============================================================================
   * NEU: Hilfsfunktion zum Beenden eines Tages mit Prüfung der Mehrpersonal-Regeln
   * ============================================================================
   * 
   * Diese Funktion:
   * 1. Prüft ob alle Mitarbeiter mindestens minHoursPerEmployee gearbeitet haben
   * 2. Speichert Verstöße für spätere Anzeige
   * 3. Berechnet Überstunden
   * 4. Erweitert Tag-Objekt um Raum-basierte Informationen für Visualisierung
   */
  function endCurrentDay() {
    // Prüfe ob alle Mitarbeiter die Mindeststunden-Regel erfüllen
    if (currentDay.tasks.length > 0) {
      const violations = checkMinHoursPerEmployeeRule(employeeSchedules, currentDay.day);
      if (violations.length > 0) {
        console.warn(`⚠️ Tag ${currentDay.day}: ${violations.length} Mitarbeiter unter Mindeststunden:`, violations.map(v => `${v.employeeName}: ${v.hours.toFixed(2)}h < ${v.minRequired}h`).join(', '));
        // Speichere Verstöße im Tag-Objekt für spätere Anzeige
        currentDay.minHoursViolations = violations;
      }
    }

    // NEU: Erweitere Tag-Objekt um Raum-basierte Informationen für Visualisierung
    // Gruppiere Tasks nach Räumen für Zeitstrahl-Visualisierung
    const tasksByRoom = {};
    const employeeStats = {};

    for (const task of currentDay.tasks) {
      const roomId = task.objectId;
      if (!tasksByRoom[roomId]) {
        tasksByRoom[roomId] = [];
      }
      tasksByRoom[roomId].push(task);

      // Sammle Mitarbeiter-Statistiken
      if (task.employeeId) {
        if (!employeeStats[task.employeeId]) {
          employeeStats[task.employeeId] = {
            employeeId: task.employeeId,
            employeeName: task.employeeName,
            totalMinutes: 0,
            tasks: []
          };
        }
        employeeStats[task.employeeId].totalMinutes += task.duration;
        employeeStats[task.employeeId].tasks.push(task);
      }
    }

    // Speichere Raum-basierte Struktur für UI-Visualisierung
    currentDay.tasksByRoom = tasksByRoom;
    currentDay.employeeStats = Object.values(employeeStats);

    // Berechne Auslastung pro Mitarbeiter
    currentDay.employeeUtilization = employeeSchedules.map(emp => ({
      employeeId: emp.id,
      employeeName: emp.name,
      minutes: emp.currentDayMinutes,
      hours: emp.currentDayMinutes / 60,
      utilizationPercent: (emp.currentDayMinutes / dailyMinutes) * 100,
      meetsMinimum: (emp.currentDayMinutes / 60) >= minHoursPerEmployee || emp.currentDayMinutes === 0
    }));

    // Tag abschließen
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
  }

  /**
   * ============================================================================
   * HAUPTSCHLEIFE: PARALLELE TAGESPLANUNG
   * ============================================================================
   * 
   * NEUE STRATEGIE:
   * - Pro Iteration werden ALLE verfügbaren Mitarbeiter parallel beschäftigt
   * - Bevorzugt parallele Arbeit in verschiedenen Räumen
   * - Sichert vollständige Auslastung jedes Mitarbeiters (mindestens minHoursPerEmployee)
   * 
   * ABLAUF:
   * 1. Prüfe ob alle Tasks erledigt sind
   * 2. Versuche für ALLE verfügbaren Mitarbeiter gleichzeitig Aufgaben zu finden
   * 3. Wenn keine Aufgaben mehr zugewiesen werden können → Tag beenden oder Trocknungszeit vorspulen
   * 4. Prüfe Mindeststunden vor Tagwechsel
   */
  let iterations = 0;
  const maxIterations = 1000; // Sicherheit gegen Endlosschleifen
  let noProgressCount = 0; // Zähler für Iterationen ohne Fortschritt

  while (iterations < maxIterations) {
    iterations++;

    // Prüfe ob alle Tasks erledigt sind
    const allDone = allTasks.every(t => t.remainingTime <= 0);
    if (allDone) {
      // Prüfe Mindeststunden vor Beendigung
      const violations = checkMinHoursPerEmployeeRule(employeeSchedules, currentDay.day);
      if (violations.length > 0 && currentDay.tasks.length > 0) {
        console.warn(`⚠️ Alle Tasks erledigt, aber ${violations.length} Mitarbeiter unter Mindeststunden`);
        // Versuche noch Aufgaben zu finden, um Mindeststunden zu erfüllen
        // (wird in der nächsten Iteration behandelt)
      } else {
        break;
      }
    }

    // Abgelaufene Trocknungsphasen entfernen (basierend auf Mitarbeiter-Zeit)
    const maxEmployeeTime = Math.max(...employeeSchedules.map(e => e.currentDayMinutes));
    activeDryingPhases = activeDryingPhases.filter(d => d.endsAt > maxEmployeeTime);

    // NEUE STRATEGIE: Versuche für ALLE verfügbaren Mitarbeiter gleichzeitig Aufgaben zu finden
    const assignmentResult = assignTasksToAllAvailableEmployees();

    if (assignmentResult.assigned > 0) {
      // Erfolgreich Aufgaben zugewiesen → Fortschritt
      noProgressCount = 0;

      if (assignmentResult.assigned > 1) {
        console.log(`✅ Parallele Arbeit: ${assignmentResult.assigned} Aufgaben gleichzeitig zugewiesen`);
      }

      // Nach erfolgreicher Zuweisung: Prüfe ob wir während einer Trocknungsphase sind
      // und ob wir zu einem anderen Objekt wechseln können
      if (activeDryingPhases.length > 0 && customerApproval && allowParallelRooms) {
        // Wechsle zum nächsten Objekt für bessere Verteilung
        currentObjectIndex = (currentObjectIndex + 1) % objectIds.length;
      }

      continue; // Weiter mit nächster Iteration
    }

    // Keine Aufgaben mehr zugewiesen → prüfe nächste Schritte
    noProgressCount++;

    // Prüfe ob alle Mitarbeiter voll ausgelastet sind
    const allEmployeesFull = employeeSchedules.every(e =>
      e.currentDayMinutes >= maxDayMinutes * 0.95 ||
      (e.currentDayMinutes > 0 && e.currentDayMinutes >= dailyMinutes)
    );

    if (allEmployeesFull) {
      // Alle Mitarbeiter voll - prüfe Mindeststunden und beende Tag
      const violations = checkMinHoursPerEmployeeRule(employeeSchedules, currentDay.day);
      if (violations.length > 0) {
        console.warn(`⚠️ Tag ${currentDay.day}: ${violations.length} Mitarbeiter unter Mindeststunden, aber keine weiteren Aufgaben verfügbar`);
      }
      endCurrentDay();
      continue;
    }

    // Prüfe Trocknungsphasen
    if (activeDryingPhases.length > 0) {
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
        noProgressCount = 0; // Fortschritt durch Zeitvorspulen
        continue;
      } else {
        // Trocknung dauert bis morgen
        // Prüfen ob noch unerledigte Tasks in anderen Objekten gibt
        const unfinishedOtherObjects = allTasks.filter(t =>
          t.remainingTime > 0 &&
          !activeDryingPhases.some(d => d.objectId === t.objectId)
        );

        if (unfinishedOtherObjects.length > 0 && customerApproval && allowParallelRooms) {
          // Es gibt noch Arbeit in anderen Räumen - weitermachen
          // Markiere alle Mitarbeiter als wartend, die keine Aufgaben mehr haben
          employeeSchedules.forEach(e => {
            if (e.currentDayMinutes < minMinutesPerEmployee) {
              // Mitarbeiter unter Minimum → versuche noch Aufgaben zu finden
              const next = getNextAvailableTask(e);
              if (!next) {
                // Keine Aufgaben mehr → markiere als wartend
                e.currentDayMinutes = maxDayMinutes;
              }
            } else if (e.currentDayMinutes < maxDayMinutes) {
              // Mitarbeiter hat noch Kapazität, aber keine Aufgabe gefunden
              // Markiere als wartend (wird in nächster Iteration erneut versucht)
            }
          });
          continue;
        } else {
          // Tag beenden - Trocknung über Nacht
          endCurrentDay();
          continue;
        }
      }
    }

    // Keine Trocknungsphase und keine Aufgaben mehr
    // Prüfe ob Mitarbeiter unter Mindeststunden sind
    const violations = checkMinHoursPerEmployeeRule(employeeSchedules, currentDay.day);
    const employeesUnderMin = employeeSchedules.filter(e =>
      e.currentDayMinutes > 0 &&
      (e.currentDayMinutes / 60) < minHoursPerEmployee &&
      e.currentDayMinutes < maxDayMinutes
    );

    if (employeesUnderMin.length > 0 && noProgressCount < 10) {
      // Es gibt noch Mitarbeiter unter Minimum → versuche weiter Aufgaben zu finden
      // (könnte durch Abhängigkeiten blockiert sein)
      continue;
    }

    // Keine weiteren Aufgaben möglich → Tag beenden
    if (currentDay.tasks.length > 0) {
      if (violations.length > 0) {
        console.warn(`⚠️ Tag ${currentDay.day} beendet mit ${violations.length} Mitarbeiter(n) unter Mindeststunden`);
      }
      endCurrentDay();
    } else {
      // Leerer Tag → beende Schleife
      break;
    }
  }

  // Letzten Tag hinzufügen
  if (currentDay.tasks.length > 0) {
    // Prüfe ob alle Mitarbeiter die Mindeststunden-Regel erfüllen
    const violations = checkMinHoursPerEmployeeRule(employeeSchedules, currentDay.day);
    if (violations.length > 0) {
      console.warn(`⚠️ Tag ${currentDay.day}: ${violations.length} Mitarbeiter unter Mindeststunden:`, violations.map(v => `${v.employeeName}: ${v.hours.toFixed(2)}h < ${v.minRequired}h`).join(', '));
      currentDay.minHoursViolations = violations;
    }
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

/**
 * ============================================================================
 * Hilfsfunktion: Erstellt ein neues Tag-Objekt
 * ============================================================================
 * 
 * Erweitert um Felder für:
 * - Raum-basierte Visualisierung (tasksByRoom)
 * - Mitarbeiter-Statistiken (employeeStats, employeeUtilization)
 * - Mindeststunden-Verstöße (minHoursViolations)
 */
function createNewDay(dayNumber) {
  return {
    day: dayNumber,
    hours: 0,
    minutes: 0,
    tasks: [],
    waitTimes: [],
    hasOvertime: false,
    overtimeMinutes: 0,
    // NEU: Erweiterte Felder für Visualisierung
    tasksByRoom: {}, // Gruppiert nach Raum-ID für Zeitstrahl-Visualisierung
    employeeStats: [], // Statistiken pro Mitarbeiter
    employeeUtilization: [], // Auslastung pro Mitarbeiter
    minHoursViolations: [] // Verstöße gegen Mindeststunden-Regel
  };
}

/**
 * Hauptfunktion: Workflow planen (nutzt jetzt die optimierte Version)
 */
export async function planWorkflow(calculations, customerApproval) {
  return planWorkflowOptimized(calculations, customerApproval);
}

