export const workflowSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    day: { type: 'number' },
    hours: { type: 'number' },
    employees: { type: 'number' },
    calculationIds: { 
      type: 'array', 
      items: { type: 'string' } 
    }, // Array von Calculation-IDs
    waitTimes: { 
      type: 'array', 
      items: { type: 'object' } 
    }, // [{ serviceId, startTime, duration }]
    parallelWork: { 
      type: 'array', 
      items: { type: 'object' } 
    }, // [{ serviceId1, serviceId2, objectId }]
    createdAt: { type: 'number' }
  },
  required: ['id', 'day'],
  indexes: ['day']
};

