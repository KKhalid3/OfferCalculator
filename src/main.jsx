import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import { initDatabase, getDatabase } from "./database/database";
import { seedAllData } from "./database/seedData";
import { initialData } from "./data/initialData";
import App from "./App";
import "./index.css";

async function initApp() {
  try {
    // RxDB initialisieren
    console.log("Initialisiere RxDB...");
    const db = await initDatabase();

    // Prüfen ob Daten vorhanden
    const servicesCount = await db.collections.services.count().exec();

    if (servicesCount === 0) {
      console.log("Datenbank ist leer, lade Initial-Daten...");
      await seedAllData(db, initialData);
      console.log(`✅ ${initialData.services?.length || 0} Services geladen`);
    } else {
      console.log(`Datenbank enthält bereits ${servicesCount} Services`);
      // Falls zu wenige Services, neu seeden
      if (servicesCount < 10) {
        console.log("Wenige Services gefunden, lade Daten neu...");
        // Alte Daten löschen
        await db.collections.services.find().remove();
        await db.collections.specialServices.find().remove();
        await db.collections.factors.find().remove();
        // Neu seeden
        await seedAllData(db, initialData);
        console.log(
          `✅ ${initialData.services?.length || 0} Services neu geladen`
        );
      }
    }

    // Prüfen ob Services wirklich in der DB sind
    const testServices = await db.collections.services.find().exec();
    console.log("Test: Services in DB:", testServices.length);
    if (testServices.length > 0) {
      console.log(
        "Erste 3 Services:",
        testServices.slice(0, 3).map((d) => ({ id: d.id, title: d.title }))
      );
    }

    // Prüfen ob SpecialServices in der DB sind
    const testSpecialServices = await db.collections.specialServices
      .find()
      .exec();
    console.log("Test: SpecialServices in DB:", testSpecialServices.length);
    if (testSpecialServices.length > 0) {
      console.log("Erste SpecialService:", testSpecialServices[0].toJSON());
    } else {
      console.warn("⚠️ Keine SpecialServices in DB gefunden!");
      // Manuell seeden
      console.log("Seede SpecialServices manuell...");
      if (
        initialData.specialServices &&
        initialData.specialServices.length > 0
      ) {
        for (const special of initialData.specialServices) {
          try {
            await db.collections.specialServices.insert({
              ...special,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          } catch (e) {
            console.log("SpecialService existiert bereits:", special.id);
          }
        }
        const afterSeed = await db.collections.specialServices.find().exec();
        console.log(
          "Nach manuellem Seeding: SpecialServices in DB:",
          afterSeed.length
        );
      }
    }

    // React App rendern
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </React.StrictMode>
    );

    console.log("✅ App erfolgreich gestartet");
  } catch (error) {
    console.error("❌ Failed to initialize app:", error);

    // Reset-Funktion für den Button
    const handleResetDB = async () => {
      try {
        // IndexedDB löschen
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name && db.name.includes("offercalculator")) {
            window.indexedDB.deleteDatabase(db.name);
            console.log("Gelöscht:", db.name);
          }
        }
        alert("Datenbank gelöscht. Seite wird neu geladen...");
        window.location.reload();
      } catch (resetError) {
        console.error("Fehler beim Löschen:", resetError);
        alert(
          "Fehler beim Zurücksetzen der Datenbank. Bitte öffnen Sie die Browser-Konsole."
        );
      }
    };

    // Fehleranzeige mit Reset-Button
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText =
      'padding: 40px; max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    errorDiv.innerHTML = `
      <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h1 style="color: #856404; margin-top: 0; font-size: 24px;">⚠️ Fehler beim Starten der Anwendung</h1>
        <p style="color: #856404; font-size: 16px; margin: 15px 0;">
          <strong>Fehler:</strong> ${error.message}
        </p>
        <p style="color: #856404; font-size: 14px; margin: 15px 0;">
          Dies ist häufig ein Schema-Migrationsfehler. Bitte versuchen Sie die Datenbank zurückzusetzen.
        </p>
        <p style="color: #856404; font-size: 13px; margin: 15px 0;">
          Bitte öffnen Sie die Browser-Konsole (F12) für weitere Details.
        </p>
      </div>
      
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px;">
        <h2 style="color: #333; font-size: 18px; margin-top: 0;">🔧 Lösung: Datenbank zurücksetzen</h2>
        <p style="color: #666; font-size: 14px; margin: 10px 0;">
          Wenn die Datenbank ein veraltetes Schema hat, können Sie sie hier zurücksetzen. 
          <strong>Alle gespeicherten Daten werden gelöscht</strong> und die Anwendung startet mit Standardwerten neu.
        </p>
        <button 
          id="reset-db-button"
          style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 15px;
            transition: background 0.2s;
          "
          onmouseover="this.style.background='#c82333'"
          onmouseout="this.style.background='#dc3545'"
        >
          🔄 Datenbank zurücksetzen
        </button>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">
          Nach dem Klick wird die Seite automatisch neu geladen.
        </p>
      </div>
    `;

    document.getElementById("root").appendChild(errorDiv);

    // Event Listener für Reset-Button
    document
      .getElementById("reset-db-button")
      .addEventListener("click", handleResetDB);
  }
}

initApp();
