import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchServices } from "../../store/slices/servicesSlice";
import {
  updateObjectById,
  updateObjectServices,
} from "../../store/slices/objectsSlice";

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
      // Prüfe ob "Shop Titel Leistung" oder "Shop Leistung" im serviceType enthalten ist
      return (
        s.serviceType.includes("Shop Titel Leistung") ||
        s.serviceType.includes("Shop Leistung")
      );
    });
  }, [services]);

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
    console.log("servicesLoading:", servicesLoading);
    if (services.length > 0) {
      console.log(
        "Alle Service-Typen:",
        services.map((s) => s.serviceType)
      );
      console.log(
        "Erste 5 Services:",
        services
          .slice(0, 5)
          .map((s) => ({ id: s.id, title: s.title, type: s.serviceType }))
      );
    } else {
      console.warn("⚠️ Keine Services in Redux State!");
    }
  }, [services, shopServices, servicesLoading]);

  const handleServiceToggle = (objectId, serviceId) => {
    console.log("handleServiceToggle:", { objectId, serviceId });
    const object = objects.find((obj) => obj.id === objectId);
    if (!object) {
      console.error("Objekt nicht gefunden:", objectId);
      return;
    }

    const currentServices = object.services || [];
    const isSelected = currentServices.includes(serviceId);
    console.log("Aktueller Status:", { isSelected, currentServices });

    // Berechne neue Services-Liste
    const newServices = isSelected
      ? currentServices.filter((id) => id !== serviceId)
      : [...currentServices, serviceId];

    console.log("Neue Services:", newServices);

    // 1. Optimistic Update: Aktualisiere sofort im Redux-State
    dispatch(updateObjectServices({ objectId, services: newServices }));

    // 2. Persistiere in Datenbank (im Hintergrund)
    dispatch(
      updateObjectById({
        id: objectId,
        updates: { services: newServices },
      })
    )
      .then((result) => {
        console.log("updateObjectById erfolgreich:", result);
      })
      .catch((error) => {
        console.error("Fehler bei updateObjectById:", error);
        // Bei Fehler: Rollback zum vorherigen State
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

  return (
    <div className="card">
      <h2>Leistungen zuweisen</h2>
      {objects.map((obj) => (
        <div
          key={obj.id}
          style={{
            marginBottom: "30px",
            padding: "15px",
            background: "#f9f9f9",
            borderRadius: "4px",
          }}
        >
          <h3>{obj.name}</h3>
          {shopServices.length === 0 ? (
            <p>
              Keine Leistungen verfügbar. Bitte laden Sie zuerst Leistungen.
            </p>
          ) : (
            <div>
              {shopServices.map((service) => {
                const isSelected = (obj.services || []).includes(service.id);
                const subServices = getSubServicesForService(service.id);
                return (
                  <div key={service.id} style={{ marginBottom: "15px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: isSelected ? "bold" : "normal",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleServiceToggle(obj.id, service.id)}
                      />
                      <span style={{ marginLeft: "8px" }}>{service.title}</span>
                    </label>

                    {/* Unterleistungen anzeigen wenn ausgewählt */}
                    {isSelected && subServices.length > 0 && (
                      <div
                        style={{
                          marginLeft: "28px",
                          marginTop: "8px",
                          padding: "10px",
                          background: "#e8f5e9",
                          borderRadius: "4px",
                          borderLeft: "3px solid #4CAF50",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#2e7d32",
                            marginBottom: "5px",
                            fontWeight: "bold",
                          }}
                        >
                          ✓ Enthaltene Unterleistungen:
                        </div>
                        {subServices.map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              fontSize: "13px",
                              color: "#555",
                              padding: "3px 0",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{ color: "#4CAF50", marginRight: "6px" }}
                            >
                              •
                            </span>
                            {sub.title}
                            {sub.variant && (
                              <span
                                style={{
                                  color: "#888",
                                  fontSize: "11px",
                                  marginLeft: "8px",
                                }}
                              >
                                ({sub.variant})
                              </span>
                            )}
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
  );
}
