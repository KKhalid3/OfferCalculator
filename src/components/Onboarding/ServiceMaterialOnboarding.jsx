import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchServices,
  updateServiceMaterial,
} from "../../store/slices/servicesSlice";
// Material-Onboarding mit Zurück-Button und Dropdown

export default function ServiceMaterialOnboarding({ onComplete }) {
  const dispatch = useDispatch();
  const services = useSelector((state) => state.services.services);
  const loading = useSelector((state) => state.services.loading);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [materialData, setMaterialData] = useState({
    materialType: "percent",
    materialValue: 15,
  });

  // Alle konfigurierbaren Leistungen für das Onboarding (Shop + Unterleistungen)
  const configurableServices = services.filter((s) => {
    if (!s.serviceType) return false;
    return (
      s.serviceType.includes("Shop Titel Leistung") ||
      s.serviceType.includes("Shop Leistung") ||
      s.serviceType.includes("Unterleistung Backend")
    );
  });

  // Sortieren: Erst Hauptleistungen (Shop), dann Unterleistungen
  const shopServices = [...configurableServices].sort((a, b) => {
    const aIsMain = a.serviceType.includes("Shop");
    const bIsMain = b.serviceType.includes("Shop");
    if (aIsMain && !bIsMain) return -1;
    if (!aIsMain && bIsMain) return 1;
    return a.title.localeCompare(b.title);
  });

  // Services ohne Material-Onboarding (für Fortschrittsanzeige)
  const servicesNeedingOnboarding = shopServices.filter(
    (s) => !s.materialOnboardingCompleted
  );

  // WICHTIG: currentService aus ALLEN shopServices, damit man auch zu bereits konfigurierten zurück kann
  const currentService = shopServices[currentIndex];

  useEffect(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  useEffect(() => {
    if (currentService) {
      setMaterialData({
        materialType: currentService.materialType || "percent",
        materialValue: currentService.materialValue || 15,
      });
    }
  }, [currentService]);

  const handleMaterialTypeChange = (type) => {
    setMaterialData((prev) => ({
      ...prev,
      materialType: type,
      materialValue: type === "percent" ? 15 : 0.5,
    }));
  };

  const handleSaveAndNext = async () => {
    if (!currentService) return;

    await dispatch(
      updateServiceMaterial({
        serviceId: currentService.id,
        materialType: materialData.materialType,
        materialValue: materialData.materialValue,
      })
    );

    // Nach dem Speichern: gehe zur nächsten Leistung (oder beende, wenn alle fertig)
    if (currentIndex < shopServices.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Letzte Leistung erreicht - prüfe ob alle konfiguriert sind
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < shopServices.length - 1) {
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
    return <div className="loading">Lade Leistungen...</div>;
  }

  if (shopServices.length === 0) {
    return (
      <div className="card">
        <h2>Keine Leistungen vorhanden</h2>
        <p>Es wurden keine Shop-Leistungen gefunden.</p>
        {onComplete && (
          <button onClick={onComplete} style={{ marginTop: "20px" }}>
            Weiter zur Kalkulation →
          </button>
        )}
      </div>
    );
  }

  if (!currentService) {
    return null;
  }

  // Fortschrittsanzeige: wie viele bereits konfiguriert
  const configuredCount = shopServices.filter(
    (s) => s.materialOnboardingCompleted
  ).length;
  const progress = (configuredCount / shopServices.length) * 100;
  const allConfigured = servicesNeedingOnboarding.length === 0;

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
            Leistung {currentIndex + 1} von {shopServices.length} |{" "}
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
              background: "#4CAF50",
              height: "100%",
              width: `${progress}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Dropdown zur direkten Auswahl - zeigt ALLE konfigurierbaren Services */}
        <div style={{ marginTop: "15px" }}>
          <label style={{ fontSize: "14px", color: "#666" }}>
            Direkt zu Leistung springen:
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
            {shopServices.map((service, index) => {
              const isSubService = service.serviceType?.includes(
                "Unterleistung Backend"
              );
              return (
                <option key={service.id} value={index}>
                  {service.materialOnboardingCompleted ? "✅ " : "⚪ "}
                  {isSubService ? "↳ " : ""}
                  {index + 1}. {service.title} ({service.unit})
                  {isSubService ? " [Unterleistung]" : ""}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Hinweis wenn alle konfiguriert */}
      {allConfigured && (
        <div
          style={{
            background: "#d4edda",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #c3e6cb",
          }}
        >
          <strong>✅ Alle Leistungen sind bereits konfiguriert!</strong>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
            Sie können Einstellungen überprüfen oder ändern.
          </p>
        </div>
      )}

      {/* Typ-Anzeige (Hauptleistung oder Unterleistung) */}
      {currentService?.serviceType?.includes("Unterleistung Backend") ? (
        <div
          style={{
            background: "#e3f2fd",
            padding: "10px 15px",
            borderRadius: "6px",
            marginBottom: "15px",
            border: "1px solid #90caf9",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "20px" }}>📎</span>
          <div>
            <strong style={{ color: "#1565c0" }}>Unterleistung</strong>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Diese Leistung wird automatisch zu Hauptleistungen hinzugefügt
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#e8f5e9",
            padding: "10px 15px",
            borderRadius: "6px",
            marginBottom: "15px",
            border: "1px solid #a5d6a7",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "20px" }}>🎯</span>
          <div>
            <strong style={{ color: "#2e7d32" }}>Hauptleistung</strong>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Diese Leistung kann vom Kunden direkt ausgewählt werden
            </div>
          </div>
        </div>
      )}

      <h2>🎨 Materialzuschlag: {currentService.title}</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Einheit: <strong>{currentService.unit}</strong>
      </p>

      <div className="form-group">
        <label>Wie wird Material berechnet?</label>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            marginTop: "10px",
          }}
        >
          {/* Kein Material */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              padding: "15px",
              border:
                materialData.materialType === "none"
                  ? "2px solid #2196F3"
                  : "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              background:
                materialData.materialType === "none" ? "#E3F2FD" : "white",
            }}
          >
            <input
              type="radio"
              name="materialType"
              checked={materialData.materialType === "none"}
              onChange={() => handleMaterialTypeChange("none")}
              style={{ marginRight: "15px" }}
            />
            <div>
              <strong>Kein Material</strong>
              <div style={{ fontSize: "12px", color: "#666" }}>
                Nur Arbeitszeit wird berechnet
              </div>
            </div>
          </label>

          {/* Prozentualer Zuschlag */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              padding: "15px",
              border:
                materialData.materialType === "percent"
                  ? "2px solid #2196F3"
                  : "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              background:
                materialData.materialType === "percent" ? "#E3F2FD" : "white",
            }}
          >
            <input
              type="radio"
              name="materialType"
              checked={materialData.materialType === "percent"}
              onChange={() => handleMaterialTypeChange("percent")}
              style={{ marginRight: "15px" }}
            />
            <div style={{ flex: 1 }}>
              <strong>Prozentualer Zuschlag auf Lohnkosten</strong>
              <div style={{ fontSize: "12px", color: "#666" }}>
                z.B. 15% Materialzuschlag auf die berechneten Lohnkosten
              </div>
              {materialData.materialType === "percent" && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <input
                    type="number"
                    value={materialData.materialValue}
                    onChange={(e) =>
                      setMaterialData((prev) => ({
                        ...prev,
                        materialValue: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min="0"
                    max="100"
                    style={{ width: "80px" }}
                  />
                  <span>%</span>
                </div>
              )}
            </div>
          </label>

          {/* Fester Betrag */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              padding: "15px",
              border:
                materialData.materialType === "fixed"
                  ? "2px solid #2196F3"
                  : "1px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              background:
                materialData.materialType === "fixed" ? "#E3F2FD" : "white",
            }}
          >
            <input
              type="radio"
              name="materialType"
              checked={materialData.materialType === "fixed"}
              onChange={() => handleMaterialTypeChange("fixed")}
              style={{ marginRight: "15px" }}
            />
            <div style={{ flex: 1 }}>
              <strong>Fester Betrag pro {currentService.unit}</strong>
              <div style={{ fontSize: "12px", color: "#666" }}>
                z.B. 0,50 € pro m² für Material
              </div>
              {materialData.materialType === "fixed" && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <input
                    type="number"
                    value={materialData.materialValue}
                    onChange={(e) =>
                      setMaterialData((prev) => ({
                        ...prev,
                        materialValue: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min="0"
                    step="0.01"
                    style={{ width: "80px" }}
                  />
                  <span>€/{currentService.unit}</span>
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Info-Box */}
      {materialData.materialType !== "none" && (
        <div
          style={{
            background: "#FFF3E0",
            padding: "15px",
            borderRadius: "8px",
            marginTop: "20px",
            border: "1px solid #FFE0B2",
          }}
        >
          <strong>ℹ️ Beispielrechnung:</strong>
          <div style={{ marginTop: "10px", fontSize: "14px" }}>
            {materialData.materialType === "percent" ? (
              <>
                Bei Lohnkosten von 100 € werden{" "}
                <strong>{materialData.materialValue} €</strong> Material
                aufgeschlagen.
                <br />
                <em>
                  Gesamt: 100 € + {materialData.materialValue} € ={" "}
                  {100 + materialData.materialValue} €
                </em>
              </>
            ) : (
              <>
                Bei einer Fläche von 40 {currentService.unit} werden{" "}
                <strong>
                  {(40 * materialData.materialValue).toFixed(2)} €
                </strong>{" "}
                Material berechnet.
                <br />
                <em>
                  40 {currentService.unit} × {materialData.materialValue} €/
                  {currentService.unit} ={" "}
                  {(40 * materialData.materialValue).toFixed(2)} €
                </em>
              </>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        {/* Linke Buttons */}
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

        {/* Rechte Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleSaveAndNext}>
            {currentService?.materialOnboardingCompleted
              ? "💾 Änderungen speichern"
              : "Speichern & Weiter →"}
          </button>
          {allConfigured && (
            <button
              type="button"
              onClick={onComplete}
              style={{ background: "#28a745" }}
            >
              ✅ Abschließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
