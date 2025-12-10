import { calculateCeilingArea, calculatePerimeter, calculateWallAreaWithFactor } from '../utils/formulas';
import { databaseService } from './databaseService';

/**
 * Berechnet alle Mengen für ein Objekt
 * Schritt 3, 4, 5, 6
 */
export async function calculateObjectQuantities(object) {
  // Schritt 3: Deckenfläche
  const ceilingArea = calculateCeilingArea(object.floorArea);
  
  // Schritt 4: Umfang
  const perimeter = calculatePerimeter(object.floorArea);
  
  // Schritt 5: Faktoren anwenden
  const factors = await databaseService.getFactorsByObjectType(object.type);
  const quantityFactor = factors.find(f => f.category === 'Mengen')?.factor || 1;
  const serviceFactor = factors.find(f => f.category === 'Leistung')?.factor || 1;
  
  // Raumform-Faktor (L-förmig = 1.4x mehr Umfang bei gleicher Grundfläche)
  const roomShapeFactor = object.roomShapeFactor || 1;
  
  // Kombinierter Umfang-Faktor (Raumtyp + Raumform)
  const combinedQuantityFactor = quantityFactor * roomShapeFactor;
  
  // Schritt 6: Wandfläche mit Faktor
  const wallArea = calculateWallAreaWithFactor(perimeter, object.height, combinedQuantityFactor);
  
  return {
    ceilingArea,
    perimeter: perimeter * combinedQuantityFactor, // Angepasster Umfang
    wallArea,
    quantityFactor: combinedQuantityFactor,
    serviceFactor,
    roomShapeFactor
  };
}

