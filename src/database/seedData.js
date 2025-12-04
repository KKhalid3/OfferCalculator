import { getDatabase } from './database';

export async function seedServices(db, servicesData) {
  const collection = db.collections.services;
  
  // Prüfen ob bereits Daten vorhanden
  const existing = await collection.count().exec();
  if (existing > 0) {
    console.log(`Services bereits vorhanden (${existing}), lösche alte Daten...`);
    // Alle vorhandenen Services löschen, um Konflikte zu vermeiden
    await collection.find().remove();
    console.log('Alte Services gelöscht');
  }
  
  console.log('Seeding', servicesData.length, 'Services...');
  
  // Bulk-Insert mit Error-Handling
  try {
    const docs = servicesData.map(service => {
      const doc = {
        ...service,
        // Sicherstellen, dass alle Felder korrekt sind
        parentServiceId: service.parentServiceId || '',
        serviceType: service.serviceType || '',
        variant: service.variant || '',
        includedIn: service.includedIn || [],
        unit: service.unit || '',
        formula: service.formula || '',
        materialStandard: service.materialStandard || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Sicherstellen, dass Arrays nicht null sind
      if (!Array.isArray(doc.includedIn)) {
        doc.includedIn = [];
      }
      
      return doc;
    });
    
    console.log('Erstes Service-Dokument:', JSON.stringify(docs[0], null, 2));
    
    // Verwende einzelnes insert statt upsert - wir haben ja vorher gelöscht
    // upsert scheint nicht zu funktionieren, daher verwenden wir insert
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of docs) {
      try {
        // Prüfe ob Dokument bereits existiert (sollte nicht, da wir gelöscht haben)
        const existing = await collection.findOne(doc.id).exec();
        if (existing) {
          console.log(`Dokument ${doc.id} existiert bereits, überspringe`);
          successCount++;
          continue;
        }
        
        // Erstelle neues Dokument
        await collection.insert(doc);
        successCount++;
        
        // Debug: Prüfe nach jedem 10. Insert
        if (successCount % 10 === 0) {
          const currentCount = await collection.count().exec();
          console.log(`Fortschritt: ${successCount}/${docs.length} eingefügt, ${currentCount} in DB`);
        }
      } catch (insertError) {
        errorCount++;
        console.error(`Fehler beim Insert von ${doc.id}:`, insertError.message);
        if (errorCount <= 3) {
          console.error('Vollständiger Fehler:', insertError);
        }
      }
    }
    
    console.log(`✅ ${successCount} von ${docs.length} Services eingefügt (${errorCount} Fehler)`);
    
    // Warte kurz, damit RxDB die Daten committed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Prüfen ob wirklich gespeichert
    const count = await collection.count().exec();
    console.log(`✅ ${count} Services in DB nach Insert`);
    
    if (count === 0 && successCount > 0) {
      console.error('❌ PROBLEM: Services wurden eingefügt, aber count() gibt 0 zurück!');
      // Versuche direkt zu lesen
      const testDoc = await collection.findOne(docs[0].id).exec();
      if (testDoc) {
        console.log('Aber findOne() findet das Dokument:', testDoc.id);
      } else {
        console.error('Auch findOne() findet nichts!');
      }
    }
    
    // Zusätzliche Prüfung: Lese ein Dokument direkt
    if (count > 0) {
      const firstDoc = await collection.findOne(docs[0].id).exec();
      if (firstDoc) {
        console.log('✅ Erstes Dokument verifiziert:', firstDoc.id, firstDoc.title);
      } else {
        console.error('❌ Erstes Dokument nicht gefunden trotz count > 0!');
      }
    }
  } catch (error) {
    console.error('❌ Fehler beim Speichern der Services:', error);
    console.error('Error Details:', error.message);
    
    // Versuche einzeln einzufügen, um das fehlerhafte Dokument zu finden
    console.log('Versuche einzelnes Einfügen mit upsert...');
    let successCount = 0;
    for (let i = 0; i < servicesData.length; i++) {
      try {
        const doc = {
          ...servicesData[i],
          parentServiceId: servicesData[i].parentServiceId || '',
          serviceType: servicesData[i].serviceType || '',
          variant: servicesData[i].variant || '',
          includedIn: servicesData[i].includedIn || [],
          unit: servicesData[i].unit || '',
          formula: servicesData[i].formula || '',
          materialStandard: servicesData[i].materialStandard || '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await collection.upsert(doc);
        successCount++;
      } catch (insertError) {
        console.error(`Fehler bei Service ${i} (${servicesData[i].id}):`, insertError.message);
      }
    }
    
    const finalCount = await collection.count().exec();
    console.log(`Nach einzelnem Insert: ${finalCount} Services in DB (${successCount} erfolgreich)`);
  }
}

export async function seedSpecialServices(db, specialServicesData) {
  const collection = db.collections.specialServices;
  
  console.log('Seeding', specialServicesData.length, 'Special Services...');
  
  // Verwende upsert statt insert, um CONFLICT-Fehler zu vermeiden
  let successCount = 0;
  for (const special of specialServicesData) {
    try {
      const docToSave = {
        ...special,
        // Sicherstellen, dass alle Felder korrekt sind
        requiredService: special.requiredService || null,
        affectsService: special.affectsService || [],
        affectsArea: special.affectsArea || [],
        objectType: special.objectType || [],
        category: special.category || null,
        inputType: special.inputType || null,
        source: special.source || null,
        uxDescription: special.uxDescription || null,
        factor: special.factor || null,
        updatedAt: Date.now()
      };
      
      // Prüfe ob Dokument existiert
      const existing = await collection.findOne(special.id).exec();
      if (existing) {
        // Aktualisiere nur updatedAt, behalte createdAt
        docToSave.createdAt = existing.createdAt || Date.now();
        await collection.upsert(docToSave);
        console.log(`SpecialService ${special.id} aktualisiert`);
      } else {
        // Neues Dokument
        docToSave.createdAt = Date.now();
        await collection.upsert(docToSave);
        console.log(`SpecialService ${special.id} eingefügt`);
      }
      successCount++;
    } catch (error) {
      // CONFLICT-Fehler ignorieren (Dokument existiert bereits)
      if (error.message?.includes('CONFLICT') || error.status === 409) {
        console.log(`SpecialService ${special.id} existiert bereits, überspringe`);
        successCount++;
      } else {
        console.error(`❌ Fehler beim Einfügen von SpecialService ${special.id}:`, error.message);
      }
    }
  }
  
  // Prüfe mit findOne() Fallback, da count() möglicherweise nicht funktioniert
  let finalCount = 0;
  try {
    finalCount = await collection.count().exec();
  } catch (e) {
    // Fallback: Zähle über findOne()
    for (const special of specialServicesData) {
      const doc = await collection.findOne(special.id).exec();
      if (doc) finalCount++;
    }
  }
  
  console.log(`✅ ${successCount} von ${specialServicesData.length} Special Services verarbeitet. DB-Count (via count/findOne): ${finalCount}`);
}

export async function seedFactors(db, factorsData) {
  const collection = db.collections.factors;
  
  const existing = await collection.count().exec();
  if (existing > 0) {
    console.log('Factors bereits vorhanden, überspringe Seeding');
    return;
  }
  
  const docs = factorsData.map(factor => ({
    ...factor,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));
  
  await collection.bulkInsert(docs);
  console.log(`✅ ${docs.length} Factors gespeichert`);
}

export async function seedAllData(db, data) {
  try {
    if (data.services && data.services.length > 0) {
      await seedServices(db, data.services);
    }
    if (data.specialServices && data.specialServices.length > 0) {
      await seedSpecialServices(db, data.specialServices);
    }
    if (data.factors && data.factors.length > 0) {
      await seedFactors(db, data.factors);
    }
    console.log('✅ Alle Daten erfolgreich gespeichert');
  } catch (error) {
    console.error('❌ Fehler beim Seeding:', error);
    throw error;
  }
}

