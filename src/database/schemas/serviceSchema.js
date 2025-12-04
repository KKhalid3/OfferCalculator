export const serviceSchema = {
  version: 0, // Version bleibt 0, neue DB wird mit neuem Namen erstellt
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    parentServiceId: { type: ['string', 'null'] }, // Übergeordnete Leistung - erlaube null
    serviceType: { type: 'string' }, // 'Shop Titel Leistung', 'Shop Leistung', 'Unterleistung Backend'
    variant: { type: ['string', 'null'] }, // Leistung / Variante - erlaube null
    includedIn: {
      type: 'array',
      items: { type: 'string' }
    }, // In Leistung enthalten (Array von Service-IDs)
    unit: { type: 'string' }, // Einheit: m², Stk, h
    maxProductivityPerDay: { type: ['number', 'null'] }, // Grenzeffektivität max Einheitsmengen am Tag - erlaube null
    standardQuantity: { type: ['number', 'null'] }, // Menge Standardfall - erlaube null
    standardTime: { type: ['number', 'null'] }, // Referenzzeit Standardfall (in Minuten) - erlaube null
    standardValuePerUnit: { type: ['number', 'null'] }, // Standartwert je Einheit in Min - erlaube null
    formula: { type: ['string', 'null'] }, // Herleitung (min/Einheit & Formel) Standardfall - erlaube null
    materialStandard: { type: ['string', 'null'] }, // Material (Standard) - erlaube null
    waitTime: { type: ['number', 'null'] }, // Wartezeit (in Minuten) - erlaube null
    minTime: { type: ['number', 'null'] }, // Mindestzeit (in Minuten) - erlaube null
    efficiencyStart: { type: ['number', 'null'] }, // Effizienzsteigerung ab (Menge) - erlaube null
    efficiencyCap: { type: ['number', 'null'] }, // Deckel (max Menge) - erlaube null
    efficiencyStepPercent: { type: ['number', 'null'] }, // Schrittweite für Effizienz (%) - erlaube null

    // Material-Kalkulation (für Preisberechnung)
    materialType: { type: ['string', 'null'] }, // 'percent', 'fixed', oder 'none'
    materialValue: { type: ['number', 'null'] }, // % oder €/Einheit
    materialOnboardingCompleted: { type: ['boolean', 'null'] }, // Ob Material-Onboarding abgeschlossen

    // Unterleistungen (welche Unterleistungen sind automatisch enthalten)
    includedSubServices: {
      type: 'array',
      items: { type: 'string' }
    },

    // Onboarding-Status
    configOnboardingCompleted: { type: ['boolean', 'null'] }, // Ob Hauptleistungs-Konfiguration abgeschlossen
    subServiceConfigOnboardingCompleted: { type: ['boolean', 'null'] }, // Ob Unterleistungs-Konfiguration abgeschlossen

    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'title', 'serviceType', 'unit'],
  indexes: ['parentServiceId', 'serviceType', 'includedIn']
};

