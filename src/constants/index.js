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

