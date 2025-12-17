export const objectSchema = {
  version: 1, // Version erhöht: floorArea und height sind jetzt optional
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    type: { type: 'string' }, // 'Wohnzimmer', 'Flur', 'Bad', 'Treppenhaus', 'Küche', 'Fenster', 'Tür'
    // Objektkategorie (wichtig für Filterung)
    objectCategory: { type: 'string' }, // 'raum', 'fenster', 'tuer'
    // Raum-spezifische Felder (optional, nur für Räume)
    floorArea: { type: 'number' }, // Grundfläche in m²
    height: { type: 'number' }, // Raumhöhe in m
    roomShape: { type: 'string' }, // 'standard', 'schlauch', 'l_shape'
    roomShapeFactor: { type: 'number' }, // Faktor für Umfang (1.0, 1.2, 1.4)
    // Fenster-spezifische Felder (optional, nur für Fenster)
    hasSprossen: { type: 'boolean' }, // Sprossenfenster ja/nein (Faktor 2.5)
    windowSize: { type: 'string' }, // Fenstergröße ID
    windowSizeLabel: { type: 'string' }, // Fenstergröße Label
    windowMaxArea: { type: 'number' }, // Maximale Fläche für Fenstergröße
    windowCount: { type: 'number' }, // Anzahl Fenster
    windowLocation: { type: 'string' }, // 'innen', 'aussen', 'beide'
    // Tür-spezifische Felder (optional, nur für Türen)
    hasKassette: { type: 'boolean' }, // Kassettentür ja/nein (Faktor 1.5)
    doorSize: { type: 'string' }, // Türgröße ID
    doorSizeLabel: { type: 'string' }, // Türgröße Label
    doorSizeFactor: { type: 'number' }, // Faktor für Türgröße
    doorCount: { type: 'number' }, // Anzahl Türen
    // Zuordnung zu Raum (optional, für Fenster/Türen)
    assignedToRoomId: { type: 'string' }, // ID des zugeordneten Raums
    // Einheit (optional, für Fenster/Türen)
    unit: { type: 'string' }, // Einheit (z.B. 'Stk' für Fenster/Türen)
    // Allgemeine Felder
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
  // WICHTIG: Nur Felder, die ALLE Objekttypen haben müssen
  required: ['id', 'name', 'type'],
  indexes: ['type', 'assignedToRoomId', 'objectCategory']
};

