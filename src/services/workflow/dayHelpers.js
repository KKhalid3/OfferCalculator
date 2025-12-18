/**
 * ============================================================================
 * TAG-HILFSFUNKTIONEN
 * ============================================================================
 * 
 * Hilfsfunktionen für die Tagesplanung.
 */

/**
 * Erstellt ein neues Tag-Objekt
 * 
 * @param {number} dayNumber - Tagnummer
 * @returns {Object} Neues Tag-Objekt
 */
export function createNewDay(dayNumber) {
  return {
    day: dayNumber,
    hours: 0,
    minutes: 0,
    tasks: [],
    waitTimes: [],
    tasksByRoom: {},
    employeeStats: [],
    employeeUtilization: [],
    minHoursViolations: []
  };
}

/**
 * Erstellt ein neues Mitarbeiter-Schedule-Objekt
 * 
 * @param {number} employeeId - Mitarbeiter-ID (1-basiert)
 * @returns {Object} Neues Schedule-Objekt
 */
export function createEmployeeSchedule(employeeId) {
  return {
    id: employeeId,
    name: `MA ${employeeId}`,
    currentDayMinutes: 0,
    currentObjectId: null,
    activeDryingPhase: null,
    totalMinutesWorked: 0
  };
}

/**
 * Findet den Mitarbeiter mit der geringsten Auslastung
 * 
 * @param {Array} employeeSchedules - Liste der Mitarbeiter-Schedules
 * @returns {Object} Mitarbeiter mit geringster Auslastung
 */
export function findLeastBusyEmployee(employeeSchedules) {
  return employeeSchedules.reduce((least, emp) => 
    emp.currentDayMinutes < least.currentDayMinutes ? emp : least
  );
}

/**
 * Prüft ob alle Mitarbeiter das Tagespensum erreicht haben
 * 
 * @param {Array} employeeSchedules - Liste der Mitarbeiter-Schedules
 * @param {number} dailyMinutes - Tägliche Arbeitszeit in Minuten
 * @returns {boolean} true wenn alle fertig sind
 */
export function allEmployeesFinishedDay(employeeSchedules, dailyMinutes) {
  return employeeSchedules.every(emp => emp.currentDayMinutes >= dailyMinutes);
}

/**
 * Setzt alle Mitarbeiter-Schedules für einen neuen Tag zurück
 * 
 * @param {Array} employeeSchedules - Liste der Mitarbeiter-Schedules
 */
export function resetEmployeeSchedulesForNewDay(employeeSchedules) {
  for (const emp of employeeSchedules) {
    emp.currentDayMinutes = 0;
    emp.currentObjectId = null;
  }
}

/**
 * Berechnet die Auslastung eines Mitarbeiters
 * 
 * @param {number} workedMinutes - Gearbeitete Minuten
 * @param {number} dailyMinutes - Tägliche Arbeitszeit in Minuten
 * @returns {number} Auslastung in Prozent
 */
export function calculateUtilization(workedMinutes, dailyMinutes) {
  return Math.round((workedMinutes / dailyMinutes) * 100);
}

/**
 * Formatiert Minuten zu Stunden:Minuten
 * 
 * @param {number} minutes - Minuten
 * @returns {string} Formatierte Zeit
 */
export function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Finalisiert einen Tag mit allen Statistiken
 * 
 * @param {Object} day - Tag-Objekt
 * @param {Array} employeeSchedules - Liste der Mitarbeiter-Schedules
 * @param {number} dailyMinutes - Tägliche Arbeitszeit in Minuten
 * @returns {Object} Finalisiertes Tag-Objekt
 */
export function finalizeDay(day, employeeSchedules, dailyMinutes) {
  // Berechne Gesamtminuten
  const totalMinutes = day.tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
  day.minutes = totalMinutes;
  day.hours = totalMinutes / 60;
  
  // Mitarbeiter-Statistiken
  day.employeeStats = employeeSchedules.map(emp => ({
    id: emp.id,
    name: emp.name,
    minutesWorked: emp.currentDayMinutes,
    hoursWorked: emp.currentDayMinutes / 60,
    utilization: calculateUtilization(emp.currentDayMinutes, dailyMinutes)
  }));
  
  // Auslastung pro Mitarbeiter (mit allen benötigten Feldern für UI)
  day.employeeUtilization = day.employeeStats.map(stat => ({
    employeeId: stat.id,
    employeeName: stat.name,
    minutes: stat.minutesWorked,
    hours: stat.hoursWorked,
    utilizationPercent: stat.utilization,
    utilization: stat.utilization,
    meetsMinimum: true // Wird in der UI ggf. überschrieben
  }));
  
  return day;
}

/**
 * Gruppiert Tasks nach Raum für die Visualisierung
 * 
 * @param {Array} tasks - Liste der Tasks eines Tages
 * @returns {Object} Tasks gruppiert nach Raum-ID
 */
export function groupTasksByRoom(tasks) {
  const tasksByRoom = {};
  
  for (const task of tasks) {
    const roomId = task.objectId || 'unknown';
    if (!tasksByRoom[roomId]) {
      tasksByRoom[roomId] = [];
    }
    tasksByRoom[roomId].push(task);
  }
  
  return tasksByRoom;
}
