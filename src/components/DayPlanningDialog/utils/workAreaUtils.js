/**
 * Erkennt den Arbeitsbereich aus dem Service-Namen
 * @param {string} serviceName - Name des Services
 * @returns {string} Arbeitsbereich-Identifikator
 */
export const detectWorkArea = (serviceName) => {
  const name = serviceName.toLowerCase();

  if (name.includes("decke") || name.includes("decken")) return "decke";
  if (name.includes("wand") || name.includes("wände")) return "wand";
  if (name.includes("boden") || name.includes("abdecken")) return "boden";
  if (name.includes("fenster")) return "fenster";
  if (name.includes("tür") || name.includes("zarge")) return "tuer";
  if (
    name.includes("lackier") ||
    name.includes("schleifen") ||
    name.includes("grundier")
  )
    return "lackierung";
  if (
    name.includes("tapete") ||
    name.includes("tapezier") ||
    name.includes("raufaser") ||
    name.includes("vlies")
  )
    return "tapete";
  if (name.includes("spachtel")) return "spachtel";
  if (name.includes("grundierung") || name.includes("grundier"))
    return "grundierung";
  if (name.includes("streichen") || name.includes("anstrich"))
    return "anstrich";

  return "allgemein";
};

/**
 * Gibt lesbaren Namen für den Arbeitsbereich zurück
 * @param {string} area - Arbeitsbereich-Identifikator
 * @returns {string} Lesbarer Name
 */
export const getAreaName = (area) => {
  const names = {
    decke: "Decke",
    wand: "Wände",
    boden: "Boden",
    fenster: "Fenster",
    tuer: "Türen/Zargen",
    lackierung: "Lackierarbeiten",
    tapete: "Tapezierarbeiten",
    spachtel: "Spachtelarbeiten",
    grundierung: "Grundierung",
    anstrich: "Anstrich",
    allgemein: "Allgemein",
  };
  return names[area] || area;
};

/**
 * Prüft ob zwei Arbeitsbereiche parallel im gleichen Raum möglich sind
 * @param {string} dryingArea - Arbeitsbereich der trocknet
 * @param {string} otherArea - Anderer Arbeitsbereich
 * @param {boolean} otherTaskCreatesDust - Ob die geplante Arbeit Staub erzeugt (z.B. Schleifen)
 * @returns {{canWork: boolean, reason: string}} Ob Parallelarbeit möglich ist und Begründung
 */
export const canWorkParallelInSameRoom = (
  dryingArea,
  otherArea,
  otherTaskCreatesDust = false
) => {
  // Regeln für Parallelarbeit im gleichen Raum:

  // Boden trocknet: NICHTS anderes möglich (man muss drauf stehen!)
  if (dryingArea === "boden") {
    return {
      canWork: false,
      reason: "Boden trocknet – Raum nicht betretbar",
    };
  }

  // WICHTIG: Stauberzeugende Arbeiten während Trocknungsphasen verhindern
  // Staub würde sich in der feuchten Oberfläche festsetzen!
  if (
    otherTaskCreatesDust &&
    [
      "fenster",
      "tuer",
      "lackierung",
      "anstrich",
      "wand",
      "decke",
      "spachtel",
      "grundierung",
    ].includes(dryingArea)
  ) {
    return {
      canWork: false,
      reason: `🌫️ Stauberzeugende Arbeit nicht möglich – ${getAreaName(
        dryingArea
      )} trocknet noch und würde durch Staub verunreinigt`,
    };
  }

  // Decke trocknet: Wände, Fenster, Türen können gemacht werden (wenn kein Staub)
  if (dryingArea === "decke") {
    if (["wand", "fenster", "tuer", "lackierung"].includes(otherArea)) {
      return {
        canWork: true,
        reason: "Decke trocknet – Wände/Fenster/Türen sind unabhängig",
      };
    }
    if (otherArea === "boden") {
      return {
        canWork: true,
        reason: "Decke trocknet – Bodenarbeiten möglich",
      };
    }
  }

  // Wände trocknen: Fenster, Türen können gemacht werden (sind oft unabhängig)
  if (dryingArea === "wand") {
    if (["fenster", "tuer"].includes(otherArea)) {
      return {
        canWork: true,
        reason: "Wände trocknen – Fenster/Türen können bearbeitet werden",
      };
    }
    if (otherArea === "decke") {
      return {
        canWork: false,
        reason:
          "Wände trocknen – Deckenarbeiten würden Wände beschädigen (Tropfen)",
      };
    }
  }

  // Fenster/Türen trocknen: Andere Flächen können gemacht werden (wenn kein Staub)
  if (["fenster", "tuer", "lackierung"].includes(dryingArea)) {
    if (["wand", "decke"].includes(otherArea) && !otherTaskCreatesDust) {
      return {
        canWork: true,
        reason: `${getAreaName(dryingArea)} trocknet – ${getAreaName(
          otherArea
        )} kann bearbeitet werden (keine stauberzeugende Arbeit)`,
      };
    }
  }

  // Spachtel/Grundierung trocknet: Gleiche Fläche muss warten
  if (["spachtel", "grundierung", "tapete", "anstrich"].includes(dryingArea)) {
    if (otherArea === dryingArea) {
      return {
        canWork: false,
        reason: "Gleiche Oberflächenbehandlung – muss erst trocknen",
      };
    }
  }

  // Standard: Gleicher Bereich = warten
  if (dryingArea === otherArea) {
    return {
      canWork: false,
      reason: `${getAreaName(
        dryingArea
      )} trocknet – gleicher Bereich nicht bearbeitbar`,
    };
  }

  // Standard: Andere Bereiche können oft parallel gemacht werden
  return {
    canWork: true,
    reason: `${getAreaName(dryingArea)} trocknet – ${getAreaName(
      otherArea
    )} ist unabhängig`,
  };
};
