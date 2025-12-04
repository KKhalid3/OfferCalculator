import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';

// Schemas importieren
import { serviceSchema } from './schemas/serviceSchema';
import { specialServiceSchema } from './schemas/specialServiceSchema';
import { factorSchema } from './schemas/factorSchema';
import { objectSchema } from './schemas/objectSchema';
import { calculationSchema } from './schemas/calculationSchema';
import { workflowSchema } from './schemas/workflowSchema';
import { companySettingsSchema } from './schemas/companySettingsSchema';

let dbInstance = null;

// RxDB Plugins registrieren
addRxPlugin(RxDBUpdatePlugin);

export async function initDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const db = await createRxDatabase({
      name: 'offercalculator_v6_sub_services', // Neue DB mit Unterleistungen-Onboarding
      storage: getRxStorageDexie(),
      ignoreDuplicate: true,
    });

    // Collections hinzufügen
    await db.addCollections({
      services: {
        schema: serviceSchema
      },
      specialServices: {
        schema: specialServiceSchema
      },
      factors: {
        schema: factorSchema
      },
      objects: {
        schema: objectSchema
      },
      calculations: {
        schema: calculationSchema
      },
      workflows: {
        schema: workflowSchema
      },
      companySettings: {
        schema: companySettingsSchema
      }
    });

    dbInstance = db;
    console.log('✅ RxDB initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Error initializing RxDB:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!dbInstance) {
    console.error('Database not initialized. Call initDatabase() first.');
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function isDatabaseReady() {
  return dbInstance !== null;
}

export async function resetDatabase() {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}

