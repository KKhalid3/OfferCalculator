import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import { initDatabase, getDatabase } from './database/database';
import { seedAllData } from './database/seedData';
import { initialData } from './data/initialData';
import App from './App';
import './index.css';

async function initApp() {
  try {
    // RxDB initialisieren
    console.log('Initialisiere RxDB...');
    const db = await initDatabase();
    
    // Prüfen ob Daten vorhanden
    const servicesCount = await db.collections.services.count().exec();
    
    if (servicesCount === 0) {
      console.log('Datenbank ist leer, lade Initial-Daten...');
      await seedAllData(db, initialData);
      console.log(`✅ ${initialData.services?.length || 0} Services geladen`);
    } else {
      console.log(`Datenbank enthält bereits ${servicesCount} Services`);
      // Falls zu wenige Services, neu seeden
      if (servicesCount < 10) {
        console.log('Wenige Services gefunden, lade Daten neu...');
        // Alte Daten löschen
        await db.collections.services.find().remove();
        await db.collections.specialServices.find().remove();
        await db.collections.factors.find().remove();
        // Neu seeden
        await seedAllData(db, initialData);
        console.log(`✅ ${initialData.services?.length || 0} Services neu geladen`);
      }
    }
    
    // Prüfen ob Services wirklich in der DB sind
    const testServices = await db.collections.services.find().exec();
    console.log('Test: Services in DB:', testServices.length);
    if (testServices.length > 0) {
      console.log('Erste 3 Services:', testServices.slice(0, 3).map(d => ({ id: d.id, title: d.title })));
    }
    
    // Prüfen ob SpecialServices in der DB sind
    const testSpecialServices = await db.collections.specialServices.find().exec();
    console.log('Test: SpecialServices in DB:', testSpecialServices.length);
    if (testSpecialServices.length > 0) {
      console.log('Erste SpecialService:', testSpecialServices[0].toJSON());
    } else {
      console.warn('⚠️ Keine SpecialServices in DB gefunden!');
      // Manuell seeden
      console.log('Seede SpecialServices manuell...');
      if (initialData.specialServices && initialData.specialServices.length > 0) {
        for (const special of initialData.specialServices) {
          try {
            await db.collections.specialServices.insert({
              ...special,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          } catch (e) {
            console.log('SpecialService existiert bereits:', special.id);
          }
        }
        const afterSeed = await db.collections.specialServices.find().exec();
        console.log('Nach manuellem Seeding: SpecialServices in DB:', afterSeed.length);
      }
    }
    
    // React App rendern
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </React.StrictMode>
    );
    
    console.log('✅ App erfolgreich gestartet');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    document.getElementById('root').innerHTML = `
      <div style="padding: 20px; color: red;">
        <h1>Fehler beim Starten der Anwendung</h1>
        <p>${error.message}</p>
        <p>Bitte öffnen Sie die Browser-Konsole für weitere Details.</p>
      </div>
    `;
  }
}

initApp();

