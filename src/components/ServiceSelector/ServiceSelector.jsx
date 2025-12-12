import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchServices } from "../../store/slices/servicesSlice";
import {
  updateObjectById,
  updateObjectServices,
} from "../../store/slices/objectsSlice";

/**
 * Bestimmt, welche Fenster-Services für eine gegebene Fenstergröße und -seite relevant sind
 */
function getRelevantWindowServices(windowSize, windowLocation, allServices) {
  // Mapping von Fenstergröße zu Service-Suffix
  const sizeMapping = {
    klein: "_klein",
    mittel: "", // Mittel hat keinen Suffix (Standardgröße)
    gross: "_gross",
  };

  const sizeSuffix = sizeMapping[windowSize] || "";

  // Filtere nach Fenster-Services
  return allServices.filter((s) => {
    if (!s.id.includes("fensterfluegel")) return false;

    // Prüfe Größe
    if (sizeSuffix === "") {
      // Mittel: Nur Services ohne _klein oder _gross Suffix
      if (s.id.includes("_klein") || s.id.includes("_gross")) return false;
    } else {
      // Klein oder Groß: Muss den entsprechenden Suffix haben
      if (!s.id.includes(sizeSuffix)) return false;
    }

    // Prüfe Seite (innen/außen)
    if (windowLocation === "innen") {
      return s.id.includes("_innen") && !s.id.includes("_aussen");
    } else if (windowLocation === "aussen") {
      return s.id.includes("_aussen");
    } else if (windowLocation === "beide") {
      // Beide Seiten: Zeige sowohl innen als auch außen
      return s.id.includes("_innen") || s.id.includes("_aussen");
    }

    return true;
  });
}

export default function ServiceSelector() {
  const dispatch = useDispatch();
  const objects = useSelector((state) => state.objects.objects);
  const services = useSelector((state) => state.services.services);
  const servicesLoading = useSelector((state) => state.services.loading);

  useEffect(() => {
    dispatch(fetchServices());
  }, [dispatch]);

  // Nur Shop-Leistungen anzeigen (keine reinen Unterleistungen)
  const shopServices = useMemo(() => {
    return services.filter((s) => {
      if (!s.serviceType) return false;
      return (
        s.serviceType.includes("Shop Titel Leistung") ||
        s.serviceType.includes("Shop Leistung")
      );
    });
  }, [services]);

  // Raum-Services (keine Fenster/Türen-Leistungen)
  const roomServices = useMemo(() => {
    return shopServices.filter((s) => {
      // Schließe Fenster- und Tür-Services aus
      return !s.id.includes("fensterfluegel") && !s.id.includes("tuerfluegel");
    });
  }, [shopServices]);

  // Fenster-Services
  const windowServices = useMemo(() => {
    return shopServices.filter((s) => s.id.includes("fensterfluegel"));
  }, [shopServices]);

  // Finde Unterleistungen für eine gegebene Service-ID
  const getSubServicesForService = (serviceId) => {
    return services.filter(
      (s) =>
        s.includedIn &&
        s.includedIn.includes(serviceId) &&
        s.serviceType === "Unterleistung Backend"
    );
  };

  // Debug: Log services
  useEffect(() => {
    console.log("=== ServiceSelector Debug ===");
    console.log("Services in Redux:", services.length);
    console.log("Shop Services gefiltert:", shopServices.length);
    console.log("Raum-Services:", roomServices.length);
    console.log("Fenster-Services:", windowServices.length);
  }, [services, shopServices, roomServices, windowServices]);

  const handleServiceToggle = (objectId, serviceId) => {
    const object = objects.find((obj) => obj.id === objectId);
    if (!object) {
      console.error("Objekt nicht gefunden:", objectId);
      return;
    }

    const currentServices = object.services || [];
    const isSelected = currentServices.includes(serviceId);

    const newServices = isSelected
      ? currentServices.filter((id) => id !== serviceId)
      : [...currentServices, serviceId];

    // Optimistic Update
    dispatch(updateObjectServices({ objectId, services: newServices }));

    // Persistiere in Datenbank
    dispatch(
      updateObjectById({
        id: objectId,
        updates: { services: newServices },
      })
    ).catch((error) => {
      console.error("Fehler bei updateObjectById:", error);
      dispatch(updateObjectServices({ objectId, services: currentServices }));
    });
  };

  if (servicesLoading) {
    return <div className="loading">Lade Leistungen...</div>;
  }

  if (objects.length === 0) {
    return (
      <div className="card">
        <p>Bitte fügen Sie zuerst ein Objekt hinzu.</p>
      </div>
    );
  }

  // Trenne Objekte nach Kategorie
  const roomObjects = objects.filter(
    (obj) => !obj.objectCategory || obj.objectCategory === "raum"
  );
  const windowObjects = objects.filter(
    (obj) => obj.objectCategory === "fenster"
  );

  return (
    <div className="card">
      <h2>Leistungen zuweisen</h2>

      {/* Raum-Objekte */}
      {roomObjects.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h3
            style={{
              fontSize: "14px",
              color: "#666",
              borderBottom: "1px solid #ddd",
              paddingBottom: "8px",
              marginBottom: "15px",
            }}
          >
            🏠 Räume
          </h3>

          {roomObjects.map((obj) => (
            <div
              key={obj.id}
              style={{
                marginBottom: "20px",
                padding: "15px",
                background: "#f9f9f9",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0" }}>
                {obj.name}{" "}
                <span style={{ color: "#888", fontSize: "13px" }}>
                  ({obj.type})
                </span>
              </h4>

              {roomServices.length === 0 ? (
                <p>Keine Leistungen verfügbar.</p>
              ) : (
                <div>
                  {roomServices.map((service) => {
                    const isSelected = (obj.services || []).includes(
                      service.id
                    );
                    const subServices = getSubServicesForService(service.id);
                    return (
                      <div key={service.id} style={{ marginBottom: "10px" }}>
                        <label
                          style={{
                            display: "block",
                            fontWeight: isSelected ? "bold" : "normal",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              handleServiceToggle(obj.id, service.id)
                            }
                          />
                          <span style={{ marginLeft: "8px" }}>
                            {service.title}
                          </span>
                          <span
                            style={{
                              marginLeft: "8px",
                              color: "#888",
                              fontSize: "12px",
                            }}
                          >
                            ({service.unit})
                          </span>
                        </label>

                        {isSelected && subServices.length > 0 && (
                          <div
                            style={{
                              marginLeft: "28px",
                              marginTop: "6px",
                              padding: "8px",
                              background: "#e8f5e9",
                              borderRadius: "4px",
                              borderLeft: "3px solid #4CAF50",
                              fontSize: "12px",
                            }}
                          >
                            <div
                              style={{
                                color: "#2e7d32",
                                marginBottom: "4px",
                                fontWeight: "bold",
                              }}
                            >
                              ✓ Enthaltene Unterleistungen:
                            </div>
                            {subServices.map((sub) => (
                              <div
                                key={sub.id}
                                style={{ color: "#555", padding: "2px 0" }}
                              >
                                • {sub.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fenster-Objekte */}
      {windowObjects.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "14px",
              color: "#1976d2",
              borderBottom: "1px solid #bbdefb",
              paddingBottom: "8px",
              marginBottom: "15px",
            }}
          >
            🪟 Fenster
          </h3>

          {windowObjects.map((obj) => {
            // Relevante Fenster-Services für dieses Fenster-Objekt
            const relevantServices = getRelevantWindowServices(
              obj.windowSize || "mittel",
              obj.windowLocation || "innen",
              windowServices
            );

            return (
              <div
                key={obj.id}
                style={{
                  marginBottom: "20px",
                  padding: "15px",
                  background: "#e3f2fd",
                  borderRadius: "4px",
                  borderLeft: "4px solid #1976d2",
                }}
              >
                <h4 style={{ margin: "0 0 10px 0" }}>
                  {obj.name}
                  <span
                    style={{
                      color: "#666",
                      fontSize: "12px",
                      marginLeft: "10px",
                    }}
                  >
                    {obj.windowCount || 1}× {obj.windowSizeLabel || "Mittel"}
                  </span>
                  <span
                    style={{
                      marginLeft: "8px",
                      padding: "2px 8px",
                      background:
                        obj.windowLocation === "aussen" ? "#ffecb3" : "#c8e6c9",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                  >
                    {obj.windowLocation === "innen"
                      ? "Innen"
                      : obj.windowLocation === "aussen"
                      ? "Außen"
                      : "Beide Seiten"}
                  </span>
                </h4>

                {relevantServices.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "13px" }}>
                    Keine passenden Fenster-Leistungen gefunden.
                  </p>
                ) : (
                  <div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "10px",
                      }}
                    >
                      📋 Passende Leistungen für{" "}
                      {obj.windowSizeLabel || "mittlere"} Fenster (
                      {obj.windowLocation || "innen"}):
                    </p>
                    {relevantServices.map((service) => {
                      const isSelected = (obj.services || []).includes(
                        service.id
                      );
                      const subServices = getSubServicesForService(service.id);
                      return (
                        <div key={service.id} style={{ marginBottom: "10px" }}>
                          <label
                            style={{
                              display: "block",
                              fontWeight: isSelected ? "bold" : "normal",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                handleServiceToggle(obj.id, service.id)
                              }
                            />
                            <span style={{ marginLeft: "8px" }}>
                              {service.title}
                            </span>
                            <span
                              style={{
                                marginLeft: "8px",
                                color: "#888",
                                fontSize: "12px",
                              }}
                            >
                              ({service.unit})
                            </span>
                          </label>

                          {isSelected && subServices.length > 0 && (
                            <div
                              style={{
                                marginLeft: "28px",
                                marginTop: "6px",
                                padding: "8px",
                                background: "#fff",
                                borderRadius: "4px",
                                borderLeft: "3px solid #1976d2",
                                fontSize: "12px",
                              }}
                            >
                              <div
                                style={{
                                  color: "#1565c0",
                                  marginBottom: "4px",
                                  fontWeight: "bold",
                                }}
                              >
                                ✓ Enthaltene Schritte:
                              </div>
                              {subServices.map((sub) => (
                                <div
                                  key={sub.id}
                                  style={{ color: "#555", padding: "2px 0" }}
                                >
                                  • {sub.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {roomObjects.length === 0 && windowObjects.length === 0 && (
        <p>
          Keine Objekte vorhanden. Bitte fügen Sie zuerst Räume oder Fenster
          hinzu.
        </p>
      )}
    </div>
  );
}
