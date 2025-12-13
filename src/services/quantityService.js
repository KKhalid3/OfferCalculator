import { calculateCeilingArea, calculatePerimeter, calculateWallAreaWithFactor } from '../utils/formulas';
import { databaseService } from './databaseService';

/**
 * Berechnet alle Mengen für ein Objekt
 * Schritt 3, 4, 5, 6
 * 
 * FAKTOREN-LOGIK:
 * - Mengen-Faktoren (category: 'Mengen'): Beeinflussen Umfang/Fläche (z.B. Flur = 1.2x Umfang)
 * - Leistungs-Faktoren (category: 'Leistung'): Beeinflussen Zeitaufwand (z.B. Bad = 2x Zeit)
 * 
 * Die Faktoren werden nach Raumtyp-NAME gesucht (z.B. "Flur", "Bad", "Küche")
 */
export async function calculateObjectQuantities(object) {
  // Schritt 3: Deckenfläche
  const ceilingArea = calculateCeilingArea(object.floorArea);

  // Schritt 4: Umfang
  const perimeter = calculatePerimeter(object.floorArea);

  // Schritt 5: Faktoren anwenden
  // KORRIGIERT: Suche nach Faktor mit passendem NAME (nicht objectType)
  const factor = await databaseService.getFactorByName(object.type);

  // Mengen-Faktor (für Umfang): z.B. Flur hat längere Wände
  let quantityFactor = 1;
  if (factor && factor.category === 'Mengen') {
    quantityFactor = factor.factor || 1;
    console.log(`📐 Mengen-Faktor "${factor.name}": ${quantityFactor}x (für Umfang)`);
  }

  // Leistungs-Faktor (für Zeit): z.B. Bad ist aufwendiger
  let serviceFactor = 1;
  if (factor && factor.category === 'Leistung') {
    serviceFactor = factor.factor || 1;
    console.log(`⏱️ Leistungs-Faktor "${factor.name}": ${serviceFactor}x (für Zeit)`);
  }

  // Prüfe auch auf zusätzliche Leistungs-Faktoren (einige Raumtypen haben beides)
  // z.B. könnte "Bad" sowohl Mengen- als auch Leistungs-Faktor haben
  const allFactors = await databaseService.getAllFactors();
  const matchingFactors = allFactors.filter(f => f.name === object.type);

  for (const f of matchingFactors) {
    if (f.category === 'Mengen' && f.factor) {
      quantityFactor = Math.max(quantityFactor, f.factor);
    }
    if (f.category === 'Leistung' && f.factor) {
      serviceFactor = Math.max(serviceFactor, f.factor);
    }
  }

  // Raumform-Faktor (L-förmig = +40% nur auf Wandfläche, nicht auf Umfang)
  const roomShapeFactor = object.roomShapeFactor || 1;
  if (roomShapeFactor !== 1) {
    console.log(`📐 Raumform-Faktor: ${roomShapeFactor}x (nur für Wandfläche)`);
  }

  // Umfang: nur mit Raumtyp-Faktor (quantityFactor), NICHT mit Raumform-Faktor
  const adjustedPerimeter = perimeter * quantityFactor;

  // Wandfläche: mit beiden Faktoren (Raumtyp + Raumform)
  const wallAreaFactor = quantityFactor * roomShapeFactor;
  const wallArea = calculateWallAreaWithFactor(perimeter, object.height, wallAreaFactor);

  const result = {
    ceilingArea,
    perimeter: adjustedPerimeter, // Nur Raumtyp-Faktor, kein Raumform-Faktor
    wallArea,
    quantityFactor: quantityFactor, // Nur Raumtyp-Faktor
    wallAreaFactor: wallAreaFactor, // Kombiniert für Wandfläche
    serviceFactor,
    roomShapeFactor,
    // Zusätzliche Transparenz
    appliedFactors: {
      roomTypeFactor: quantityFactor !== 1 ? { name: object.type, factor: quantityFactor, category: 'Mengen' } : null,
      roomShapeFactor: roomShapeFactor !== 1 ? { name: object.roomShape, factor: roomShapeFactor } : null,
      serviceTimeFactor: serviceFactor !== 1 ? { name: object.type, factor: serviceFactor, category: 'Leistung' } : null
    }
  };

  console.log(`📊 Objekt "${object.name}" (${object.type}): Decke ${ceilingArea.toFixed(1)}m², Wände ${wallArea.toFixed(1)}m², Umfang-Faktor: ${quantityFactor}, Zeit-Faktor: ${serviceFactor}`);

  return result;
}
