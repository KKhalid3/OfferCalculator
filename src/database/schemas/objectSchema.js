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
    // Fenster-spezifische Felder
    hasSprossen: { type: 'boolean' }, // Sprossenfenster ja/nein (Faktor 2.5)
    // Tür-spezifische Felder
    hasKassette: { type: 'boolean' }, // Kassettentür ja/nein (Faktor 1.5)
    // Zuordnung zu Raum
    assignedToRoomId: { type: 'string' }, // ID des zugeordneten Raums (optional)
    // Raumform-Felder
    roomShape: { type: 'string' }, // 'standard', 'schlauch', 'l_shape'
    roomShapeFactor: { type: 'number' }, // Faktor für Umfang (1.0, 1.2, 1.4)
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' }
  },
  required: ['id', 'name', 'type', 'floorArea', 'height'],
  indexes: ['type', 'assignedToRoomId']
};

