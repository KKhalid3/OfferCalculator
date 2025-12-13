export const HOURS_PER_DAY = 8;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;

export const OBJECT_TYPES = [
  'Wohnzimmer',
  'Flur',
  'Bad',
  'Treppenhaus',
  'Küche',
  'Schlafzimmer',
  'Büro',
  'Andere'
];

export const ROOM_SHAPES = [
  { id: 'standard', name: 'Standard (rechteckig)', factor: 1.0 },
  { id: 'l_shape', name: 'L-förmig', factor: 1.4 }
];

// Fenstergrößen für Stück-basierte Kalkulation
export const WINDOW_SIZES = [
  { id: 'klein', name: 'Klein (≤ 1 m²)', maxArea: 1, timeFactor: 0.67 },
  { id: 'mittel', name: 'Mittel (≤ 1,5 m²)', maxArea: 1.5, timeFactor: 1.0 },
  { id: 'gross', name: 'Groß (≤ 2 m²)', maxArea: 2, timeFactor: 1.33 }
];

// Türtypen für Stück-basierte Kalkulation
export const DOOR_TYPES = [
  { id: 'zimmertuer', name: 'Zimmertür', timeFactor: 1.0 },
  { id: 'haustuer', name: 'Haustür', timeFactor: 1.5 },
  { id: 'badtuer', name: 'Badtür', timeFactor: 1.0 },
  { id: 'kellertuer', name: 'Kellertür', timeFactor: 1.2 }
];

// Türgrößen für Stück-basierte Kalkulation
export const DOOR_SIZES = [
  { id: 'einfach', name: 'Einfach (Standard)', sizeFactor: 1.0 },
  { id: 'doppel', name: 'Doppelflügelig', sizeFactor: 1.8 }
];

// Objektkategorien für unterschiedliche Eingabeformulare
export const OBJECT_CATEGORIES = [
  { id: 'raum', name: 'Raum', icon: '🏠' },
  { id: 'fenster', name: 'Fenster', icon: '🪟' },
  { id: 'tuer', name: 'Tür', icon: '🚪' }
];

export const SERVICE_TYPES = {
  SHOP_TITLE: 'Shop Titel Leistung',
  SHOP_SERVICE: 'Shop Leistung',
  SUB_SERVICE: 'Unterleistung Backend'
};

export const UNITS = {
  SQUARE_METER: 'm²',
  PIECE: 'Stk',
  HOUR: 'h'
};

