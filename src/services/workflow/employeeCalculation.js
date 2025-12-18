/**
 * ============================================================================
 * MITARBEITER-BERECHNUNG
 * ============================================================================
 * 
 * Berechnet die optimale Mitarbeiteranzahl basierend auf der ZIEL-REGEL:
 * 
 * | Projektdauer | → Mitarbeiter |
 * |--------------|---------------|
 * | 1-4 Tage     | 1 MA          |
 * | 5-9 Tage     | 2 MA          |
 * | 10-14 Tage   | 3 MA          |
 * | 15-19 Tage   | 4 MA          |
 * | usw.         |               |
 * 
 * ALGORITHMUS:
 * - MIT Parallelarbeit: Suche die Kombination (MA, Tage), bei der Tage im erlaubten Bereich liegt
 * - OHNE Parallelarbeit: Basisdauer = Arbeitszeit / 8h, wende Regel darauf an
 */

import { DAYS_PER_WEEK, MAX_EMPLOYEES, DEFAULT_DAILY_HOURS, DEFAULT_MIN_HOURS_PER_EMPLOYEE } from './constants';

/**
 * Berechnet die Mitarbeiteranzahl basierend auf der Projektdauer nach der Regel.
 * 
 * @param {number} projectDays - Projektdauer in Tagen
 * @returns {number} Mitarbeiteranzahl nach der Regel
 */
export function calculateEmployeesByBaselineRule(projectDays) {
  if (projectDays < DAYS_PER_WEEK) {
    return 1;
  }
  return Math.floor(projectDays / DAYS_PER_WEEK) + 1;
}

/**
 * Gibt die Projektdauer-Range für eine bestimmte Mitarbeiteranzahl zurück.
 * 
 * @param {number} employees - Mitarbeiteranzahl
 * @returns {Object} { min, max } - Projektdauer-Range in Tagen
 */
export function getBaselineRangeForEmployees(employees) {
  if (employees === 1) {
    return { min: 1, max: DAYS_PER_WEEK - 1 }; // 1-4 Tage
  }
  
  return {
    min: (employees - 1) * DAYS_PER_WEEK,      // z.B. 2 MA → 5, 3 MA → 10
    max: employees * DAYS_PER_WEEK - 1          // z.B. 2 MA → 9, 3 MA → 14
  };
}

/**
 * Findet die gültige Kombination aus MA und Tagen basierend auf der Regel.
 * 
 * Der Algorithmus sucht die MA-Anzahl, bei der:
 * - Tage = Arbeitszeit / (MA × Stunden/Tag)
 * - Tage im erlaubten Bereich für diese MA-Anzahl liegt
 * 
 * @param {number} totalHours - Gesamtarbeitszeit in Stunden
 * @param {number} dailyHours - Arbeitsstunden pro Tag
 * @param {number} minHoursPerEmployee - Mindeststunden pro MA (Constraint)
 * @returns {{ employees: number, days: number, hoursPerEmployee: number }}
 */
export function findValidEmployeeConfiguration(totalHours, dailyHours, minHoursPerEmployee = DEFAULT_MIN_HOURS_PER_EMPLOYEE) {
  console.log(`🔍 Suche gültige MA-Konfiguration für ${totalHours.toFixed(1)}h Arbeitszeit...`);
  
  // Durchlaufe MA von 1 aufwärts und finde die erste gültige Kombination
  for (let ma = 1; ma <= MAX_EMPLOYEES; ma++) {
    // Berechne benötigte Tage für diese MA-Anzahl
    const requiredDays = Math.ceil(totalHours / (ma * dailyHours));
    
    // Hole erlaubten Bereich für diese MA-Anzahl
    const range = getBaselineRangeForEmployees(ma);
    
    // Berechne Stunden pro MA
    const hoursPerEmployee = totalHours / ma;
    
    console.log(`  ${ma} MA: ${requiredDays} Tage benötigt, erlaubt: ${range.min}-${range.max} Tage, ${hoursPerEmployee.toFixed(1)}h/MA`);
    
    // Prüfe Constraint: Mindeststunden pro MA
    if (hoursPerEmployee < minHoursPerEmployee) {
      console.log(`  ❌ ${ma} MA: ${hoursPerEmployee.toFixed(1)}h/MA < ${minHoursPerEmployee}h Minimum`);
      // Bei zu wenig Stunden pro MA: vorherige Konfiguration zurückgeben
      if (ma > 1) {
        const prevDays = Math.ceil(totalHours / ((ma - 1) * dailyHours));
        const prevRange = getBaselineRangeForEmployees(ma - 1);
        const clampedDays = Math.min(Math.max(prevDays, prevRange.min), prevRange.max);
        return {
          employees: ma - 1,
          days: clampedDays,
          hoursPerEmployee: totalHours / (ma - 1)
        };
      }
      break;
    }
    
    // Prüfe, ob die benötigten Tage im erlaubten Bereich liegen
    if (requiredDays >= range.min && requiredDays <= range.max) {
      console.log(`  ✅ ${ma} MA: ${requiredDays} Tage passt in Bereich ${range.min}-${range.max}!`);
      return {
        employees: ma,
        days: requiredDays,
        hoursPerEmployee: hoursPerEmployee
      };
    }
    
    // Wenn benötigte Tage kleiner als Minimum sind, ist diese MA-Anzahl zu hoch
    if (requiredDays < range.min) {
      console.log(`  ⚠️ ${ma} MA: ${requiredDays} Tage < ${range.min} (zu wenige Tage)`);
      continue;
    }
    
    // Wenn benötigte Tage größer als Maximum sind, brauchen wir mehr MA
    if (requiredDays > range.max) {
      console.log(`  ⏭️ ${ma} MA: ${requiredDays} Tage > ${range.max} (zu viele Tage, mehr MA nötig)`);
      continue;
    }
  }
  
  // Fallback: Basierend auf Arbeitszeit berechnen
  const fallbackDays = Math.ceil(totalHours / dailyHours);
  const fallbackMA = calculateEmployeesByBaselineRule(fallbackDays);
  console.log(`  ⚠️ Fallback: ${fallbackMA} MA für ${fallbackDays} Tage`);
  
  return {
    employees: fallbackMA,
    days: fallbackDays,
    hoursPerEmployee: totalHours / fallbackMA
  };
}

/**
 * Berechnet die optimale Mitarbeiteranzahl mit allen Constraints.
 * 
 * @param {number} totalHours - Gesamtstunden
 * @param {Object} companySettings - Unternehmenseinstellungen
 * @param {Array} calculations - Alle Berechnungen mit Service-Infos
 * @param {number} uniqueObjects - Anzahl verschiedener Objekte/Räume
 * @param {boolean} customerApproval - Kundenfreigabe für Parallelarbeit
 * @returns {Object} Ergebnis mit optimalEmployees, recommendedDays, reasoning
 */
export async function calculateOptimalEmployeesAdvanced(
  totalHours,
  companySettings,
  calculations = [],
  uniqueObjects = 1,
  customerApproval = false
) {
  const dailyHours = companySettings?.dailyHours || DEFAULT_DAILY_HOURS;
  const minHoursPerEmployee = companySettings?.minHoursPerEmployee || DEFAULT_MIN_HOURS_PER_EMPLOYEE;
  const allowParallelRooms = companySettings?.allowParallelRoomWork ?? true;

  // Basisdauer (ohne Parallelarbeit, 1 MA)
  const baseDays = totalHours / dailyHours;
  
  const result = {
    optimalEmployees: 1,
    reasoning: [],
    efficiencyImpact: 0,
    hoursPerEmployee: totalHours,
    recommendedDays: baseDays
  };

  result.reasoning.push({
    type: 'info',
    text: `📊 Gesamtarbeitszeit: ${totalHours.toFixed(1)}h`
  });
  result.reasoning.push({
    type: 'info',
    text: `📊 Arbeitstag: ${dailyHours}h`
  });
  result.reasoning.push({
    type: 'info',
    text: `📊 Basisdauer (1 MA, sequenziell): ${baseDays.toFixed(2)} Tage`
  });

  // Bestimme ob Parallelarbeit möglich ist
  const canWorkParallel = (customerApproval && allowParallelRooms && uniqueObjects > 1);
  
  let finalEmployees;
  let finalProjectDays;
  let hoursPerEmployee;
  
  if (canWorkParallel) {
    // ============================================================================
    // MIT PARALLELARBEIT: Optimierte Zeitnutzung
    // ============================================================================
    result.reasoning.push({
      type: 'info',
      text: `🔄 Parallelarbeit AKTIV: ${uniqueObjects} Räume verfügbar`
    });
    
    // Finde die gültige Konfiguration basierend auf der reinen Arbeitszeit
    const config = findValidEmployeeConfiguration(totalHours, dailyHours, minHoursPerEmployee);
    
    finalEmployees = config.employees;
    finalProjectDays = config.days;
    hoursPerEmployee = config.hoursPerEmployee;
    
    const range = getBaselineRangeForEmployees(finalEmployees);
    result.reasoning.push({
      type: 'success',
      text: `📐 Regel erfüllt: ${totalHours.toFixed(1)}h / (${finalEmployees} MA × ${dailyHours}h) = ${finalProjectDays} Tage → Bereich ${range.min}-${range.max} Tage`
    });
    
  } else {
    // ============================================================================
    // OHNE PARALLELARBEIT: Sequenzielle Arbeit
    // ============================================================================
    if (!customerApproval) {
      result.reasoning.push({
        type: 'info',
        text: `🔄 Parallelarbeit DEAKTIVIERT (keine Kundenfreigabe)`
      });
    } else if (!allowParallelRooms) {
      result.reasoning.push({
        type: 'info',
        text: `🔄 Parallelarbeit DEAKTIVIERT (Einstellung)`
      });
    } else if (uniqueObjects <= 1) {
      result.reasoning.push({
        type: 'info',
        text: `🔄 Parallelarbeit nicht möglich (nur 1 Raum)`
      });
    }
    
    // Bei sequenzieller Arbeit: Projektdauer = Basisdauer
    finalProjectDays = Math.ceil(baseDays);
    
    // Wende die Regel auf die Basisdauer an
    finalEmployees = calculateEmployeesByBaselineRule(finalProjectDays);
    
    // Prüfe Mindeststunden-Constraint
    while (finalEmployees > 1) {
      const hpe = totalHours / finalEmployees;
      if (hpe >= minHoursPerEmployee) {
        break;
      }
      result.reasoning.push({
        type: 'warning',
        text: `⚠️ ${finalEmployees} MA: ${hpe.toFixed(1)}h/MA < ${minHoursPerEmployee}h Minimum → reduziere`
      });
      finalEmployees--;
    }
    
    hoursPerEmployee = totalHours / finalEmployees;
    
    const range = getBaselineRangeForEmployees(finalEmployees);
    result.reasoning.push({
      type: 'success',
      text: `📐 Regel: Projektdauer ${finalProjectDays} Tage → ${finalEmployees} MA (Bereich ${range.min}-${range.max})`
    });
  }
  
  // Setze finale Werte
  result.optimalEmployees = finalEmployees;
  result.hoursPerEmployee = hoursPerEmployee;
  result.recommendedDays = finalProjectDays;

  // Ergebnis-Meldung
  const auslastung = (totalHours / (finalEmployees * finalProjectDays * dailyHours) * 100).toFixed(1);
  result.reasoning.push({
    type: 'success',
    text: `✅ Ergebnis: ${finalEmployees} MA, ${finalProjectDays} Tage (${hoursPerEmployee.toFixed(1)}h/MA, ${auslastung}% Auslastung)`
  });

  // Zusätzliche Infos
  if (canWorkParallel && finalEmployees > 1) {
    result.reasoning.push({
      type: 'info',
      text: `ℹ️ ${finalEmployees} MA arbeiten gleichzeitig in verschiedenen Räumen`
    });
  } else if (!canWorkParallel && finalEmployees > 1) {
    result.reasoning.push({
      type: 'info',
      text: `ℹ️ Nur 1 MA gleichzeitig vor Ort (keine Parallelarbeit)`
    });
  }

  // Warnung bei Trocknungszeit ohne Kundenfreigabe
  const totalWaitTime = calculations.reduce((sum, c) => sum + (c.waitTime || 0), 0);
  if (totalWaitTime > 0 && !customerApproval) {
    result.reasoning.push({
      type: 'warning',
      text: `⚠️ ${(totalWaitTime / 60).toFixed(1)}h Trocknungszeit vorhanden. Ohne Kundenfreigabe muss gewartet werden.`
    });
  }

  console.log(`📊 MA-Berechnung: ${totalHours.toFixed(1)}h → ${finalProjectDays} Tage, ${finalEmployees} MA (Parallel: ${canWorkParallel})`);

  return result;
}

/**
 * Einfache Fallback-Funktion für MA-Berechnung
 */
export function calculateOptimalEmployees(totalHours, dailyHours = DEFAULT_DAILY_HOURS) {
  if (totalHours <= dailyHours) return 1;

  const employees = Math.ceil(totalHours / dailyHours);
  const hoursPerEmployee = totalHours / employees;
  
  if (hoursPerEmployee < 4) {
    return Math.max(1, Math.floor(totalHours / 4));
  }

  return employees;
}
