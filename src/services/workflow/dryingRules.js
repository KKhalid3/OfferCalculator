/**
 * ============================================================================
 * TROCKNUNGSREGELN
 * ============================================================================
 * 
 * Regeln für das Arbeiten während Trocknungsphasen.
 */

/**
 * Prüft ob während einer Trocknungsphase andere Arbeiten möglich sind
 * 
 * @param {string} dryingArea - Bereich der gerade trocknet
 * @param {string} otherArea - Bereich der bearbeitet werden soll
 * @param {boolean} sameRoom - Ist es der gleiche Raum?
 * @param {boolean} otherTaskCreatesDust - Erzeugt die geplante Arbeit Staub?
 * @returns {{ canWork: boolean, reason: string }}
 */
export function canWorkDuringDrying(dryingArea, otherArea, sameRoom, otherTaskCreatesDust = false) {
  // Boden trocknet: Im gleichen Raum NICHTS möglich
  if (dryingArea === 'boden' && sameRoom) {
    return { canWork: false, reason: 'Boden trocknet – Raum nicht betretbar' };
  }

  // Anderer Raum: Immer möglich (wenn Kundenfreigabe)
  if (!sameRoom) {
    return { canWork: true, reason: 'Anderer Raum – unabhängig von Trocknungsphase' };
  }

  // Stauberzeugende Arbeiten während Lackierung/Anstrich-Trocknung verhindern
  if (otherTaskCreatesDust && ['fenster', 'tuer', 'lackierung', 'anstrich', 'wand', 'decke'].includes(dryingArea) && sameRoom) {
    return {
      canWork: false,
      reason: 'Stauberzeugende Arbeiten während Trocknung nicht möglich – Staub würde sich festsetzen'
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

  // Fenster/Türen trocknen - nur nicht-stauberzeugende Arbeiten
  if (['fenster', 'tuer', 'lackierung'].includes(dryingArea) && sameRoom) {
    if (['wand', 'decke'].includes(otherArea) && !otherTaskCreatesDust) {
      return { canWork: true, reason: 'Türen/Fenster trocknen – nicht-stauberzeugende Arbeiten möglich' };
    }
  }

  // Spachtelung trocknet - Im gleichen Raum KEINE weiteren Arbeiten möglich
  if (dryingArea === 'spachtel' && sameRoom) {
    if (['grundierung', 'tapete', 'anstrich', 'wand', 'decke'].includes(otherArea)) {
      return {
        canWork: false,
        reason: 'Spachtelung trocknet – Grundierung, Tapezieren und Streichen nicht möglich'
      };
    }
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
 * Prüft ob ein Task während einer aktiven Trocknungsphase ausgeführt werden kann
 * 
 * @param {Object} task - Der zu prüfende Task
 * @param {Array} activeDryingPhases - Aktive Trocknungsphasen
 * @param {boolean} allowParallelRooms - Ist Parallelarbeit in verschiedenen Räumen erlaubt?
 * @returns {{ canWork: boolean, reason: string }}
 */
export function canTaskWorkDuringDrying(task, activeDryingPhases, allowParallelRooms) {
  for (const dryingPhase of activeDryingPhases) {
    const sameRoom = task.objectId === dryingPhase.objectId;
    
    // Anderer Raum nur bei Parallelarbeit erlaubt
    if (!sameRoom && !allowParallelRooms) {
      continue; // Ignoriere Trocknungsphasen in anderen Räumen
    }
    
    const result = canWorkDuringDrying(
      dryingPhase.area,
      task.workArea,
      sameRoom,
      task.createsDust
    );
    
    if (!result.canWork) {
      return result;
    }
  }
  
  return { canWork: true, reason: 'Keine blockierende Trocknungsphase' };
}

/**
 * Aktualisiert die aktiven Trocknungsphasen basierend auf der verstrichenen Zeit
 * 
 * @param {Array} activeDryingPhases - Aktuelle Trocknungsphasen
 * @param {number} elapsedMinutes - Verstrichene Minuten
 * @returns {Array} Aktualisierte Trocknungsphasen
 */
export function updateDryingPhases(activeDryingPhases, elapsedMinutes) {
  return activeDryingPhases
    .map(phase => ({
      ...phase,
      remainingTime: phase.remainingTime - elapsedMinutes
    }))
    .filter(phase => phase.remainingTime > 0);
}

/**
 * Fügt eine neue Trocknungsphase hinzu
 * 
 * @param {Array} activeDryingPhases - Aktuelle Trocknungsphasen
 * @param {Object} task - Der Task der die Trocknungsphase auslöst
 * @param {number} currentTime - Aktuelle Zeit in Minuten
 * @returns {Array} Aktualisierte Trocknungsphasen
 */
export function addDryingPhase(activeDryingPhases, task, currentTime) {
  if (!task.waitTime || task.waitTime <= 0) {
    return activeDryingPhases;
  }
  
  return [
    ...activeDryingPhases,
    {
      objectId: task.objectId,
      area: task.workArea,
      taskId: task.id,
      serviceName: task.serviceName,
      startTime: currentTime,
      totalTime: task.waitTime,
      remainingTime: task.waitTime,
      endsAt: currentTime + task.waitTime
    }
  ];
}
