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
  
  // Schritt 6: Wandfläche mit Faktor
  const wallArea = calculateWallAreaWithFactor(perimeter, object.height, quantityFactor);
  
  return {
    ceilingArea,
    perimeter: perimeter * quantityFactor, // Angepasster Umfang
    wallArea,
    quantityFactor,
    serviceFactor
  };
}

