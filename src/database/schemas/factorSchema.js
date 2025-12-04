export const factorSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' }, // Faktorname (z.B. 'Flur', 'Bad', 'Sprossenfenster')
    factor: { type: 'number' },
    affectsArea: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // ['Umfang', 'Decken', 'Wände', 'Fenster innen', 'Fenster außen']
    affectsService: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Auswirkung Leistung (Array von Service-IDs)
    category: { type: 'string' }, // 'Mengen', 'Leistung'
    objectType: { type: 'string' }, // 'Raum', 'Fenster', 'Türen'
    inputType: { type: 'string' }, // 'Objektverwaltung'
    source: { type: 'string' }, // 'Admin SE', 'Kunde Shop'
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'name', 'factor', 'objectType'],
  indexes: ['objectType', 'category', 'name']
};

