import { getDatabase } from '../database/database';
import { map } from 'rxjs/operators';
import { initialData } from '../data/initialData';

export const databaseService = {
  // ========== SERVICES ==========
  async getAllServices() {
    try {
      const db = getDatabase();
      console.log('getAllServices: Datenbank verfügbar, Collections:', Object.keys(db.collections));

      // Prüfen ob Collection existiert
      if (!db.collections.services) {
        console.error('Services Collection nicht gefunden!');
        return [];
      }

      const collection = db.collections.services;

      // Prüfe count() direkt
      const count = await collection.count().exec();
      console.log('getAllServices: count() =', count);

      // Versuche verschiedene Query-Methoden
      // Methode 1: find() ohne Filter
      let docs = await collection.find().exec();
      console.log('getAllServices: find() ohne Filter =', docs.length, 'Dokumente');

      // Methode 2: find() mit explizitem Selector (alle nicht gelöschten)
      if (docs.length === 0) {
        docs = await collection.find({
          selector: {
            _deleted: { $ne: true }
          }
        }).exec();
        console.log('getAllServices: find() mit _deleted Filter =', docs.length, 'Dokumente');
      }

      // Methode 3: find() ohne _deleted Check (alle, auch gelöschte)
      if (docs.length === 0) {
        docs = await collection.find({
          selector: {}
        }).exec();
        console.log('getAllServices: find() mit leerem Selector =', docs.length, 'Dokumente');
      }

      // Methode 4: Da find() nicht funktioniert, aber findOne() funktioniert,
      // lade alle Services über findOne() mit bekannten IDs
      if (docs.length === 0 || docs.length < 30) {
        console.log(`getAllServices: find() findet nur ${docs.length} Services, versuche alle Services über findOne()...`);

        // Verwende die Service-IDs aus initialData
        const knownServiceIds = initialData.services?.map(s => s.id) || [];
        console.log(`getAllServices: Versuche ${knownServiceIds.length} bekannte Service-IDs zu laden...`);

        const foundDocs = [];
        for (const id of knownServiceIds) {
          try {
            const doc = await collection.findOne(id).exec();
            if (doc && !doc._deleted) {
              foundDocs.push(doc);
            }
          } catch (err) {
            // Ignoriere Fehler bei einzelnen IDs
            console.debug(`getAllServices: Service ${id} nicht gefunden:`, err.message);
          }
        }

        if (foundDocs.length > docs.length) {
          docs = foundDocs;
          console.log(`getAllServices: Gefunden über findOne(): ${docs.length} von ${knownServiceIds.length} Services`);
        } else if (foundDocs.length > 0) {
          console.log(`getAllServices: findOne() hat ${foundDocs.length} Services gefunden, verwende diese`);
          docs = foundDocs;
        } else {
          console.warn('getAllServices: Auch findOne() findet keine Services!');
        }
      }

      // Methode 5: Verwende RxDB's getAll() wenn verfügbar
      if (docs.length === 0 && collection.getAll) {
        try {
          const allDocs = await collection.getAll();
          console.log('getAllServices: getAll() =', allDocs.length);
          docs = allDocs;
        } catch (getAllError) {
          console.log('getAllServices: getAll() nicht verfügbar oder Fehler:', getAllError.message);
        }
      }

      const services = docs.map(doc => {
        const json = doc.toJSON();
        // Entferne RxDB interne Felder
        delete json._meta;
        delete json._rev;
        delete json._attachments;
        return json;
      });

      console.log('getAllServices: Konvertiert zu JSON:', services.length, 'Services');
      if (services.length > 0) {
        console.log('Erste Service:', services[0]);
      }
      return services;
    } catch (error) {
      console.error('Fehler beim Laden der Services:', error);
      console.error('Error Stack:', error.stack);
      throw error;
    }
  },

  async getServiceById(id) {
    const db = getDatabase();
    const doc = await db.collections.services.findOne(id).exec();
    return doc ? doc.toJSON() : null;
  },

  async getServicesByType(type) {
    const db = getDatabase();
    const docs = await db.collections.services
      .find({ selector: { serviceType: type } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async getSubServices(parentId) {
    const db = getDatabase();
    const docs = await db.collections.services
      .find({ selector: { parentServiceId: parentId } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async getServicesByIncludedIn(serviceId) {
    const db = getDatabase();
    const docs = await db.collections.services
      .find({ selector: { includedIn: { $in: [serviceId] } } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  // Aktualisiert alle Konfigurationswerte einer Leistung
  async updateServiceConfig(serviceId, config) {
    try {
      const db = getDatabase();
      const doc = await db.collections.services.findOne(serviceId).exec();
      if (!doc) {
        console.error(`updateServiceConfig: Service ${serviceId} nicht gefunden`);
        return null;
      }

      // WICHTIG: serviceType aus dem Original-Dokument bewahren!
      const originalData = doc.toJSON();
      const originalServiceType = originalData.serviceType;

      if (!originalServiceType) {
        console.error(`❌ KRITISCH: Service ${serviceId} hat keinen serviceType! Original:`, originalData);
      }

      // Entferne serviceType aus config falls vorhanden (um Überschreibung zu verhindern)
      const { serviceType: _ignored, ...safeConfig } = config;

      // Update durchführen - serviceType wird NICHT geändert
      await doc.update({
        $set: {
          ...safeConfig,
          // serviceType explizit NICHT ändern - bewahre immer das Original!
          updatedAt: Date.now()
        }
      });

      // Dokument neu laden
      const updated = await db.collections.services.findOne(serviceId).exec();
      const result = updated ? updated.toJSON() : null;

      if (!result) {
        console.error(`❌ Service ${serviceId} konnte nach Update nicht geladen werden`);
        return null;
      }

      // KRITISCH: serviceType MUSS erhalten bleiben - setze es explizit zurück falls nötig
      if (result.serviceType !== originalServiceType) {
        console.warn(`⚠️ serviceType wurde geändert! Original: ${originalServiceType}, Neu: ${result.serviceType} - setze zurück`);
        result.serviceType = originalServiceType; // Wiederherstellen

        // Optional: Korrigiere auch in der DB (aber das sollte nicht nötig sein)
        try {
          await updated.update({
            $set: {
              serviceType: originalServiceType
            }
          });
          console.log(`✅ serviceType in DB korrigiert für ${serviceId}`);
        } catch (dbError) {
          console.warn(`⚠️ Konnte serviceType in DB nicht korrigieren:`, dbError);
        }
      }

      console.log(`✅ Service ${serviceId} aktualisiert (serviceType: ${result.serviceType})`);
      return result;
    } catch (error) {
      console.error(`updateServiceConfig Fehler für ${serviceId}:`, error);
      throw error;
    }
  },

  // Observable für React
  observeServices() {
    const db = getDatabase();
    return db.collections.services.find().$.pipe(
      map(docs => docs.map(doc => doc.toJSON()))
    );
  },

  // ========== OBJECTS ==========
  async getAllObjects() {
    const db = getDatabase();
    const docs = await db.collections.objects.find().exec();
    return docs.map(doc => doc.toJSON());
  },

  async getObjectById(id) {
    const db = getDatabase();
    const doc = await db.collections.objects.findOne(id).exec();
    return doc ? doc.toJSON() : null;
  },

  async createObject(objectData) {
    const db = getDatabase();
    const doc = await db.collections.objects.insert({
      ...objectData,
      id: objectData.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return doc.toJSON();
  },

  async updateObject(id, updates) {
    try {
      const db = getDatabase();
      const doc = await db.collections.objects.findOne(id).exec();
      if (!doc) {
        console.error(`updateObject: Object with id ${id} not found`);
        return null;
      }

      console.log('updateObject: Vor Update:', doc.toJSON());
      console.log('updateObject: Updates:', updates);

      // RxDB Update-Plugin erwartet $set Operator
      await doc.update({
        $set: {
          ...updates,
          updatedAt: Date.now()
        }
      });

      console.log('updateObject: Nach doc.update():', doc.toJSON());

      // Nach dem Update: Dokument neu laden, um aktuelle Werte zu erhalten
      const updatedDoc = await db.collections.objects.findOne(id).exec();
      const updated = updatedDoc ? updatedDoc.toJSON() : doc.toJSON();

      console.log('updateObject: Nach Reload:', updated);

      // Fallback: Wenn das Update nicht funktioniert hat, manuell mergen
      if (updates.services && updated.services?.length === 0 && updates.services.length > 0) {
        console.warn('updateObject: Update hat nicht funktioniert, verwende manuelles Merge');
        return { ...updated, ...updates, updatedAt: Date.now() };
      }

      return updated;
    } catch (error) {
      console.error('updateObject Fehler:', error);
      throw error;
    }
  },

  async deleteObject(id) {
    const db = getDatabase();
    const doc = await db.collections.objects.findOne(id).exec();
    if (doc) {
      await doc.remove();
      return true;
    }
    return false;
  },

  observeObjects() {
    const db = getDatabase();
    return db.collections.objects.find().$.pipe(
      map(docs => docs.map(doc => doc.toJSON()))
    );
  },

  // ========== FACTORS ==========
  async getAllFactors() {
    const db = getDatabase();
    const docs = await db.collections.factors.find().exec();
    return docs.map(doc => doc.toJSON());
  },

  async getFactorsByObjectType(objectType) {
    const db = getDatabase();
    const docs = await db.collections.factors
      .find({ selector: { objectType } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async getFactorByName(name) {
    const db = getDatabase();
    const doc = await db.collections.factors
      .findOne({ selector: { name } })
      .exec();
    return doc ? doc.toJSON() : null;
  },

  // ========== SPECIAL SERVICES ==========
  async getAllSpecialServices() {
    try {
      const db = getDatabase();
      console.log('getAllSpecialServices: Start');

      if (!db.collections.specialServices) {
        console.error('getAllSpecialServices: Collection nicht gefunden!');
        return [];
      }

      const count = await db.collections.specialServices.count().exec();
      console.log('getAllSpecialServices: count() =', count);

      let docs = await db.collections.specialServices.find().exec();
      console.log('getAllSpecialServices: find() =', docs.length, 'Dokumente');

      // Fallback: Verwende bekannte IDs aus initialData (wie bei getAllServices)
      // WICHTIG: Auch wenn count() 0 zurückgibt, können Dokumente existieren (RxDB-Bug)
      if (docs.length === 0) {
        console.log('getAllSpecialServices: find() leer, versuche findOne() Fallback...');
        const knownIds = initialData.specialServices?.map(s => s.id) || [];
        const foundDocs = [];
        for (const id of knownIds) {
          try {
            const doc = await db.collections.specialServices.findOne(id).exec();
            if (doc) foundDocs.push(doc);
          } catch (err) {
            // Ignoriere Fehler bei einzelnen IDs
          }
        }
        docs = foundDocs;
        console.log('getAllSpecialServices: findOne() Fallback =', docs.length, 'von', knownIds.length);
      }

      const result = docs.map(doc => doc.toJSON());
      console.log('getAllSpecialServices: Ergebnis =', result.length, 'Special Services');
      if (result.length > 0) {
        console.log('Erste SpecialService:', result[0]);
      }
      return result;
    } catch (error) {
      console.error('getAllSpecialServices Fehler:', error);
      return [];
    }
  },

  async getSpecialServicesByService(serviceId) {
    const db = getDatabase();
    const docs = await db.collections.specialServices
      .find({ selector: { affectsService: { $in: [serviceId] } } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async getSpecialServiceById(id) {
    const db = getDatabase();
    const doc = await db.collections.specialServices.findOne(id).exec();
    return doc ? doc.toJSON() : null;
  },

  // Aktualisiert die Konfiguration einer Sonderangabe
  async updateSpecialNoteConfig(specialNoteId, config) {
    try {
      const db = getDatabase();
      const doc = await db.collections.specialServices.findOne(specialNoteId).exec();
      if (!doc) {
        console.error(`updateSpecialNoteConfig: SpecialNote ${specialNoteId} nicht gefunden`);
        return null;
      }

      await doc.update({
        $set: {
          ...config,
          updatedAt: Date.now()
        }
      });

      const updated = await db.collections.specialServices.findOne(specialNoteId).exec();
      console.log(`✅ SpecialNote ${specialNoteId} Konfiguration aktualisiert`);
      return updated ? updated.toJSON() : null;
    } catch (error) {
      console.error(`updateSpecialNoteConfig Fehler für ${specialNoteId}:`, error);
      throw error;
    }
  },

  // ========== CALCULATIONS ==========
  async saveCalculation(calculationData) {
    const db = getDatabase();
    const doc = await db.collections.calculations.insert({
      ...calculationData,
      id: calculationData.id || `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    });
    return doc.toJSON();
  },

  async getCalculationsByObject(objectId) {
    const db = getDatabase();
    const docs = await db.collections.calculations
      .find({ selector: { objectId } })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async getCalculationById(id) {
    const db = getDatabase();
    const doc = await db.collections.calculations.findOne(id).exec();
    return doc ? doc.toJSON() : null;
  },

  async updateCalculation(id, updates) {
    try {
      const db = getDatabase();
      const doc = await db.collections.calculations.findOne(id).exec();
      if (!doc) {
        console.error(`updateCalculation: Calculation with id ${id} not found`);
        return null;
      }

      await doc.update({
        $set: {
          ...updates,
          updatedAt: Date.now()
        }
      });

      const updated = await db.collections.calculations.findOne(id).exec();
      return updated ? updated.toJSON() : null;
    } catch (error) {
      console.error('updateCalculation Fehler:', error);
      throw error;
    }
  },

  async deleteCalculationsByObject(objectId) {
    try {
      const db = getDatabase();
      // Versuche alle Berechnungen für dieses Objekt zu finden
      // Verwende findOne() für jede mögliche ID oder find() mit besserer Fehlerbehandlung
      const docs = await db.collections.calculations
        .find({ selector: { objectId, _deleted: { $ne: true } } })
        .exec();

      // Lösche nur nicht-gelöschte Dokumente
      const deletePromises = docs
        .filter(doc => !doc._deleted)
        .map(doc => {
          return doc.remove().catch(err => {
            // Ignoriere Fehler bei bereits gelöschten Dokumenten
            if (err.status === 409 || err.message?.includes('CONFLICT')) {
              console.log(`Berechnung ${doc.id} bereits gelöscht, überspringe`);
              return null;
            }
            console.error(`Fehler beim Löschen von Berechnung ${doc.id}:`, err);
            throw err;
          });
        });

      await Promise.all(deletePromises);
    } catch (error) {
      // Bei Fehler: Versuche alle Berechnungen zu finden und einzeln zu löschen
      console.warn('deleteCalculationsByObject Fehler, versuche alternative Methode:', error.message);
      try {
        const db = getDatabase();
        // Alternative: Finde alle IDs und lösche einzeln
        const allDocs = await db.collections.calculations.find().exec();
        const relevantDocs = allDocs.filter(doc => {
          const json = doc.toJSON();
          return json.objectId === objectId && !json._deleted;
        });

        for (const doc of relevantDocs) {
          try {
            await doc.remove();
          } catch (removeError) {
            // Ignoriere Konflikte
            if (removeError.status !== 409) {
              console.error(`Fehler beim Löschen:`, removeError);
            }
          }
        }
      } catch (altError) {
        console.error('Alternative Löschmethode fehlgeschlagen:', altError);
        // Nicht werfen, damit die Berechnung fortgesetzt werden kann
      }
    }
  },

  // ========== WORKFLOWS ==========
  async saveWorkflow(workflowData) {
    const db = getDatabase();
    const doc = await db.collections.workflows.insert({
      ...workflowData,
      id: workflowData.id || `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    });
    return doc.toJSON();
  },

  async getAllWorkflows() {
    const db = getDatabase();
    const docs = await db.collections.workflows
      .find()
      .sort({ day: 'asc' })
      .exec();
    return docs.map(doc => doc.toJSON());
  },

  async deleteAllWorkflows() {
    try {
      const db = getDatabase();
      const docs = await db.collections.workflows.find().exec();

      // Lösche nur nicht-gelöschte Dokumente mit Fehlerbehandlung
      const deletePromises = docs
        .filter(doc => !doc._deleted)
        .map(doc => {
          return doc.remove().catch(err => {
            // Ignoriere CONFLICT-Fehler bei bereits gelöschten Dokumenten
            if (err.status === 409 || err.message?.includes('CONFLICT')) {
              console.log(`Workflow ${doc.id} bereits gelöscht, überspringe`);
              return null;
            }
            throw err;
          });
        });

      await Promise.all(deletePromises);
    } catch (error) {
      console.warn('deleteAllWorkflows Fehler:', error.message);
      // Nicht werfen, damit die Berechnung fortgesetzt werden kann
    }
  },

  // ========== COMPANY SETTINGS ==========
  async getCompanySettings() {
    try {
      const db = getDatabase();
      const doc = await db.collections.companySettings.findOne('company_settings').exec();
      return doc ? doc.toJSON() : null;
    } catch (error) {
      console.error('Fehler beim Laden der Company Settings:', error);
      return null;
    }
  },

  async saveCompanySettings(settings) {
    try {
      const db = getDatabase();
      const existing = await db.collections.companySettings.findOne('company_settings').exec();

      const settingsWithTimestamp = {
        ...settings,
        id: 'company_settings',
        updatedAt: Date.now(),
        createdAt: existing ? existing.createdAt : Date.now(),
      };

      if (existing) {
        await existing.update({
          $set: settingsWithTimestamp
        });
        const updated = await db.collections.companySettings.findOne('company_settings').exec();
        return updated ? updated.toJSON() : settingsWithTimestamp;
      } else {
        await db.collections.companySettings.insert(settingsWithTimestamp);
        return settingsWithTimestamp;
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Company Settings:', error);
      throw error;
    }
  },

  // ========== SERVICE MATERIAL ==========
  async updateServiceMaterial(serviceId, materialType, materialValue) {
    try {
      const db = getDatabase();
      const doc = await db.collections.services.findOne(serviceId).exec();

      if (!doc) {
        console.error(`Service ${serviceId} nicht gefunden`);
        return null;
      }

      await doc.update({
        $set: {
          materialType,
          materialValue,
          materialOnboardingCompleted: true,
          updatedAt: Date.now()
        }
      });

      const updated = await db.collections.services.findOne(serviceId).exec();
      return updated ? updated.toJSON() : null;
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Service-Materials:', error);
      throw error;
    }
  }
};

