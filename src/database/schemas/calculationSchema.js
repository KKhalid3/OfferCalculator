export const calculationSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    objectId: { type: 'string' },
    serviceId: { type: 'string' },
    quantity: { type: 'number' }, // Berechnete Menge
    quantityType: { type: 'string' }, // 'ceiling', 'walls', 'perimeter'
    baseTime: { type: 'number' }, // Baseline-Zeit in Minuten
    efficiency: { type: 'number' }, // Effizienzfaktor
    finalTime: { type: 'number' }, // Finale Zeit in Minuten
    // Preisfelder (neu)
    laborCost: { type: ['number', 'null'] }, // Lohnkosten in €
    materialCost: { type: ['number', 'null'] }, // Materialkosten in €
    totalCost: { type: ['number', 'null'] }, // Gesamtkosten in €
    factors: { type: 'object' }, // Angewandte Faktoren { quantityFactor, serviceFactor }
    specialNotes: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Array von SpecialService-IDs
    createdAt: { type: 'number' }
  },
  required: ['id', 'objectId', 'serviceId'],
  indexes: ['objectId', 'serviceId']
};

