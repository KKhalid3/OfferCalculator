export const objectSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    type: { type: 'string' }, // 'Wohnzimmer', 'Flur', 'Bad', 'Treppenhaus', 'Küche'
    floorArea: { type: 'number' }, // Grundfläche in m²
    height: { type: 'number' }, // Raumhöhe in m
    services: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Array von Service-IDs
    specialNotes: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Array von SpecialService-IDs
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'name', 'type', 'floorArea', 'height'],
  indexes: ['type']
};

