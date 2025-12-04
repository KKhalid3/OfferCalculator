export const specialServiceSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    affectsArea: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // ['Decken', 'Wände', 'Fenster innen', 'Türen']
    requiredService: { type: ['string', 'null'] }, // Benötigte Zusatzleistung (Service-ID) - kann null sein
    affectsService: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Auswirkung Leistung (Array von Service-IDs)
    category: { type: ['string', 'null'] }, // 'Leistung'
    objectType: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // ['Raum', 'Fenster', 'Türen']
    inputType: { type: ['string', 'null'] }, // 'Leistungsspezifikation', 'Objektverwaltung'
    source: { type: ['string', 'null'] }, // 'Onboarding'
    uxDescription: { type: ['string', 'null'] },
    factor: { type: ['number', 'null'] }, // Faktor für Zeitmultiplikation
    
    // Onboarding-Status
    onboardingCompleted: { type: ['boolean', 'null'] }, // Ob Sonderangabe konfiguriert wurde
    
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'title'],
  indexes: ['affectsService', 'objectType']
};

