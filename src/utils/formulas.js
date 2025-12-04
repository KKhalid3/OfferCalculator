/**
 * Schritt 3: Mengenberechnung Decke
 * Deckenfläche = Grundfläche (1:1 Übernahme)
 */
export function calculateCeilingArea(floorArea) {
  return floorArea;
}

/**
 * Schritt 4: Mengenberechnung Raumumfang
 * Umfang = 4 × √(Grundfläche)
 */
export function calculatePerimeter(floorArea) {
  return 4 * Math.sqrt(floorArea);
}

/**
 * Schritt 6: Mengenberechnung Wandflächen
 * Wandfläche = Umfang × Raumhöhe
 */
export function calculateWallArea(perimeter, height) {
  return perimeter * height;
}

/**
 * Wandfläche mit Mengenfaktor
 */
export function calculateWallAreaWithFactor(perimeter, height, quantityFactor = 1) {
  return (perimeter * quantityFactor) * height;
}

/**
 * Baseline-Zeit berechnen
 * Baseline je Einheit = Standard-Zeit ÷ Standard-Menge
 */
export function calculateBaselineTimePerUnit(standardTime, standardQuantity) {
  if (standardQuantity === 0) return 0;
  return standardTime / standardQuantity;
}

/**
 * Baseline-Zeit für Menge
 */
export function calculateBaselineTime(standardTime, standardQuantity, quantity) {
  const timePerUnit = calculateBaselineTimePerUnit(standardTime, standardQuantity);
  return timePerUnit * quantity;
}

