import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createObject,
  deleteObjectById,
  updateObjectById,
} from "../../store/slices/objectsSlice";
import {
  OBJECT_TYPES,
  ROOM_SHAPES,
  WINDOW_SIZES,
  DOOR_TYPES,
  DOOR_SIZES,
  OBJECT_CATEGORIES,
} from "../../constants";

export default function ObjectSelector() {
  const dispatch = useDispatch();
  const objects = useSelector((state) => state.objects.objects);
  const loading = useSelector((state) => state.objects.loading);

  const [objectCategory, setObjectCategory] = useState("raum");

  const [formData, setFormData] = useState({
    // Raum-Felder
    name: "",
    type: "Wohnzimmer",
    floorArea: "",
    height: "2.5",
    roomShape: "standard",
    // Fenster-Felder
    windowSize: "mittel",
    windowCount: "1",
    windowLocation: "innen",
    // Tür-Felder
    doorType: "zimmertuer",
    doorSize: "einfach",
    doorCount: "1",
    doorLocation: "innen",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (objectCategory === "raum") {
      if (!formData.name || !formData.floorArea) {
        alert("Bitte füllen Sie alle Felder aus");
        return;
      }

      // Raumform-Faktor für Umfangberechnung
      const shapeConfig =
        ROOM_SHAPES.find((s) => s.id === formData.roomShape) || ROOM_SHAPES[0];

      dispatch(
        createObject({
          name: formData.name,
          type: formData.type,
          objectCategory: "raum",
          floorArea: parseFloat(formData.floorArea),
          height: parseFloat(formData.height),
          roomShape: formData.roomShape,
          roomShapeFactor: shapeConfig.factor,
          services: [],
          specialNotes: [],
        })
      );
    } else if (objectCategory === "fenster") {
      if (!formData.name) {
        alert("Bitte geben Sie einen Namen ein");
        return;
      }

      const windowSizeConfig =
        WINDOW_SIZES.find((s) => s.id === formData.windowSize) ||
        WINDOW_SIZES[1];

      dispatch(
        createObject({
          name: formData.name,
          type: "Fenster",
          objectCategory: "fenster",
          windowSize: formData.windowSize,
          windowSizeLabel: windowSizeConfig.name,
          windowMaxArea: windowSizeConfig.maxArea,
          windowCount: parseInt(formData.windowCount) || 1,
          windowLocation: formData.windowLocation,
          unit: "Stk",
          services: [],
          specialNotes: [],
        })
      );
    } else if (objectCategory === "tuer") {
      if (!formData.name) {
        alert("Bitte geben Sie einen Namen ein");
        return;
      }

      const doorTypeConfig =
        DOOR_TYPES.find((t) => t.id === formData.doorType) || DOOR_TYPES[0];
      const doorSizeConfig =
        DOOR_SIZES.find((s) => s.id === formData.doorSize) || DOOR_SIZES[0];

      dispatch(
        createObject({
          name: formData.name,
          type: "Tür",
          objectCategory: "tuer",
          doorType: formData.doorType,
          doorTypeLabel: doorTypeConfig.name,
          doorTimeFactor: doorTypeConfig.timeFactor,
          doorSize: formData.doorSize,
          doorSizeLabel: doorSizeConfig.name,
          doorSizeFactor: doorSizeConfig.sizeFactor,
          doorCount: parseInt(formData.doorCount) || 1,
          doorLocation: formData.doorLocation,
          unit: "Stk",
          services: [],
          specialNotes: [],
        })
      );
    }

    // Formular zurücksetzen
    setFormData({
      name: "",
      type: "Wohnzimmer",
      floorArea: "",
      height: "2.5",
      roomShape: "standard",
      windowSize: "mittel",
      windowCount: "1",
      windowLocation: "innen",
      doorType: "zimmertuer",
      doorSize: "einfach",
      doorCount: "1",
      doorLocation: "innen",
    });
  };

  const handleDelete = (id) => {
    if (window.confirm("Möchten Sie dieses Objekt wirklich löschen?")) {
      dispatch(deleteObjectById(id));
    }
  };

  if (loading) {
    return <div className="loading">Lade Objekte...</div>;
  }

  return (
    <div className="card">
      <h2>Objekte hinzufügen</h2>

      {/* Objektkategorie-Auswahl */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "2px solid #e0e0e0",
          paddingBottom: "15px",
        }}
      >
        {OBJECT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setObjectCategory(cat.id)}
            style={{
              padding: "10px 20px",
              border:
                objectCategory === cat.id
                  ? "2px solid #1976d2"
                  : "1px solid #ccc",
              borderRadius: "8px",
              background: objectCategory === cat.id ? "#e3f2fd" : "white",
              color: "#333", // Schwarzer Text
              cursor: "pointer",
              fontWeight: objectCategory === cat.id ? "bold" : "normal",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "18px" }}>{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Objektname:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={
              objectCategory === "raum"
                ? "z.B. Wohnzimmer"
                : objectCategory === "fenster"
                ? "z.B. Fenster Küche"
                : "z.B. Eingangstür"
            }
            required
          />
        </div>

        {/* Raum-spezifische Felder */}
        {objectCategory === "raum" && (
          <>
            <div className="form-group">
              <label>Raumtyp:</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
              >
                {OBJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Grundfläche (m²):</label>
              <input
                type="number"
                step="0.1"
                value={formData.floorArea}
                onChange={(e) =>
                  setFormData({ ...formData, floorArea: e.target.value })
                }
                placeholder="z.B. 25"
                required
              />
            </div>

            <div className="form-group">
              <label>Raumhöhe (m):</label>
              <input
                type="number"
                step="0.1"
                value={formData.height}
                onChange={(e) =>
                  setFormData({ ...formData, height: e.target.value })
                }
                placeholder="z.B. 2.5"
                required
              />
            </div>

            <div className="form-group">
              <label>Raumform:</label>
              <select
                value={formData.roomShape}
                onChange={(e) =>
                  setFormData({ ...formData, roomShape: e.target.value })
                }
              >
                {ROOM_SHAPES.map((shape) => (
                  <option key={shape.id} value={shape.id}>
                    {shape.name}{" "}
                    {shape.factor !== 1.0
                      ? `(+${Math.round((shape.factor - 1) * 100)}% Umfang)`
                      : ""}
                  </option>
                ))}
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                L-förmige Räume haben bei gleicher Grundfläche mehr Wandfläche
              </small>
            </div>
          </>
        )}

        {/* Fenster-spezifische Felder */}
        {objectCategory === "fenster" && (
          <>
            <div className="form-group">
              <label>Fenstergröße:</label>
              <select
                value={formData.windowSize}
                onChange={(e) =>
                  setFormData({ ...formData, windowSize: e.target.value })
                }
              >
                {WINDOW_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                Die Größe bestimmt den Zeitaufwand pro Stück
              </small>
            </div>

            <div className="form-group">
              <label>Anzahl (Stück):</label>
              <input
                type="number"
                min="1"
                value={formData.windowCount}
                onChange={(e) =>
                  setFormData({ ...formData, windowCount: e.target.value })
                }
                placeholder="z.B. 2"
                required
              />
            </div>

            <div className="form-group">
              <label>Seite:</label>
              <select
                value={formData.windowLocation}
                onChange={(e) =>
                  setFormData({ ...formData, windowLocation: e.target.value })
                }
              >
                <option value="innen">Innen</option>
                <option value="aussen">Außen</option>
                <option value="beide">Beide Seiten</option>
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                Außenfenster benötigen wetterfesten Lack
              </small>
            </div>
          </>
        )}

        {/* Tür-spezifische Felder */}
        {objectCategory === "tuer" && (
          <>
            <div className="form-group">
              <label>Türtyp:</label>
              <select
                value={formData.doorType}
                onChange={(e) =>
                  setFormData({ ...formData, doorType: e.target.value })
                }
              >
                {DOOR_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                Haustüren benötigen mehr Zeit als Zimmertüren
              </small>
            </div>

            <div className="form-group">
              <label>Türgröße:</label>
              <select
                value={formData.doorSize}
                onChange={(e) =>
                  setFormData({ ...formData, doorSize: e.target.value })
                }
          >
                {DOOR_SIZES.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.name}
                  </option>
                ))}
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                Doppelflügelige Türen benötigen ca. 80% mehr Zeit
              </small>
            </div>

            <div className="form-group">
              <label>Anzahl (Stück):</label>
              <input
                type="number"
                min="1"
                value={formData.doorCount}
                onChange={(e) =>
                  setFormData({ ...formData, doorCount: e.target.value })
                }
                placeholder="z.B. 2"
                required
              />
            </div>

            <div className="form-group">
              <label>Seite:</label>
              <select
                value={formData.doorLocation}
                onChange={(e) =>
                  setFormData({ ...formData, doorLocation: e.target.value })
                }
              >
                <option value="innen">Innen</option>
                <option value="aussen">Außen</option>
                <option value="beide">Beide Seiten</option>
              </select>
              <small
                style={{ color: "#666", display: "block", marginTop: "4px" }}
              >
                Außentüren benötigen wetterfesten Lack
              </small>
          </div>
          </>
        )}

        <button type="submit">
          {objectCategory === "raum"
            ? "🏠 Raum hinzufügen"
            : objectCategory === "fenster"
            ? "🪟 Fenster hinzufügen"
            : "🚪 Tür hinzufügen"}
        </button>
      </form>

      <div style={{ marginTop: "30px" }}>
        <h3>Hinzugefügte Objekte ({objects.length})</h3>
        {objects.length === 0 ? (
          <p>Noch keine Objekte hinzugefügt</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {objects.map((obj) => (
              <li
                key={obj.id}
                style={{
                  padding: "10px",
                  marginBottom: "10px",
                  background:
                    obj.objectCategory === "fenster"
                      ? "#e3f2fd"
                      : obj.objectCategory === "tuer"
                      ? "#f3e5f5"
                      : "#f9f9f9",
                  borderRadius: "4px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft:
                    obj.objectCategory === "fenster"
                      ? "4px solid #1976d2"
                      : obj.objectCategory === "tuer"
                      ? "4px solid #7b1fa2"
                      : "none",
                }}
              >
                <div>
                  {/* Raum-Anzeige */}
                  {(!obj.objectCategory || obj.objectCategory === "raum") && (
                    <>
                      <strong>🏠 {obj.name}</strong> ({obj.type}) -{" "}
                      {obj.floorArea} m², Höhe: {obj.height} m
                      {obj.roomShape === "l_shape" && (
                        <span style={{ color: "#1976d2", marginLeft: "8px" }}>
                          📐 L-förmig
                        </span>
                      )}
                    </>
                  )}

                  {/* Fenster-Anzeige */}
                  {obj.objectCategory === "fenster" && (
                    <>
                      <strong>🪟 {obj.name}</strong>
                      <span style={{ marginLeft: "10px", color: "#666" }}>
                        {obj.windowCount}× {obj.windowSizeLabel}
                      </span>
                      <span
                        style={{
                          marginLeft: "10px",
                          padding: "2px 8px",
                          background:
                            obj.windowLocation === "aussen"
                              ? "#ffecb3"
                              : "#c8e6c9",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                      >
                        {obj.windowLocation === "innen"
                          ? "Innen"
                          : obj.windowLocation === "aussen"
                          ? "Außen"
                          : "Beide Seiten"}
                      </span>
                    </>
                  )}

                  {/* Tür-Anzeige */}
                  {obj.objectCategory === "tuer" && (
                    <>
                      <strong>🚪 {obj.name}</strong>
                      <span style={{ marginLeft: "10px", color: "#666" }}>
                        {obj.doorCount}× {obj.doorTypeLabel}
                      </span>
                      <span
                        style={{
                          marginLeft: "10px",
                          padding: "2px 8px",
                          background: "#e1bee7",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                      >
                        {obj.doorSizeLabel}
                      </span>
                      <span
                        style={{
                          marginLeft: "10px",
                          padding: "2px 8px",
                          background:
                            obj.doorLocation === "aussen"
                              ? "#ffecb3"
                              : "#c8e6c9",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                      >
                        {obj.doorLocation === "innen"
                          ? "Innen"
                          : obj.doorLocation === "aussen"
                          ? "Außen"
                          : "Beide Seiten"}
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(obj.id)}
                  style={{ background: "#dc3545" }}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
