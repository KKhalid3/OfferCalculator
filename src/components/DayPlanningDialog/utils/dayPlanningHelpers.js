import { MINUTES_PER_DAY } from "../../../constants";

/**
 * Extrahiert Mitarbeiter-Daten aus Tasks
 *
 * Diese Funktion gruppiert Tasks nach Mitarbeitern für die Timeline-Visualisierung.
 * Jeder Mitarbeiter bekommt eine eigene Zeile mit allen seinen Tasks.
 *
 * @param {Object} day - Tag-Objekt mit tasks
 * @param {Object} companySettings - Firmeneinstellungen
 * @returns {Array} Array von Mitarbeiter-Objekten mit tasks, totalTime und maxTime
 */
export const getEmployeesForDay = (day, companySettings) => {
  const employeeMap = {};
  const maxOvertimePercent = companySettings?.maxOvertimePercent ?? 15;
  const maxDayMinutes = Math.round(
    MINUTES_PER_DAY * (1 + maxOvertimePercent / 100)
  );

  // Gruppiere Tasks nach Mitarbeiter
  day.tasks?.forEach((task) => {
    // Wenn kein employeeId vorhanden, verwende "unassigned"
    const empId = task.employeeId || "unassigned";
    const empName =
      task.employeeName ||
      (empId === "unassigned" ? "Nicht zugewiesen" : `MA ${empId}`);

    if (!employeeMap[empId]) {
      employeeMap[empId] = {
        employeeId: empId,
        employeeName: empName,
        tasks: [],
        totalTime: 0,
        maxTime: 0, // Maximale Zeit für Timeline (inkl. Überstunden)
      };
    }

    employeeMap[empId].tasks.push(task);
    // WICHTIG: duration ist in Minuten (von workflowService)
    const taskDuration = task.duration || task.scheduledTime || 0;
    employeeMap[empId].totalTime += taskDuration;

    // Berechne maximale Zeit für Timeline (Ende des letzten Tasks + Trocknungszeit)
    const taskEndTime = (task.startTime || 0) + taskDuration;
    const waitTime = task.waitTime || 0;
    const totalEndTime = taskEndTime + waitTime; // Ende inkl. Trocknungszeit
    if (totalEndTime > employeeMap[empId].maxTime) {
      employeeMap[empId].maxTime = totalEndTime;
    }
  });

  // Sortiere Tasks nach startTime für jeden Mitarbeiter
  const employees = Object.values(employeeMap).map((emp) => {
    const sortedTasks = emp.tasks.sort(
      (a, b) => (a.startTime || 0) - (b.startTime || 0)
    );

    // Berechne maximale Zeit für Timeline: Ende des letzten Tasks
    // Stelle sicher, dass maxTime mindestens MINUTES_PER_DAY ist
    // WICHTIG: Begrenze NICHT auf maxDayMinutes, damit alle Tasks sichtbar sind
    const actualMaxTime = Math.max(emp.maxTime, MINUTES_PER_DAY);

    return {
      ...emp,
      tasks: sortedTasks,
      maxTime: actualMaxTime, // Maximale Zeit für Timeline-Skalierung (kann über 8h sein)
    };
  });

  // Sortiere Mitarbeiter nach ID (unassigned zuletzt)
  return employees.sort((a, b) => {
    if (a.employeeId === "unassigned") return 1;
    if (b.employeeId === "unassigned") return -1;
    return a.employeeId - b.employeeId;
  });
};

/**
 * Extrahiert Raum-Daten aus der neuen tasksByRoom Struktur
 *
 * Diese Funktion nutzt die neue Datenstruktur aus workflowService:
 * - tasksByRoom: Gruppiert Tasks nach Räumen für parallele Visualisierung
 * - Falls nicht verfügbar: Fallback auf manuelle Gruppierung nach objectId
 *
 * @param {Object} day - Tag-Objekt mit tasks oder tasksByRoom
 * @returns {Array} Array von Raum-Objekten mit tasks und totalTime
 */
export const getRoomsForDay = (day) => {
  // NEU: Nutze tasksByRoom wenn verfügbar (von workflowService)
  if (day.tasksByRoom && Object.keys(day.tasksByRoom).length > 0) {
    return Object.entries(day.tasksByRoom).map(([roomId, tasks]) => {
      // Finde Raum-Name aus dem ersten Task
      const firstTask = tasks[0];
      return {
        roomId,
        roomName: firstTask?.objectName || `Raum ${roomId}`,
        tasks: tasks,
        // WICHTIG: duration ist in Minuten (von workflowService)
        totalTime: tasks.reduce((sum, t) => sum + (t.duration || 0), 0),
      };
    });
  }

  // FALLBACK: Gruppiere Tasks manuell nach objectId
  const tasksByRoom = {};
  day.tasks?.forEach((task) => {
    const roomId = task.objectId || "unknown";
    if (!tasksByRoom[roomId]) {
      tasksByRoom[roomId] = [];
    }
    tasksByRoom[roomId].push(task);
  });

  return Object.entries(tasksByRoom).map(([roomId, tasks]) => {
    const firstTask = tasks[0];
    return {
      roomId,
      roomName: firstTask?.objectName || `Raum ${roomId}`,
      tasks: tasks,
      // WICHTIG: duration ist in Minuten (von workflowService)
      totalTime: tasks.reduce((sum, t) => sum + (t.duration || 0), 0),
    };
  });
};

/**
 * Berechnet Mitarbeiter-Auslastung für einen Tag
 *
 * Nutzt die neue employeeUtilization Struktur aus workflowService:
 * - employeeUtilization: Bereits berechnete Auslastung pro Mitarbeiter
 * - Falls nicht verfügbar: Berechnet manuell aus Tasks
 *
 * @param {Object} day - Tag-Objekt mit tasks oder employeeUtilization
 * @param {Object} companySettings - Firmeneinstellungen
 * @returns {Array} Array von Mitarbeiter-Objekten mit minutes, hours, utilizationPercent
 */
export const getEmployeeUtilization = (day, companySettings) => {
  // NEU: Nutze employeeUtilization wenn verfügbar (von workflowService oder lokaler Planung)
  if (day.employeeUtilization && day.employeeUtilization.length > 0) {
    return day.employeeUtilization;
  }

  // FALLBACK: Berechne manuell aus Tasks
  const employeeMap = {};
  day.tasks?.forEach((task) => {
    if (task.employeeId) {
      if (!employeeMap[task.employeeId]) {
        employeeMap[task.employeeId] = {
          employeeId: task.employeeId,
          employeeName: task.employeeName || `MA ${task.employeeId}`,
          minutes: 0,
          tasks: [],
        };
      }
      // WICHTIG: duration hat Priorität (von workflowService oder lokaler Planung)
      // scheduledTime ist Fallback für alte Datenstruktur
      const taskDuration = task.duration || task.scheduledTime || 0;
      employeeMap[task.employeeId].minutes += taskDuration;
      employeeMap[task.employeeId].tasks.push(task);
    }
  });

  const minHoursPerEmployee = companySettings?.minHoursPerEmployee || 6;

  return Object.values(employeeMap).map((emp) => ({
    ...emp,
    hours: emp.minutes / 60,
    utilizationPercent: (emp.minutes / MINUTES_PER_DAY) * 100,
    meetsMinimum:
      emp.minutes / 60 >= minHoursPerEmployee || emp.minutes === 0,
  }));
};
