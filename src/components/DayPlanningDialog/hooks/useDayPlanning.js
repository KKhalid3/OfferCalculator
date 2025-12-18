import { useMemo } from "react";
import { MINUTES_PER_DAY } from "../../../constants";
import { workflowPhases } from "../../../data/servicesData";
import {
  detectWorkArea,
  getAreaName,
} from "../utils/workAreaUtils";
import { formatTime } from "../utils/timeFormatters";

/**
 * ============================================================================
 * CUSTOM HOOK FÜR DIE TAGESPLANUNG
 * ============================================================================
 * 
 * Dieser Hook verwendet die Daten aus dem workflow/ Modul und bereitet sie
 * für die UI auf. Die eigentliche Planungslogik findet in den workflow/ Modulen statt.
 * 
 * WICHTIG: Dieser Hook führt KEINE eigene Planung durch!
 * Die Planung kommt aus:
 * - workflow/sequentialPlanning.js (customerApproval = false)
 * - workflow/parallelPlanning.js (customerApproval = true)
 * 
 * Die Baustelleneinrichtung und -räumung werden direkt in der Workflow-Planung
 * berücksichtigt, inklusive der Trocknungszeiten!
 */
export const useDayPlanning = (results, customerApproval, companySettings) => {
  return useMemo(() => {
    if (!results?.objects) return { days: [], allTasks: [], summary: {} };

    // Verwende die tatsächliche Arbeitszeit aus Company Settings (z.B. 8.25h = 495 Min)
    // Fallback auf MINUTES_PER_DAY falls nicht verfügbar
    const dailyMinutes = companySettings?.dailyHours 
      ? companySettings.dailyHours * 60 
      : MINUTES_PER_DAY;

    // ========================================================================
    // SCHRITT 1: Verwende die Workflow-Daten aus results
    // ========================================================================
    const workflow = results.workflow;
    
    // Wenn keine Workflow-Daten vorhanden sind, gib leere Struktur zurück
    if (!workflow || !workflow.days) {
      console.warn("⚠️ useDayPlanning: Keine Workflow-Daten in results gefunden");
      return { 
        days: [], 
        allTasks: [], 
        summary: {
          totalDays: results.totalDays || 0,
          plannedDays: 0,
          totalWorkTime: 0,
          totalWaitTime: 0,
          optimalEmployees: results.optimalEmployees || 1,
          employeeExplanation: [],
          canParallelize: false,
          customerApproval,
          avgUtilization: 0,
        } 
      };
    }

    // ========================================================================
    // SCHRITT 2: Sammle alle Tasks aus den Objekten für UI-Darstellung
    // ========================================================================
    const taskPool = [];
    
    // Baustelleneinrichtung (falls vorhanden)
    if (companySettings?.siteSetup && companySettings.siteSetup > 0) {
      taskPool.push({
        id: "site-setup",
        objectId: "project",
        objectName: "Baustelle",
        objectType: "Projekt",
        serviceName: "Baustelleneinrichtung",
        totalTime: companySettings.siteSetup,
        remainingTime: 0,
        waitTime: 0,
        isSubService: false,
        isFromSpecialNote: false,
        quantity: 1,
        unit: "pauschal",
        workArea: "setup",
        workAreaName: "Einrichtung",
        workflowOrder: 0,
        workflowPhase: "vorbereitung",
        workflowPhaseName: "Vorbereitung",
        workflowPhaseIcon: "🚀",
        workflowPhaseColor: "#607D8B",
        workflowExplanation: "Baustelle einrichten, Material bereitstellen, Wege sichern",
        createsDust: false,
        scheduled: true,
        isProjectTask: true,
      });
    }

    // Objekt-spezifische Tasks sammeln
    results.objects.forEach((obj) => {
      obj.services?.forEach((svc) => {
        const workArea = detectWorkArea(svc.serviceName);
        const phase = workflowPhases[svc.workflowPhase] || workflowPhases.beschichtung;

        taskPool.push({
          id: svc.id || `${obj.id}-${svc.serviceId}`,
          objectId: obj.id,
          objectName: obj.name,
          objectType: obj.objectCategory,
          serviceName: svc.serviceName,
          totalTime: svc.finalTime || 0,
          remainingTime: 0,
          waitTime: svc.waitTime || 0,
          isSubService: svc.isSubService || false,
          isFromSpecialNote: svc.isFromSpecialNote || false,
          quantity: svc.quantity || 1,
          unit: svc.unit || "",
          workArea: workArea,
          workAreaName: getAreaName(workArea),
          workflowOrder: svc.workflowOrder || 50,
          workflowPhase: svc.workflowPhase || "beschichtung",
          workflowPhaseName: phase.name || "Beschichtung",
          workflowPhaseIcon: phase.icon || "🎨",
          workflowPhaseColor: phase.color || "#2196F3",
          workflowExplanation: svc.workflowExplanation || "",
          createsDust: svc.createsDust || false,
          scheduled: true,
        });
      });
    });

    // Baustellenräumung (falls vorhanden)
    if (companySettings?.siteClearance && companySettings.siteClearance > 0) {
      taskPool.push({
        id: "site-clearance",
        objectId: "project-end",
        objectName: "Baustelle",
        objectType: "Projekt",
        serviceName: "Baustellenräumung / Entsorgung",
        totalTime: companySettings.siteClearance,
        remainingTime: 0,
        waitTime: 0,
        isSubService: false,
        isFromSpecialNote: false,
        quantity: 1,
        unit: "pauschal",
        workArea: "cleanup",
        workAreaName: "Räumung",
        workflowOrder: 999,
        workflowPhase: "finish",
        workflowPhaseName: "Abschluss",
        workflowPhaseIcon: "🧹",
        workflowPhaseColor: "#9E9E9E",
        workflowExplanation: "Abdeckungen entfernen, Abfälle entsorgen, Baustelle reinigen",
        createsDust: false,
        scheduled: true,
        isProjectTask: true,
      });
    }

    // Debug-Ausgabe
    const subServiceCount = taskPool.filter(t => t.isSubService).length;
    console.log(`📋 DayPlanningDialog: ${taskPool.length} Tasks geladen (inkl. ${subServiceCount} Unterleistungen)`);

    // ========================================================================
    // SCHRITT 3: Bereite die Tage für die UI auf (direkt aus workflow.days!)
    // ========================================================================
    const days = workflow.days.map((day, index) => {
      // Berechne Tagesstatistiken
      const totalWorkMinutes = day.tasks?.reduce((sum, t) => sum + (t.duration || 0), 0) || 0;
      const totalWaitMinutes = day.waitTimes?.reduce((sum, w) => sum + (w.duration || 0), 0) || 0;
      
      // Mitarbeiter-Auslastung
      const employeeStats = day.employeeStats || [];
      const employeeUtilization = day.employeeUtilization || [];
      
      // Überstunden berechnen
      const overtimeMinutes = Math.max(0, totalWorkMinutes - dailyMinutes);
      const hasOvertime = overtimeMinutes > 0;
      
      // Auslastung
      const utilization = dailyMinutes > 0 ? Math.round((totalWorkMinutes / dailyMinutes) * 100) : 0;

      // Tasks mit UI-Daten anreichern
      const enrichedTasks = (day.tasks || []).map(task => {
        const workArea = task.workArea || detectWorkArea(task.serviceName);
        const phase = workflowPhases[task.workflowPhase] || workflowPhases.beschichtung;
        
        // Finde das Objekt für zusätzliche Infos
        const obj = results.objects?.find(o => o.id === task.objectId);
        
        return {
          ...task,
          objectName: task.objectName || obj?.name || "Unbekannt",
          objectType: task.objectType || obj?.objectCategory || "",
          workArea: workArea,
          workAreaName: getAreaName(workArea),
          workflowPhaseName: phase.name || "Beschichtung",
          workflowPhaseIcon: phase.icon || "🎨",
          workflowPhaseColor: phase.color || "#2196F3",
          // Mitarbeiter-Farbe
          employeeColor: getEmployeeColor(task.employeeId),
        };
      });

      return {
        dayNumber: day.day || index + 1,
        tasks: enrichedTasks,
        totalWorkTime: totalWorkMinutes,
        totalWaitTime: totalWaitMinutes,
        dryingPhases: day.waitTimes || [],
        utilization,
        hasOvertime,
        overtimeMinutes,
        employeeStats,
        employeeUtilization,
        tasksByRoom: day.tasksByRoom || {},
      };
    });

    // ========================================================================
    // SCHRITT 4: Berechne Gesamtstatistiken
    // ========================================================================
    const totalWorkMinutes = days.reduce((sum, d) => sum + d.totalWorkTime, 0);
    const totalWaitMinutes = days.reduce((sum, d) => sum + d.totalWaitTime, 0);
    const avgUtilization = days.length > 0 
      ? Math.round(days.reduce((sum, d) => sum + d.utilization, 0) / days.length)
      : 0;

    // ========================================================================
    // SCHRITT 5: Erstelle Erklärungen für die UI
    // ========================================================================
    const employeeExplanation = [];
    
    // Übernehme Erklärungen aus dem Workflow
    if (workflow.employeeExplanation && Array.isArray(workflow.employeeExplanation)) {
      workflow.employeeExplanation.forEach(exp => {
        employeeExplanation.push({
          text: exp.text,
          type: exp.type || "info",
        });
      });
    }

    // Zusätzliche UI-spezifische Erklärungen
    if (!customerApproval && totalWaitMinutes > 30) {
      employeeExplanation.push({
        text: `⚠️ ${formatTime(totalWaitMinutes)} Trocknungszeit vorhanden. Ohne Kundenfreigabe muss gewartet werden.`,
        type: "warning",
      });
      employeeExplanation.push({
        text: `Tipp: Mit Kundenfreigabe könnten während der Trocknungszeiten Arbeiten in anderen Räumen durchgeführt werden.`,
        type: "tip",
      });
    }

    // Auslastungs-Info
    if (avgUtilization > 0) {
      employeeExplanation.push({
        text: `Durchschnittliche Tagesauslastung: ${avgUtilization}%`,
        type: avgUtilization >= 80 ? "success" : avgUtilization >= 60 ? "info" : "warning",
      });
    }

    // Überstunden-Info
    const daysWithOvertime = days.filter(d => d.hasOvertime && d.overtimeMinutes > 0);
    const totalOvertimeMinutes = days.reduce((sum, d) => sum + (d.overtimeMinutes || 0), 0);
    if (daysWithOvertime.length > 0) {
      employeeExplanation.push({
        text: `Überstunden: ${formatTime(totalOvertimeMinutes)} an ${daysWithOvertime.length} Tag(en) – vermeidet ineffiziente Kurztage.`,
        type: "info",
      });
    }

    // Parallelarbeit-Status
    if (workflow.isParallel) {
      employeeExplanation.push({
        text: `✅ Parallelarbeit aktiv: ${workflow.optimalEmployees} Mitarbeiter arbeiten gleichzeitig in verschiedenen Räumen.`,
        type: "success",
      });
    } else {
      employeeExplanation.push({
        text: `ℹ️ Sequenzielle Arbeit: Nur 1 Mitarbeiter gleichzeitig vor Ort.`,
        type: "info",
      });
    }

    // ========================================================================
    // SCHRITT 6: Rückgabe
    // ========================================================================
    return {
      days,
      allTasks: taskPool,
      summary: {
        totalDays: workflow.totalDays,
        plannedDays: workflow.plannedDays || days.length,
        totalWorkTime: totalWorkMinutes,
        totalWaitTime: totalWaitMinutes,
        optimalEmployees: workflow.optimalEmployees || 1,
        employeeExplanation,
        canParallelize: customerApproval && totalWaitMinutes > 30,
        customerApproval,
        avgUtilization,
        isParallel: workflow.isParallel,
      },
    };
  }, [results, customerApproval, companySettings]);
};

/**
 * Hilfsfunktion: Gibt die Farbe für einen Mitarbeiter zurück
 */
function getEmployeeColor(employeeId) {
  const colors = {
    1: "#1976d2", // Blau
    2: "#388e3c", // Grün
    3: "#7b1fa2", // Lila
    4: "#ff9800", // Orange
    5: "#00796b", // Teal
    6: "#c2185b", // Pink
    7: "#5d4037", // Braun
    8: "#455a64", // Blaugrau
  };
  return colors[employeeId] || "#757575";
}
