import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchSpecialServices } from "../../store/slices/settingsSlice";
import {
  updateObjectById,
  updateObjectSpecialNotes,
} from "../../store/slices/objectsSlice";

export default function SpecialNotesSelector() {
  const dispatch = useDispatch();
  const objects = useSelector((state) => state.objects.objects);
  const services = useSelector((state) => state.services.services);
  const specialServices = useSelector((state) => state.settings.specialServices);

  useEffect(() => {
    console.log('SpecialNotesSelector: Lade specialServices...');
    dispatch(fetchSpecialServices());
  }, [dispatch]);

  // Debug-Logging
  useEffect(() => {
    console.log('=== SpecialNotesSelector Debug ===');
    console.log('specialServices in Redux:', specialServices.length);
    console.log('objects:', objects.length);
    if (objects.length > 0) {
      console.log('Erstes Objekt services:', objects[0].services);
    }
    if (specialServices.length > 0) {
      console.log('Erste SpecialService:', specialServices[0]);
      console.log('Alle SpecialService IDs:', specialServices.map(s => s.id));
    } else {
      console.warn('⚠️ Keine SpecialServices geladen!');
    }
  }, [specialServices, objects]);

  // Finde relevante Sonderangaben für ein Objekt basierend auf seinen Leistungen
  const getRelevantSpecialNotes = (objectServices) => {
    console.log('getRelevantSpecialNotes für services:', objectServices);
    if (!objectServices || objectServices.length === 0) {
      console.log('Keine Services ausgewählt, zeige keine Sonderangaben');
      return [];
    }

    const relevant = specialServices.filter((special) => {
      // Prüfe ob eine der ausgewählten Leistungen in affectsService enthalten ist
      if (!special.affectsService || special.affectsService.length === 0) {
        // Wenn keine spezifischen Leistungen definiert, zeige für alle
        return true;
      }
      const matches = special.affectsService.some((serviceId) =>
        objectServices.includes(serviceId)
      );
      if (matches) {
        console.log(`  ✓ ${special.title} ist relevant für`, special.affectsService);
      }
      return matches;
    });
    
    console.log('Relevante Sonderangaben:', relevant.length);
    return relevant;
  };

  // Finde die Zusatzleistung, die durch eine Sonderangabe aktiviert wird
  const getRequiredServiceTitle = (requiredServiceId) => {
    if (!requiredServiceId) return null;
    const service = services.find((s) => s.id === requiredServiceId);
    return service ? service.title : null;
  };

  const handleSpecialNoteToggle = (objectId, specialNoteId) => {
    const object = objects.find((obj) => obj.id === objectId);
    if (!object) return;

    const currentSpecialNotes = object.specialNotes || [];
    const isSelected = currentSpecialNotes.includes(specialNoteId);

    const newSpecialNotes = isSelected
      ? currentSpecialNotes.filter((id) => id !== specialNoteId)
      : [...currentSpecialNotes, specialNoteId];

    // Optimistic Update
    dispatch(updateObjectSpecialNotes({ objectId, specialNotes: newSpecialNotes }));

    // Persistiere in Datenbank
    dispatch(
      updateObjectById({
        id: objectId,
        updates: { specialNotes: newSpecialNotes },
      })
    ).catch((error) => {
      console.error("Fehler bei updateObjectById:", error);
      // Rollback
      dispatch(updateObjectSpecialNotes({ objectId, specialNotes: currentSpecialNotes }));
    });
  };

  // Prüfe ob mindestens ein Objekt Leistungen hat, die Sonderangaben erfordern
  const hasRelevantObjects = useMemo(() => {
    const result = objects.some((obj) => {
      const relevantNotes = getRelevantSpecialNotes(obj.services || []);
      return relevantNotes.length > 0;
    });
    console.log('hasRelevantObjects:', result);
    return result;
  }, [objects, specialServices]);

  // Debug: Warum wird die Komponente nicht gerendert?
  if (specialServices.length === 0) {
    console.log('SpecialNotesSelector: NICHT GERENDERT - specialServices.length === 0');
    return (
      <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107' }}>
        <p>⚠️ Debug: Keine Sonderangaben geladen. Prüfen Sie die Konsole.</p>
      </div>
    );
  }

  if (!hasRelevantObjects) {
    console.log('SpecialNotesSelector: NICHT GERENDERT - keine relevanten Objekte');
    return (
      <div className="card" style={{ background: '#e3f2fd', border: '1px solid #2196F3' }}>
        <p>ℹ️ Wählen Sie eine Leistung wie "Überholungsanstrich" aus, um Sonderangaben zu sehen.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>🔧 Sonderangaben pro Raum</h2>
      <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
        Bitte geben Sie an, welche besonderen Umstände in den Räumen vorliegen.
        Diese beeinflussen die Kalkulation und fügen ggf. zusätzliche Leistungen hinzu.
      </p>

      {objects.map((obj) => {
        const relevantSpecialNotes = getRelevantSpecialNotes(obj.services || []);
        if (relevantSpecialNotes.length === 0) return null;

        return (
          <div
            key={obj.id}
            style={{
              marginBottom: "25px",
              padding: "15px",
              background: "#f9f9f9",
              borderRadius: "8px",
            }}
          >
            <h3 style={{ marginBottom: "15px" }}>
              {obj.name} ({obj.type})
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {relevantSpecialNotes.map((special) => {
                const isSelected = (obj.specialNotes || []).includes(special.id);
                const requiredServiceTitle = getRequiredServiceTitle(special.requiredService);

                return (
                  <div
                    key={special.id}
                    style={{
                      padding: "12px",
                      background: isSelected ? "#fff3e0" : "white",
                      border: isSelected ? "2px solid #ff9800" : "1px solid #ddd",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    onClick={() => handleSpecialNoteToggle(obj.id, special.id)}
                  >
                    <label style={{ display: "flex", alignItems: "flex-start", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ marginRight: "12px", marginTop: "3px" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                          {special.title}
                        </div>
                        {special.uxDescription && (
                          <div style={{ fontSize: "12px", color: "#666", marginBottom: "6px" }}>
                            {special.uxDescription}
                          </div>
                        )}
                        {isSelected && requiredServiceTitle && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#e65100",
                              background: "#fff8e1",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              marginTop: "8px",
                            }}
                          >
                            ➕ Aktiviert Zusatzleistung: <strong>{requiredServiceTitle}</strong>
                          </div>
                        )}
                        {isSelected && special.factor && special.factor !== 1 && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#1565c0",
                              background: "#e3f2fd",
                              padding: "6px 10px",
                              borderRadius: "4px",
                              marginTop: "4px",
                            }}
                          >
                            ⏱️ Zeitfaktor: ×{special.factor}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

