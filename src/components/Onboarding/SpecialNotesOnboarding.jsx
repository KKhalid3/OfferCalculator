import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchSpecialServices } from "../../store/slices/settingsSlice";
import { fetchServices } from "../../store/slices/servicesSlice";
import { databaseService } from "../../services/databaseService";

/**
 * Sonderangaben-Onboarding
 * Konfiguriert für jede Sonderangabe:
 * - Betroffene Leistungen (affectsService)
 * - Aktivierte Zusatzleistung (requiredService)
 * - Zeitfaktor (factor)
 */
export default function SpecialNotesOnboarding({ onComplete }) {
  const dispatch = useDispatch();
  const specialServices = useSelector((state) => state.settings.specialServices);
  const services = useSelector((state) => state.services.services);
  const loading = useSelector((state) => state.settings.loading);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({
    affectsService: [],
    requiredService: null,
    factor: 1,
  });

  // Alle Haupt-Leistungen für die Auswahl
  const mainServices = useMemo(() => {
    return services
      .filter((s) => {
        if (!s.serviceType) return false;
        return (
          s.serviceType.includes("Shop Titel Leistung") ||
          s.serviceType.includes("Shop Leistung")
        );
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [services]);

  // Alle Unterleistungen für die Zusatzleistungs-Auswahl
  const subServices = useMemo(() => {
    return services
      .filter((s) => s.serviceType?.includes("Unterleistung Backend"))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [services]);

  const currentSpecialNote = specialServices[currentIndex];

  useEffect(() => {
    dispatch(fetchSpecialServices());
    dispatch(fetchServices());
  }, [dispatch]);

  // Lade aktuelle Werte wenn Sonderangabe wechselt
  useEffect(() => {
    if (currentSpecialNote) {
      setFormData({
        affectsService: currentSpecialNote.affectsService || [],
        requiredService: currentSpecialNote.requiredService || null,
        factor: currentSpecialNote.factor || 1,
      });
    }
  }, [currentSpecialNote]);

  const handleServiceToggle = (serviceId) => {
    setFormData((prev) => ({
      ...prev,
      affectsService: prev.affectsService.includes(serviceId)
        ? prev.affectsService.filter((id) => id !== serviceId)
        : [...prev.affectsService, serviceId],
    }));
  };

  const handleRequiredServiceChange = (e) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      requiredService: value === "" ? null : value,
    }));
  };

  const handleFactorChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      factor: parseFloat(e.target.value) || 1,
    }));
  };

  const handleSaveAndNext = async () => {
    if (!currentSpecialNote) return;

    try {
      await databaseService.updateSpecialNoteConfig(currentSpecialNote.id, {
        affectsService: formData.affectsService,
        requiredService: formData.requiredService,
        factor: formData.factor,
        onboardingCompleted: true,
      });

      if (currentIndex < specialServices.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  const handleSkip = () => {
    if (currentIndex < specialServices.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSelect = (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (!isNaN(selectedIndex)) {
      setCurrentIndex(selectedIndex);
    }
  };

  if (loading) {
    return <div className="loading">Lade Sonderangaben...</div>;
  }

  if (specialServices.length === 0) {
    return (
      <div className="card">
        <h2>⚠️ Keine Sonderangaben gefunden</h2>
        <p>Es wurden keine Sonderangaben in der Datenbank gefunden.</p>
        {onComplete && (
          <button onClick={onComplete} style={{ marginTop: "20px" }}>
            Weiter →
          </button>
        )}
      </div>
    );
  }

  if (!currentSpecialNote) {
    return null;
  }

  // Fortschritt
  const configuredCount = specialServices.filter(
    (s) => s.onboardingCompleted
  ).length;
  const progress = ((currentIndex + 1) / specialServices.length) * 100;

  // Finde den Titel der aktuell ausgewählten Zusatzleistung
  const selectedRequiredService = subServices.find(
    (s) => s.id === formData.requiredService
  );

  return (
    <div className="card onboarding-card" style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* Header mit Fortschritt */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <span>
            Sonderangabe {currentIndex + 1} von {specialServices.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div style={{ background: "#e0e0e0", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
          <div
            style={{
              background: "#ff9800",
              height: "100%",
              width: `${progress}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Dropdown zur direkten Auswahl */}
        <div style={{ marginTop: "15px" }}>
          <label style={{ fontSize: "14px", color: "#666" }}>
            Direkt zu Sonderangabe springen:
          </label>
          <select
            value={currentIndex}
            onChange={handleSelect}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px",
            }}
          >
            {specialServices.map((special, index) => (
              <option key={special.id} value={index}>
                {special.onboardingCompleted ? "✅ " : "⚪ "}
                {index + 1}. {special.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sonderangabe Header */}
      <h2 style={{ borderBottom: "2px solid #ff9800", paddingBottom: "10px", marginBottom: "20px" }}>
        🔧 {currentSpecialNote.title}
      </h2>
      
      {currentSpecialNote.uxDescription && (
        <div style={{ 
          background: "#fff3e0", 
          padding: "15px", 
          borderRadius: "8px", 
          marginBottom: "25px",
          border: "1px solid #ffe0b2" 
        }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#e65100" }}>
            ℹ️ {currentSpecialNote.uxDescription}
          </p>
        </div>
      )}

      {/* Zwei-Spalten-Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
        
        {/* Linke Spalte: Betroffene Leistungen */}
        <div>
          <div style={{ background: "#e3f2fd", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#1565c0", fontSize: "16px" }}>
              🎯 Für welche Leistungen relevant?
            </h3>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
              Wählen Sie die Leistungen, bei denen diese Sonderangabe abgefragt werden soll:
            </p>

            <div style={{ 
              maxHeight: "300px", 
              overflowY: "auto", 
              border: "1px solid #ddd", 
              borderRadius: "4px", 
              background: "white" 
            }}>
              {mainServices.map((service) => {
                const isSelected = formData.affectsService.includes(service.id);
                const wasOriginallyIncluded = currentSpecialNote.affectsService?.includes(service.id);
                
                return (
                  <label
                    key={service.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "10px",
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                      background: isSelected ? "#e3f2fd" : "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(service.id)}
                      style={{ marginRight: "10px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: isSelected ? "bold" : "normal" }}>
                        {service.title}
                      </div>
                    </div>
                    {wasOriginallyIncluded && (
                      <span style={{ 
                        fontSize: "10px", 
                        background: "#e8f5e9", 
                        padding: "2px 6px", 
                        borderRadius: "3px", 
                        color: "#2e7d32" 
                      }}>
                        Default
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
              {formData.affectsService.length} Leistung(en) ausgewählt
            </div>
          </div>
        </div>

        {/* Rechte Spalte: Zusatzleistung & Faktor */}
        <div>
          {/* Zusatzleistung */}
          <div style={{ background: "#f3e5f5", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#7b1fa2", fontSize: "16px" }}>
              ➕ Aktiviert Zusatzleistung
            </h3>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
              Welche Unterleistung wird aktiviert, wenn diese Sonderangabe gewählt wird?
            </p>

            <select
              value={formData.requiredService || ""}
              onChange={handleRequiredServiceChange}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "4px",
                border: "1px solid #ddd",
                fontSize: "14px",
              }}
            >
              <option value="">-- Keine Zusatzleistung --</option>
              {subServices.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                  {sub.id === currentSpecialNote.requiredService && " (Default)"}
                </option>
              ))}
            </select>

            {selectedRequiredService && (
              <div style={{ 
                marginTop: "10px", 
                padding: "10px", 
                background: "#ede7f6", 
                borderRadius: "4px",
                fontSize: "13px" 
              }}>
                <strong>Gewählt:</strong> {selectedRequiredService.title}
                {selectedRequiredService.variant && (
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    {selectedRequiredService.variant}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zeitfaktor */}
          <div style={{ background: "#ffebee", padding: "15px", borderRadius: "8px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#c62828", fontSize: "16px" }}>
              ⏱️ Zeitfaktor
            </h3>
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
              Mit welchem Faktor wird die Arbeitszeit multipliziert?
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                value={formData.factor}
                onChange={handleFactorChange}
                step="0.05"
                min="1"
                max="5"
                style={{ width: "100px", padding: "10px", fontSize: "16px" }}
              />
              <span style={{ fontSize: "16px" }}>×</span>
              <span style={{ fontSize: "12px", color: "#888" }}>
                (Default: {currentSpecialNote.factor || 1}×)
              </span>
            </div>

            {/* Beispielrechnung */}
            {formData.factor !== 1 && (
              <div style={{ 
                marginTop: "15px", 
                padding: "10px", 
                background: "#fff", 
                borderRadius: "4px",
                fontSize: "13px",
                border: "1px solid #ffcdd2"
              }}>
                <strong>Beispiel:</strong> Bei 60 min Arbeitszeit → {(60 * formData.factor).toFixed(0)} min
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            style={{
              background: currentIndex === 0 ? "#ccc" : "#6c757d",
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            }}
          >
            ← Zurück
          </button>
          <button
            type="button"
            onClick={handleSkip}
            style={{ background: "#9e9e9e" }}
          >
            Überspringen
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleSaveAndNext}>
            {currentIndex < specialServices.length - 1
              ? "Speichern & Weiter →"
              : "Speichern & Abschließen ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

