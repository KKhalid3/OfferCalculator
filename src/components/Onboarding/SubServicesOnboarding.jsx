import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchServices, updateServiceConfig } from "../../store/slices/servicesSlice";

/**
 * Unterleistungen-Onboarding
 * Konfiguriert für jede Unterleistung:
 * - Zeitwerte (standardValuePerUnit, minTime, waitTime)
 * - Effizienzwerte (efficiencyStart, efficiencyCap, efficiencyStepPercent)
 * - Produktivität (maxProductivityPerDay)
 * - Material (materialType, materialValue)
 * 
 * WICHTIG: Dieses Onboarding muss VOR dem Hauptleistungen-Onboarding durchgeführt werden,
 * damit die Unterleistungen danach mit den Hauptleistungen verknüpft werden können.
 */
export default function SubServicesOnboarding({ onComplete }) {
  const dispatch = useDispatch();
  const services = useSelector((state) => state.services.services);
  const loading = useSelector((state) => state.services.loading);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({});

  // Nur REINE Unterleistungen für das Onboarding (22 Stück erwartet)
  // Services die AUCH "Shop Leistung" sind (Malervlies, Raufaser, Tapeten entfernen), 
  // werden im Hauptleistungen-Onboarding behandelt
  const subServices = useMemo(() => {
    // Sicherheitscheck: Wenn zu wenige Services im State, könnte ein Problem vorliegen
    if (services.length < 20) {
      console.warn(`⚠️ Nur ${services.length} Services im State (erwartet mindestens 36)!`);
    }
    
    const filtered = services
      .filter((s) => {
        if (!s.serviceType) {
          console.warn(`⚠️ Service ohne serviceType gefiltert: ${s.id} - ${s.title}`);
          return false;
        }
        const isUnterleistung = s.serviceType.includes("Unterleistung Backend");
        const isShopLeistung = s.serviceType.includes("Shop Leistung");
        // Nur REINE Unterleistungen (nicht auch Shop Leistung)
        return isUnterleistung && !isShopLeistung;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
    
    console.log(`📎 Reine Unterleistungen: ${filtered.length} (erwartet: 22) aus ${services.length} total Services`);
    if (filtered.length > 0) {
      console.log('📎 Erste 3:', filtered.slice(0, 3).map(s => s.title).join(', '));
    } else if (services.length > 0) {
      console.error(`❌ KRITISCH: Keine Unterleistungen gefunden, obwohl ${services.length} Services im State sind!`);
      console.log('📎 Service-Typen:', [...new Set(services.map(s => s.serviceType))]);
    }
    return filtered;
  }, [services]);

  const currentService = subServices[currentIndex];

  useEffect(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  // Lade aktuelle Werte wenn Service wechselt
  useEffect(() => {
    if (currentService) {
      setFormData({
        // Zeitwerte - nutze Default-Werte aus Stammdaten
        standardValuePerUnit: currentService.standardValuePerUnit || 0,
        minTime: currentService.minTime || 0,
        waitTime: currentService.waitTime || 0,
        // Effizienz
        efficiencyStart: currentService.efficiencyStart || 0,
        efficiencyCap: currentService.efficiencyCap || 0,
        efficiencyStepPercent: currentService.efficiencyStepPercent || 1,
        // Produktivität
        maxProductivityPerDay: currentService.maxProductivityPerDay || 0,
        // Material
        materialType: currentService.materialType || "percent",
        materialValue: currentService.materialValue || 10,
      });
    }
  }, [currentService]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSaveAndNext = async () => {
    if (!currentService) return;

    try {
      // Speichere alle Werte über Redux (aktualisiert auch den State!)
      await dispatch(updateServiceConfig({
        serviceId: currentService.id,
        config: {
          standardValuePerUnit: formData.standardValuePerUnit,
          minTime: formData.minTime,
          waitTime: formData.waitTime,
          efficiencyStart: formData.efficiencyStart,
          efficiencyCap: formData.efficiencyCap,
          efficiencyStepPercent: formData.efficiencyStepPercent,
          maxProductivityPerDay: formData.maxProductivityPerDay,
          materialType: formData.materialType,
          materialValue: formData.materialValue,
          subServiceConfigOnboardingCompleted: true,
        }
      })).unwrap();

      console.log(`✅ Unterleistung ${currentService.id} gespeichert, gehe zu Index ${currentIndex + 1}`);

      // WICHTIG: Redux State wird bereits durch updateServiceConfig.fulfilled aktualisiert!
      // KEIN fetchServices() nötig - das würde den State möglicherweise mit zu wenigen Services überschreiben

      // Weiter zur nächsten Unterleistung
      const nextIndex = currentIndex + 1;
      if (nextIndex < subServices.length) {
        setCurrentIndex(nextIndex);
      } else {
        // Alle Unterleistungen konfiguriert
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  const handleSkip = () => {
    if (currentIndex < subServices.length - 1) {
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

  const handleServiceSelect = (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (!isNaN(selectedIndex)) {
      setCurrentIndex(selectedIndex);
    }
  };

  if (loading) {
    return <div className="loading">Lade Unterleistungen...</div>;
  }

  if (subServices.length === 0) {
    return (
      <div className="card">
        <h2>✅ Keine Unterleistungen gefunden</h2>
        <p>Es gibt keine Unterleistungen, die konfiguriert werden müssen.</p>
        {onComplete && (
          <button onClick={onComplete} style={{ marginTop: "20px" }}>
            Weiter zu Hauptleistungen →
          </button>
        )}
      </div>
    );
  }

  // Fortschritt berechnen
  const configuredCount = subServices.filter(
    (s) => s.subServiceConfigOnboardingCompleted
  ).length;
  const progress = (configuredCount / subServices.length) * 100;
  const allConfigured = configuredCount === subServices.length;
  const isLastService = currentIndex === subServices.length - 1;

  if (!currentService) {
    return null;
  }

  // Prüfe ob Default-Werte vorhanden sind
  const hasDefaultValues = currentService.standardValuePerUnit > 0 || 
                           currentService.minTime > 0 || 
                           currentService.waitTime > 0;

  return (
    <div className="card onboarding-card">
      {/* Fortschrittsanzeige */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <span>
            Unterleistung {currentIndex + 1} von {subServices.length} |{" "}
            {configuredCount} konfiguriert
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          style={{
            background: "#e0e0e0",
            borderRadius: "4px",
            height: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#9C27B0",
              height: "100%",
              width: `${progress}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Dropdown zur direkten Auswahl */}
        <div style={{ marginTop: "15px" }}>
          <label style={{ fontSize: "14px", color: "#666" }}>
            Direkt zu Unterleistung springen:
          </label>
          <select
            value={currentIndex}
            onChange={handleServiceSelect}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "5px",
              borderRadius: "4px",
              border: "1px solid #ddd",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {subServices.map((service, index) => (
              <option key={service.id} value={index}>
                {service.subServiceConfigOnboardingCompleted ? "✅ " : "⚪ "}
                {index + 1}. {service.title}
                {service.variant ? ` (${service.variant})` : ""} ({service.unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alle konfiguriert Hinweis */}
      {allConfigured && (
        <div
          style={{
            background: "#E1BEE7",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #9C27B0",
          }}
        >
          <strong>✅ Alle Unterleistungen sind bereits konfiguriert!</strong>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
            Sie können Einstellungen überprüfen oder ändern, oder direkt zu den Hauptleistungen gehen.
          </p>
          <button
            onClick={onComplete}
            style={{ marginTop: "10px", background: "#9C27B0" }}
          >
            Weiter zu Hauptleistungen →
          </button>
        </div>
      )}

      {/* Header */}
      <h2>📎 Unterleistung konfigurieren: {currentService.title}</h2>
      <p style={{ color: "#666", marginBottom: "10px" }}>
        <strong>Einheit:</strong> {currentService.unit}
        {currentService.variant && (
          <>
            {" | "}
            <strong>Variante:</strong> {currentService.variant}
          </>
        )}
      </p>

      {/* Default-Werte Hinweis */}
      {hasDefaultValues && (
        <div
          style={{
            background: "#E8F5E9",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
            fontSize: "14px",
            border: "1px solid #A5D6A7",
          }}
        >
          ✨ <strong>Default-Werte aus Stammdaten geladen</strong> - Sie können diese anpassen oder übernehmen.
        </div>
      )}

      {/* Formular */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        {/* Zeitwerte */}
        <div className="form-section">
          <h3>⏱️ Zeitwerte</h3>
          <div className="form-group">
            <label>Zeit pro {currentService.unit}:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="standardValuePerUnit"
                value={formData.standardValuePerUnit || ""}
                onChange={handleChange}
                step="0.1"
                min="0"
                style={{ width: "80px" }}
              />
              <span>Minuten</span>
            </div>
          </div>
          <div className="form-group">
            <label>Mindestzeit pro Tag:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="minTime"
                value={formData.minTime || ""}
                onChange={handleChange}
                step="15"
                min="0"
                style={{ width: "80px" }}
              />
              <span>Minuten</span>
            </div>
          </div>
          <div className="form-group">
            <label>Wartezeit (Trocknung):</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="waitTime"
                value={formData.waitTime || ""}
                onChange={handleChange}
                step="30"
                min="0"
                style={{ width: "80px" }}
              />
              <span>Minuten</span>
            </div>
          </div>
        </div>

        {/* Effizienz-Steigerung */}
        <div className="form-section">
          <h3>📈 Effizienz-Steigerung</h3>
          <div className="form-group">
            <label>Effizienz beginnt ab:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="efficiencyStart"
                value={formData.efficiencyStart || ""}
                onChange={handleChange}
                step="10"
                min="0"
                style={{ width: "80px" }}
              />
              <span>{currentService.unit}</span>
            </div>
          </div>
          <div className="form-group">
            <label>Maximum (Deckel) bei:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="efficiencyCap"
                value={formData.efficiencyCap || ""}
                onChange={handleChange}
                step="10"
                min="0"
                style={{ width: "80px" }}
              />
              <span>{currentService.unit}</span>
            </div>
          </div>
          <div className="form-group">
            <label>Steigerung pro 10 {currentService.unit}:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="efficiencyStepPercent"
                value={formData.efficiencyStepPercent || ""}
                onChange={handleChange}
                step="0.1"
                min="0"
                max="10"
                style={{ width: "80px" }}
              />
              <span>%</span>
            </div>
          </div>
        </div>

        {/* Max. Produktivität */}
        <div className="form-section">
          <h3>🏃 Max. Produktivität</h3>
          <div className="form-group">
            <label>Max. Einheiten pro Tag:</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                name="maxProductivityPerDay"
                value={formData.maxProductivityPerDay || ""}
                onChange={handleChange}
                step="10"
                min="0"
                style={{ width: "80px" }}
              />
              <span>{currentService.unit}</span>
            </div>
          </div>
        </div>

        {/* Material-Zuschlag */}
        <div className="form-section">
          <h3>📦 Material-Zuschlag</h3>
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <input
                type="radio"
                name="materialType"
                value="none"
                checked={formData.materialType === "none"}
                onChange={handleChange}
              />
              Kein Material
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <input
                type="radio"
                name="materialType"
                value="percent"
                checked={formData.materialType === "percent"}
                onChange={handleChange}
              />
              Prozent auf Lohnkosten
              {formData.materialType === "percent" && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <input
                    type="number"
                    name="materialValue"
                    value={formData.materialValue || ""}
                    onChange={handleChange}
                    step="1"
                    min="0"
                    style={{ width: "60px" }}
                  />
                  %
                </span>
              )}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="radio"
                name="materialType"
                value="fixed"
                checked={formData.materialType === "fixed"}
                onChange={handleChange}
              />
              Fester Betrag pro {currentService.unit}
              {formData.materialType === "fixed" && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <input
                    type="number"
                    name="materialValue"
                    value={formData.materialValue || ""}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    style={{ width: "60px" }}
                  />
                  €
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          marginTop: "30px",
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
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
            style={{ background: "#999" }}
          >
            Überspringen
          </button>
        </div>
        <button
          type="button"
          onClick={handleSaveAndNext}
          style={{ background: "#9C27B0" }}
        >
          {currentService?.subServiceConfigOnboardingCompleted
            ? "💾 Änderungen speichern"
            : isLastService
            ? "Speichern & Abschließen ✓"
            : "Speichern & Weiter →"}
        </button>
      </div>
    </div>
  );
}

