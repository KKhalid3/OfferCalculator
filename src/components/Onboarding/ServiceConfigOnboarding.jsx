import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchServices,
  updateServiceConfig,
} from "../../store/slices/servicesSlice";
import { workflowPhases } from "../../data/servicesData";

/**
 * Umfassendes Leistungs-Onboarding
 * Konfiguriert für jede Haupt-Leistung:
 * - Zeitwerte (standardValuePerUnit, minTime, waitTime)
 * - Effizienzwerte (efficiencyStart, efficiencyCap, efficiencyStepPercent)
 * - Produktivität (maxProductivityPerDay)
 * - Material (materialType, materialValue)
 * - Unterleistungen (includedSubServices)
 */
export default function ServiceConfigOnboarding({ onComplete }) {
  const dispatch = useDispatch();
  const services = useSelector((state) => state.services.services);
  const loading = useSelector((state) => state.services.loading);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState({});
  const [selectedSubServices, setSelectedSubServices] = useState([]);

  // Alle Shop-Leistungen für das Onboarding (11 Stück erwartet)
  // Davon 3 gemischt: Malervlies, Raufaser, Tapeten entfernen (= auch Unterleistung)
  // NICHT "Shop Titel Leistung" - das sind nur Kategorien ohne Werte
  const mainServices = useMemo(() => {
    console.log(
      `🔄 mainServices useMemo: Berechne neu mit ${services.length} Services`
    );

    // Sicherheitscheck: Wenn zu wenige Services im State, könnte ein Problem vorliegen
    if (services.length < 20) {
      console.warn(
        `⚠️ Nur ${services.length} Services im State (erwartet mindestens 36)!`
      );
    }

    const filtered = services
      .filter((s) => {
        if (!s.serviceType) {
          console.warn(`⚠️ Service ohne serviceType: ${s.id} - ${s.title}`);
          return false;
        }
        // Alle "Shop Leistung" ohne "Titel"
        const isShopLeistung = s.serviceType.includes("Shop Leistung");
        const isTitelLeistung = s.serviceType.includes("Shop Titel Leistung");
        return isShopLeistung && !isTitelLeistung;
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    console.log(
      `🎨 Hauptleistungen: ${filtered.length} (erwartet: 11) aus ${services.length} total Services`
    );
    if (filtered.length > 0) {
      console.log(
        `🎨 Hauptleistungen:`,
        filtered.map((s) => `${s.title} (${s.serviceType})`)
      );
      const gemischte = filtered.filter((s) =>
        s.serviceType?.includes("Unterleistung Backend")
      );
      console.log(
        `🎨 Davon gemischt (📎): ${gemischte.length} (erwartet: 3)`,
        gemischte.map((s) => s.title)
      );
    } else if (services.length > 0) {
      console.error(
        `❌ KRITISCH: Keine Hauptleistungen gefunden, obwohl ${services.length} Services im State sind!`
      );
      console.log("🎨 Service-Typen:", [
        ...new Set(services.map((s) => s.serviceType)),
      ]);
    }
    return filtered;
  }, [services]);

  // Hilfsfunktion: Prüft ob Service auch Unterleistung ist (3 Stück: Malervlies, Raufaser, Tapeten entfernen)
  const isAlsoSubService = (service) => {
    return service?.serviceType?.includes("Unterleistung Backend");
  };

  // Alle Unterleistungen
  const subServices = useMemo(() => {
    return services
      .filter((s) => s.serviceType?.includes("Unterleistung Backend"))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [services]);

  const currentService = mainServices[currentIndex];

  useEffect(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  // Lade aktuelle Werte wenn Service wechselt
  useEffect(() => {
    if (currentService) {
      setFormData({
        // Zeitwerte
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
        materialValue: currentService.materialValue || 15,
        // Workflow-Reihenfolge
        workflowOrder: currentService.workflowOrder || 20,
        workflowPhase: currentService.workflowPhase || "beschichtung",
        // Stauberzeugung
        createsDust: currentService.createsDust || false,
        // Unterleistungs-Reihenfolge (nur relevant wenn diese Leistung eine Unterleistung ist)
        subWorkflowOrder: currentService.subWorkflowOrder || null,
        subWorkflowTotal: currentService.subWorkflowTotal || null,
        subWorkflowExplanation: currentService.subWorkflowExplanation || "",
      });

      // Lade bereits zugewiesene Unterleistungen
      // Prüfe includedSubServices ODER finde alle, die diese Leistung in includedIn haben
      const assignedSubs = currentService.includedSubServices || [];
      const implicitSubs = subServices
        .filter((sub) => sub.includedIn?.includes(currentService.id))
        .map((sub) => sub.id);

      setSelectedSubServices([...new Set([...assignedSubs, ...implicitSubs])]);
    }
  }, [currentService, subServices]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubServiceToggle = (subServiceId) => {
    setSelectedSubServices((prev) =>
      prev.includes(subServiceId)
        ? prev.filter((id) => id !== subServiceId)
        : [...prev, subServiceId]
    );
  };

  const handleSaveAndNext = async () => {
    if (!currentService) return;

    try {
      // Speichere alle Werte über Redux (aktualisiert auch den State!)
      await dispatch(
        updateServiceConfig({
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
            includedSubServices: selectedSubServices,
            // Workflow-Reihenfolge
            workflowOrder: formData.workflowOrder,
            workflowPhase: formData.workflowPhase,
            // Stauberzeugung
            createsDust: formData.createsDust,
            // Unterleistungs-Reihenfolge
            subWorkflowOrder: formData.subWorkflowOrder,
            subWorkflowTotal: formData.subWorkflowTotal,
            subWorkflowExplanation: formData.subWorkflowExplanation,
            configOnboardingCompleted: true,
            materialOnboardingCompleted: true,
          },
        })
      ).unwrap();

      console.log(
        `✅ Service ${currentService.id} gespeichert, gehe zu Index ${
          currentIndex + 1
        }`
      );

      // WICHTIG: Redux State wird bereits durch updateServiceConfig.fulfilled aktualisiert!
      // KEIN fetchServices() nötig - das würde den State möglicherweise mit zu wenigen Services überschreiben

      // Weiter zur nächsten Leistung
      const nextIndex = currentIndex + 1;
      if (nextIndex < mainServices.length) {
        setCurrentIndex(nextIndex);
      } else {
        // Alle Leistungen konfiguriert
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  const handleSkip = () => {
    if (currentIndex < mainServices.length - 1) {
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

  if (mainServices.length === 0) {
    return (
      <div className="card">
        <h2>✅ Keine Haupt-Leistungen gefunden</h2>
        <p>Es gibt keine Shop-Leistungen, die konfiguriert werden müssen.</p>
        {onComplete && (
          <button onClick={onComplete} style={{ marginTop: "20px" }}>
            Weiter →
          </button>
        )}
      </div>
    );
  }

  if (!currentService) {
    return null;
  }

  // Fortschritt
  const configuredCount = mainServices.filter(
    (s) => s.configOnboardingCompleted
  ).length;
  const progress = ((currentIndex + 1) / mainServices.length) * 100;

  return (
    <div
      className="card onboarding-card"
      style={{ maxWidth: "900px", margin: "0 auto" }}
    >
      {/* Header mit Fortschritt */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <span>
            Leistung {currentIndex + 1} von {mainServices.length}
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

        {/* Dropdown zur direkten Auswahl */}
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
            }}
          >
            {mainServices.map((service, index) => (
              <option key={service.id} value={index}>
                {service.configOnboardingCompleted ? "✅ " : "⚪ "}
                {index + 1}. {service.title} ({service.unit})
                {isAlsoSubService(service) ? " 📎" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leistungs-Header */}
      <h2
        style={{
          borderBottom: "2px solid #2196F3",
          paddingBottom: "10px",
          marginBottom: "20px",
        }}
      >
        🎨 {currentService.title}
        {isAlsoSubService(currentService) && (
          <span
            style={{
              fontSize: "12px",
              background: "#9C27B0",
              color: "white",
              padding: "3px 8px",
              borderRadius: "12px",
              marginLeft: "10px",
              verticalAlign: "middle",
            }}
          >
            + Unterleistung
          </span>
        )}
      </h2>
      <p style={{ color: "#666", marginBottom: "15px" }}>
        Einheit: <strong>{currentService.unit}</strong>
        {currentService.variant && (
          <span style={{ marginLeft: "15px" }}>
            Variante: {currentService.variant}
          </span>
        )}
      </p>

      {/* Hinweis für gemischte Services */}
      {isAlsoSubService(currentService) && (
        <div
          style={{
            background: "#F3E5F5",
            padding: "10px 15px",
            borderRadius: "8px",
            marginBottom: "15px",
            border: "1px solid #CE93D8",
            fontSize: "13px",
            color: "#6A1B9A",
          }}
        >
          📎 Diese Leistung ist{" "}
          <strong>sowohl eine Hauptleistung als auch eine Unterleistung</strong>{" "}
          und kann in anderen Leistungen enthalten sein.
        </div>
      )}

      {/* Default-Werte Hinweis */}
      <div
        style={{
          background: "#E8F5E9",
          padding: "12px 15px",
          borderRadius: "8px",
          marginBottom: "20px",
          border: "1px solid #A5D6A7",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span style={{ fontSize: "20px" }}>✨</span>
        <span style={{ fontSize: "14px", color: "#2E7D32" }}>
          <strong>Default-Werte aus Stammdaten geladen</strong> - Sie können
          diese anpassen oder übernehmen.
        </span>
      </div>

      {/* Zwei-Spalten-Layout */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}
      >
        {/* Linke Spalte: Zeitwerte & Effizienz */}
        <div>
          {/* Zeitwerte */}
          <div
            style={{
              background: "#e3f2fd",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#1565c0",
                fontSize: "16px",
              }}
            >
              ⏱️ Zeitwerte
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Zeit pro {currentService.unit}:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="standardValuePerUnit"
                  value={formData.standardValuePerUnit}
                  onChange={handleChange}
                  step="0.1"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>min/{currentService.unit}</span>
                <span style={{ fontSize: "12px", color: "#888" }}>
                  (Default: {currentService.standardValuePerUnit || 0})
                </span>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Mindestzeit pro Tag:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="minTime"
                  value={formData.minTime}
                  onChange={handleChange}
                  step="15"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>min</span>
                <span style={{ fontSize: "12px", color: "#888" }}>
                  (Default: {currentService.minTime || 0})
                </span>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Wartezeit (Trocknung):
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="waitTime"
                  value={formData.waitTime}
                  onChange={handleChange}
                  step="15"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>min</span>
                <span style={{ fontSize: "12px", color: "#888" }}>
                  (Default: {currentService.waitTime || 0})
                </span>
              </div>
            </div>
          </div>

          {/* Effizienz */}
          <div
            style={{
              background: "#e8f5e9",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#2e7d32",
                fontSize: "16px",
              }}
            >
              📈 Effizienz-Steigerung
            </h3>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Effizienz beginnt ab:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="efficiencyStart"
                  value={formData.efficiencyStart}
                  onChange={handleChange}
                  step="10"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>{currentService.unit}</span>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Maximum (Deckel) bei:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="efficiencyCap"
                  value={formData.efficiencyCap}
                  onChange={handleChange}
                  step="10"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>{currentService.unit}</span>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Steigerung pro 10 {currentService.unit}:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="efficiencyStepPercent"
                  value={formData.efficiencyStepPercent}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                  max="10"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* Produktivität */}
          <div
            style={{
              background: "#fff3e0",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#e65100",
                fontSize: "16px",
              }}
            >
              🏃 Max. Produktivität
            </h3>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Max. Einheiten pro Tag:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="maxProductivityPerDay"
                  value={formData.maxProductivityPerDay}
                  onChange={handleChange}
                  step="10"
                  min="0"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span>{currentService.unit}/Tag</span>
              </div>
            </div>
          </div>

          {/* Workflow-Reihenfolge */}
          <div
            style={{
              background: "#e3f2fd",
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#1565c0",
                fontSize: "16px",
              }}
            >
              🔢 Workflow-Reihenfolge
            </h3>
            <p
              style={{ fontSize: "12px", color: "#666", marginBottom: "15px" }}
            >
              Die Position dieser Leistung im Arbeitsablauf. Niedrigere Zahlen =
              früher im Ablauf.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Workflow-Position:
              </label>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="number"
                  name="workflowOrder"
                  value={formData.workflowOrder}
                  onChange={handleChange}
                  step="10"
                  min="1"
                  max="999"
                  style={{ width: "80px", padding: "8px" }}
                />
                <span style={{ fontSize: "12px", color: "#888" }}>
                  (Default: {currentService.workflowOrder || 20})
                </span>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "4px",
                }}
              >
                Phase:
              </label>
              <select
                name="workflowPhase"
                value={formData.workflowPhase}
                onChange={handleChange}
                style={{ width: "100%", padding: "8px" }}
              >
                {Object.entries(workflowPhases).map(([key, phase]) => (
                  <option key={key} value={key}>
                    {phase.icon} {phase.name} ({phase.range})
                  </option>
                ))}
              </select>
            </div>

            {currentService.workflowExplanation && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "8px",
                  background: "white",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#555",
                  borderLeft: "3px solid #1565c0",
                }}
              >
                💡 {currentService.workflowExplanation}
              </div>
            )}

            {/* Stauberzeugung */}
            <div
              style={{
                marginTop: "15px",
                padding: "12px",
                background: formData.createsDust ? "#fff3e0" : "white",
                borderRadius: "4px",
                border: formData.createsDust
                  ? "1px solid #ff9800"
                  : "1px solid #e0e0e0",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  name="createsDust"
                  checked={formData.createsDust || false}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      createsDust: e.target.checked,
                    }))
                  }
                  style={{ width: "18px", height: "18px" }}
                />
                <span style={{ fontSize: "14px", fontWeight: "500" }}>
                  🌫️ Erzeugt Staub
                </span>
              </label>
              <p
                style={{
                  fontSize: "11px",
                  color: "#666",
                  margin: "8px 0 0 28px",
                }}
              >
                Stauberzeugende Arbeiten dürfen nicht während Trocknungsphasen
                (z.B. Lackierung) im gleichen Raum ausgeführt werden.
              </p>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: Material & Unterleistungen */}
        <div>
          {/* Material */}
          <div
            style={{
              background: "#fce4ec",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#c2185b",
                fontSize: "16px",
              }}
            >
              📦 Material-Zuschlag
            </h3>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="materialType"
                  value="none"
                  checked={formData.materialType === "none"}
                  onChange={handleChange}
                  style={{ marginRight: "8px" }}
                />
                <span>Kein Material</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="materialType"
                  value="percent"
                  checked={formData.materialType === "percent"}
                  onChange={handleChange}
                  style={{ marginRight: "8px" }}
                />
                <span>Prozent auf Lohnkosten</span>
                {formData.materialType === "percent" && (
                  <div
                    style={{
                      marginLeft: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      type="number"
                      name="materialValue"
                      value={formData.materialValue}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      style={{ width: "60px", padding: "4px" }}
                    />
                    <span>%</span>
                  </div>
                )}
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="materialType"
                  value="fixed"
                  checked={formData.materialType === "fixed"}
                  onChange={handleChange}
                  style={{ marginRight: "8px" }}
                />
                <span>Fester Betrag pro {currentService.unit}</span>
                {formData.materialType === "fixed" && (
                  <div
                    style={{
                      marginLeft: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <input
                      type="number"
                      name="materialValue"
                      value={formData.materialValue}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      style={{ width: "60px", padding: "4px" }}
                    />
                    <span>€/{currentService.unit}</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Unterleistungen */}
          <div
            style={{
              background: "#f3e5f5",
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <h3
              style={{
                margin: "0 0 15px 0",
                color: "#7b1fa2",
                fontSize: "16px",
              }}
            >
              📎 Enthaltene Unterleistungen
            </h3>
            <p
              style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}
            >
              Welche Unterleistungen sind automatisch in dieser Leistung
              enthalten?
            </p>

            <div
              style={{
                maxHeight: "250px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "white",
              }}
            >
              {subServices.map((sub) => {
                const isSelected = selectedSubServices.includes(sub.id);
                const wasOriginallyIncluded = sub.includedIn?.includes(
                  currentService.id
                );

                return (
                  <label
                    key={sub.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                      background: isSelected ? "#f3e5f5" : "white",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSubServiceToggle(sub.id)}
                      style={{ marginRight: "10px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontWeight: isSelected ? "bold" : "normal" }}
                      >
                        {sub.title}
                      </div>
                      {sub.variant && (
                        <div style={{ fontSize: "11px", color: "#888" }}>
                          {sub.variant}
                        </div>
                      )}
                    </div>
                    {wasOriginallyIncluded && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#e8f5e9",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          color: "#2e7d32",
                        }}
                      >
                        Default
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
              {selectedSubServices.length} Unterleistung(en) ausgewählt
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div
        style={{
          marginTop: "30px",
          display: "flex",
          justifyContent: "space-between",
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
            style={{ background: "#9e9e9e" }}
          >
            Überspringen
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleSaveAndNext}>
            {currentIndex < mainServices.length - 1
              ? "Speichern & Weiter →"
              : "Speichern & Abschließen ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
