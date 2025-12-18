/**
 * Formatiert Zeit in Stunden und Minuten
 * @param {number} minutes - Zeit in Minuten
 * @returns {string} Formatierte Zeit als "H:MM h"
 */
export const formatTime = (minutes) => {
  if (!minutes && minutes !== 0) return "0:00 h";
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")} h`;
};

/**
 * Formatiert Uhrzeit (für Timeline)
 * @param {number} minutes - Zeit in Minuten seit Tagesbeginn
 * @returns {string} Formatierte Uhrzeit als "H:MM"
 */
export const formatClock = (minutes) => {
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
};
