import React, { useState, useRef } from "react";
import { formatTime, formatClock } from "./utils/timeFormatters";
import { useDayPlanning } from "./hooks/useDayPlanning";
import { exportDayPlanningToPDF } from "./services/pdfExportService";
import {
  getEmployeesForDay,
  getRoomsForDay,
  getEmployeeUtilization,
} from "./utils/dayPlanningHelpers";
import TaskTooltip from "./components/TaskTooltip";

export default function DayPlanningDialog({
  results,
  customerApproval,
  companySettings,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printContentRef = useRef(null);
  
  // State für Custom Tooltip
  const [hoveredTask, setHoveredTask] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Verwende Custom Hook für Planungslogik
  const detailedPlan = useDayPlanning(results, customerApproval, companySettings);

  // PDF Export
  const handleExportPDF = async (preview = false) => {
    setIsExporting(true);
    try {
      await exportDayPlanningToPDF({
        detailedPlan,
        results,
        companySettings,
        customerApproval,
        preview,
      });
    } catch (error) {
      console.error("PDF Export fehlgeschlagen:", error);
      alert("PDF Export fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setIsExporting(false);
    }
  };

  // Wrapper-Funktionen für Helper-Funktionen (mit companySettings)
  const getEmployeesForDayWrapper = (day) => {
    return getEmployeesForDay(day, companySettings);
  };

  const getEmployeeUtilizationWrapper = (day) => {
    return getEmployeeUtilization(day, companySettings);
  };

  // Helper-Funktion für Task-Farben (global verfügbar für Tooltip)
  const getTaskColor = (task) => {
    // Verwende eindeutige Task-ID für konsistente Farbzuweisung
    const uniqueId =
      task.id ||
      `${task.serviceId || task.serviceName}-${
        task.objectId || "unknown"
      }`;

    // Spezielle Farben für Projekt-Tasks
    if (task.objectId === "project")
      return "#607D8B"; // Grau für Baustelle
    if (task.objectId === "project-end")
      return "#9E9E9E"; // Grau für Räumung

    // Generiere Hash aus eindeutiger ID
    const hash = uniqueId
      .split("")
      .reduce((acc, char) => {
        return (
          char.charCodeAt(0) + ((acc << 5) - acc)
        );
      }, 0);

    // Erweiterte Farbpalette für bessere Unterscheidung
    const colors = [
      "#1976d2", // Blau
      "#388e3c", // Grün
      "#7b1fa2", // Lila
      "#ff9800", // Orange
      "#00796b", // Teal
      "#d32f2f", // Rot
      "#c2185b", // Pink
      "#512da8", // Dunkel-Lila
      "#0288d1", // Hellblau
      "#689f38", // Hellgrün
      "#f57c00", // Dunkelorange
      "#5d4037", // Braun
      "#455a64", // Blaugrau
      "#7b1fa2", // Violett
      "#c2185b", // Magenta
      "#303f9f", // Indigo
      "#00796b", // Türkis
      "#e64a19", // Rotorange
      "#5e35b1", // Tiefviolett
      "#00897b", // Mint
      "#d84315", // Tiefrot
      "#6a1b9a", // Purpur
      "#0277bd", // Azurblau
      "#2e7d32", // Waldgrün
      "#e91e63", // Pink
      "#795548", // Kaffeebraun
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  if (!results?.objects?.length) return null;

  // WICHTIG: Tagesanzahl aus detailedPlan nehmen (tatsächliche Anzahl der geplanten Tage)
  // nicht aus results.totalDays, da das möglicherweise veraltet ist
  const totalDays =
    detailedPlan.summary.totalDays ||
    detailedPlan.days.length ||
    results.totalDays ||
    1;
  const optimalEmployees = results.optimalEmployees || 1;
  const totalTime = results.totalTime || 0;
  const totalWaitTime = detailedPlan.summary.totalWaitTime || 0;

  return (
    <>
      {/* Container über "Transparente Preisübersicht" */}
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          background: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "15px",
          }}
        >
          <div>
            <h3
              style={{ margin: "0 0 5px 0", fontSize: "16px", color: "#333" }}
            >
              Detaillierte Tagesplanung
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
              Ablaufplan mit Arbeitszeiten, Trocknungszeiten und Wartezeiten
            </p>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "500",
              background: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Ablaufplan anzeigen
          </button>
        </div>

        {/* Übersicht - gleiche Werte wie in Preisübersicht */}
        <div
          style={{
            display: "flex",
            gap: "30px",
            marginTop: "15px",
            paddingTop: "15px",
            borderTop: "1px solid #e0e0e0",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{ fontSize: "20px", fontWeight: "bold", color: "#333" }}
            >
              {totalDays}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              Arbeitstag{totalDays !== 1 ? "e" : ""}
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: "20px", fontWeight: "bold", color: "#333" }}
            >
              {optimalEmployees}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Mitarbeiter</div>
            {/* Mitarbeiter-Legende wenn mehr als 1 */}
            {optimalEmployees > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "4px",
                  flexWrap: "wrap",
                }}
              >
                {Array.from({ length: optimalEmployees }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      background:
                        i === 0
                          ? "#1976d2"
                          : i === 1
                          ? "#388e3c"
                          : i === 2
                          ? "#7b1fa2"
                          : "#ff9800",
                      color: "white",
                      padding: "1px 4px",
                      borderRadius: "3px",
                      fontSize: "9px",
                    }}
                  >
                    MA {i + 1}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div
              style={{ fontSize: "20px", fontWeight: "bold", color: "#333" }}
            >
              {formatTime(totalTime)}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Gesamtzeit</div>
          </div>
          {totalWaitTime > 0 && (
            <div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#e65100",
                }}
              >
                {formatTime(totalWaitTime)}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                Trocknungszeit
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid #e0e0e0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "white",
                zIndex: 10,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#333" }}>
                  Detaillierter Ablaufplan
                </h2>
                <p
                  style={{ margin: "5px 0 0", fontSize: "13px", color: "#666" }}
                >
                  Tagesplanung mit Arbeits-, Warte- und Trocknungszeiten
                </p>
              </div>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                {/* PDF Vorschau Button */}
                <button
                  onClick={() => handleExportPDF(true)}
                  disabled={isExporting}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: "500",
                    background: isExporting ? "#ccc" : "#fff",
                    color: "#1976d2",
                    border: "1px solid #1976d2",
                    borderRadius: "4px",
                    cursor: isExporting ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  👁️ Vorschau
                </button>
                {/* PDF Download Button */}
                <button
                  onClick={() => handleExportPDF(false)}
                  disabled={isExporting}
                  style={{
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: "500",
                    background: isExporting ? "#ccc" : "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: isExporting ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {isExporting ? "⏳ Erstelle..." : "📄 PDF Download"}
                </button>
                {/* Schließen Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "none",
                    border: "1px solid #ddd",
                    color: "#666",
                    width: "32px",
                    height: "32px",
                    borderRadius: "4px",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content - mit ref für PDF Export */}
            <div
              ref={printContentRef}
              style={{ padding: "20px", backgroundColor: "#fff" }}
            >
              {/* Zusammenfassung oben */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "15px",
                  marginBottom: "25px",
                  padding: "15px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#333",
                    }}
                  >
                    {totalDays}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Arbeitstag{totalDays !== 1 ? "e" : ""}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#333",
                    }}
                  >
                    {optimalEmployees}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Mitarbeiter
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#333",
                    }}
                  >
                    {formatTime(totalTime)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Arbeitszeit
                  </div>
                </div>
                {totalWaitTime > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#e65100",
                      }}
                    >
                      {formatTime(totalWaitTime)}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Trocknungszeit
                    </div>
                  </div>
                )}
              </div>

              {/* Tagesübersicht */}
              {detailedPlan.days.map((day) => (
                <div
                  key={day.dayNumber}
                  style={{
                    marginBottom: "20px",
                    border: "1px solid #e0e0e0",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  {/* Tag Header */}
                  <div
                    style={{
                      background: "#f5f5f5",
                      padding: "12px 15px",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <h3
                        style={{ margin: 0, fontSize: "15px", color: "#333" }}
                      >
                        Tag {day.dayNumber}
                      </h3>
                      {/* Auslastungs-Badge */}
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontWeight: "500",
                          background:
                            day.utilization >= 80
                              ? "#e8f5e9"
                              : day.utilization >= 60
                              ? "#fff3e0"
                              : "#ffebee",
                          color:
                            day.utilization >= 80
                              ? "#2e7d32"
                              : day.utilization >= 60
                              ? "#ef6c00"
                              : "#c62828",
                        }}
                      >
                        {day.utilization}% ausgelastet
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "15px",
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      <span>Arbeit: {formatTime(day.totalWorkTime)}</span>
                      {day.hasOvertime && day.overtimeMinutes > 0 && (
                        <span style={{ color: "#1565c0", fontWeight: "500" }}>
                          (+{formatTime(day.overtimeMinutes)} Überstunden)
                        </span>
                      )}
                      {day.totalWaitTime > 0 && (
                        <span style={{ color: "#e65100" }}>
                          Trocknung: {formatTime(day.totalWaitTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SCHRITT 3: MITARBEITER-AUSLASTUNG ANZEIGEN */}
                  {(() => {
                    const employeeUtil = getEmployeeUtilizationWrapper(day);
                    if (employeeUtil.length > 0) {
                      return (
                        <div
                          style={{
                            padding: "10px 15px",
                            background: "#f9f9f9",
                            borderBottom: "1px solid #e0e0e0",
                            fontSize: "12px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "600",
                              marginBottom: "8px",
                              color: "#333",
                            }}
                          >
                            👷 Mitarbeiter-Auslastung:
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "15px",
                              flexWrap: "wrap",
                            }}
                          >
                            {employeeUtil.map((emp) => {
                              const meetsMin = emp.meetsMinimum !== false;
                              const isOverutilized =
                                emp.utilizationPercent > 100;

                              return (
                                <div
                                  key={emp.employeeId}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "4px 8px",
                                    background: meetsMin
                                      ? isOverutilized
                                        ? "#fff3e0"
                                        : "#e8f5e9"
                                      : "#ffebee",
                                    borderRadius: "4px",
                                    border: `1px solid ${
                                      meetsMin
                                        ? isOverutilized
                                          ? "#ff9800"
                                          : "#4caf50"
                                        : "#f44336"
                                    }`,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "600",
                                      color: "#333",
                                    }}
                                  >
                                    {emp.employeeName || `MA ${emp.employeeId}`}
                                    :
                                  </span>
                                  <span
                                    style={{
                                      color: meetsMin
                                        ? isOverutilized
                                          ? "#ef6c00"
                                          : "#2e7d32"
                                        : "#c62828",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {formatTime(emp.minutes || emp.hours * 60)}{" "}
                                    ({emp.utilizationPercent?.toFixed(0) || 0}%)
                                  </span>
                                  {!meetsMin && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#c62828",
                                        marginLeft: "4px",
                                      }}
                                      title="Unter Mindeststunden"
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* SCHRITT 2: MITARBEITER-BASIERTE TIMELINE VISUALISIERUNG */}
                  <div style={{ padding: "15px" }}>
                    {/* Zeitskala wird pro Mitarbeiter individuell angezeigt */}

                    {(() => {
                      const employees = getEmployeesForDayWrapper(day);

                      return employees.map((employee, empIdx) => (
                        <div
                          key={employee.employeeId || empIdx}
                          style={{
                            marginBottom:
                              empIdx < employees.length - 1 ? "20px" : "15px",
                            padding: "12px",
                            background: "#fafafa",
                            borderRadius: "6px",
                            border: "1px solid #e0e0e0",
                          }}
                        >
                          {/* Mitarbeiter-Header */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#333",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              👷 {employee.employeeName}
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#666",
                              }}
                            >
                              {formatTime(employee.totalTime)} Arbeit
                            </div>
                          </div>

                          {/* Zeitskala für diesen Mitarbeiter (dynamisch basierend auf maxTime) */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "8px",
                              fontSize: "10px",
                              color: "#666",
                              padding: "0 2px",
                            }}
                          >
                            {(() => {
                              const maxHours = Math.ceil(employee.maxTime / 60);
                              const markers = [];
                              for (let h = 0; h <= maxHours; h += 2) {
                                if (h <= maxHours) {
                                  markers.push(<span key={h}>{h}h</span>);
                                }
                              }
                              // Füge auch maxHours hinzu, falls es nicht durch 2 teilbar ist
                              if (maxHours % 2 !== 0) {
                                markers.push(
                                  <span key={maxHours}>{maxHours}h</span>
                                );
                              }
                              return markers;
                            })()}
                          </div>

                          {/* Timeline Bar für diesen Mitarbeiter */}
                          <div
                            style={{
                              position: "relative",
                              height: "40px",
                              background: "#f0f0f0",
                              borderRadius: "4px",
                              overflow: "hidden",
                              width: "100%", // Volle Breite des Containers
                            }}
                          >
                            {/* Farbiger Hintergrund für Standardarbeitszeit */}
                            {(() => {
                              const maxHours = employee.maxTime / 60;
                              const standardWorkPercent = Math.min((8 * 60 / employee.maxTime) * 100, 100);
                              const overtimePercent = maxHours > 8 ? Math.min(((maxHours - 8) * 60 / employee.maxTime) * 100, 100) : 0;
                              
                              return (
                                <>
                                  {/* Standardarbeitszeit (0-8h) - Grün */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: "0%",
                                      width: `${standardWorkPercent}%`,
                                      height: "100%",
                                      background: "linear-gradient(90deg, #e8f5e9 0%, #c8e6c9 100%)",
                                      opacity: 0.3,
                                      zIndex: 0,
                                    }}
                                  />
                                  {/* Überstunden (8-10h) - Gelb */}
                                  {maxHours > 8 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: `${standardWorkPercent}%`,
                                        width: `${Math.min((2 * 60 / employee.maxTime) * 100, overtimePercent)}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, #fff9c4 0%, #fff59d 100%)",
                                        opacity: 0.3,
                                        zIndex: 0,
                                      }}
                                    />
                                  )}
                                  {/* Überstunden (>10h) - Rot */}
                                  {maxHours > 10 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: `${standardWorkPercent + Math.min((2 * 60 / employee.maxTime) * 100, overtimePercent)}%`,
                                        width: `${Math.max(0, (maxHours - 10) * 60 / employee.maxTime * 100)}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, #ffebee 0%, #ffcdd2 100%)",
                                        opacity: 0.3,
                                        zIndex: 0,
                                      }}
                                    />
                                  )}
                                </>
                              );
                            })()}

                            {/* Stundenmarkierungen - dynamisch basierend auf maxTime */}
                            {(() => {
                              const maxHours = Math.ceil(employee.maxTime / 60);
                              const markers = [];
                              // Zeige Markierungen alle 2 Stunden, plus bei 8h (wichtig) und am Ende
                              for (let h = 1; h <= maxHours; h++) {
                                // Zeige Markierung bei jeder Stunde, aber nur sichtbar bei geraden Stunden oder wichtigen Marken
                                if (h % 2 === 0 || h === 8 || h === maxHours) {
                                  markers.push(
                                    <div
                                      key={h}
                                      style={{
                                        position: "absolute",
                                        left: `${
                                          ((h * 60) / employee.maxTime) * 100
                                        }%`,
                                        top: 0,
                                        bottom: 0,
                                        width: h === 8 ? "2px" : "1px",
                                        background:
                                          h === 8
                                            ? "#4caf50"
                                            : h === maxHours
                                            ? "#bbb"
                                            : "#ddd",
                                        zIndex: h === 8 ? 2 : 1,
                                      }}
                                    />
                                  );
                                }
                              }
                              return markers;
                            })()}

                            {/* Arbeitsblöcke für diesen Mitarbeiter */}
                            {employee.tasks.map((task, taskIdx) => {
                              // WICHTIG: duration ist in Minuten (von workflowService)
                              // scheduledTime und workTime sind veraltet
                              const taskDuration =
                                task.duration || task.scheduledTime || 0;
                              const startTime = task.startTime || 0;
                              const waitTime = task.waitTime || 0; // Trocknungszeit in Minuten
                              const endTime = startTime + taskDuration; // Ende des Tasks

                              // NEU: Berechne Position basierend auf maxTime des Mitarbeiters
                              // Damit werden auch Tasks über 8h korrekt angezeigt
                              const widthPercent =
                                (taskDuration / employee.maxTime) * 100;
                              const leftPercent =
                                (startTime / employee.maxTime) * 100;

                              // NEU: Finde die Nummer des Arbeitsschritts im gesamten Tag
                              // (nicht nur im employee.tasks Array, sondern in day.tasks)
                              // Sortiere day.tasks nach startTime für konsistente Nummerierung
                              const sortedDayTasks = [...day.tasks].sort(
                                (a, b) =>
                                  (a.startTime || 0) - (b.startTime || 0)
                              );
                              const taskNumberInDay =
                                sortedDayTasks.findIndex(
                                  (t) =>
                                    (t.id && task.id && t.id === task.id) ||
                                    (t.serviceId === task.serviceId &&
                                      t.objectId === task.objectId &&
                                      t.employeeId === task.employeeId &&
                                      Math.abs((t.startTime || 0) - startTime) <
                                        5) // 5 Minuten Toleranz
                                ) + 1;
                              const displayTaskNumber =
                                taskNumberInDay > 0
                                  ? taskNumberInDay
                                  : taskIdx + 1;

                              // Helper-Funktion für RGB-Konvertierung
                              const hexToRgb = (hex) => {
                                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                                return result ? {
                                  r: parseInt(result[1], 16),
                                  g: parseInt(result[2], 16),
                                  b: parseInt(result[3], 16)
                                } : null;
                              };

                              // Eindeutige Farbe für diesen Arbeitsschritt
                              const bgColor = getTaskColor(task);
                              
                              // Erstelle Gradient aus der Basis-Farbe
                              const rgb = hexToRgb(bgColor);
                              const lighterColor = rgb 
                                ? `rgba(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)}, 1)`
                                : bgColor;
                              const darkerColor = rgb
                                ? `rgba(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)}, 1)`
                                : bgColor;

                              // NEU: Entscheide, ob nur Nummer oder Text angezeigt wird
                              const showOnlyNumber = widthPercent < 8; // Wenn Block < 8% breit, nur Nummer
                              const showShortText =
                                widthPercent >= 8 && widthPercent < 15; // 8-15%: Kurzer Text
                              const showFullText = widthPercent >= 15; // >= 15%: Volltext

                              return (
                                <React.Fragment key={taskIdx}>
                                  {/* Arbeitsblock */}
                                  <div
                                    onMouseEnter={(e) => {
                                      setHoveredTask({ ...task, displayTaskNumber, taskDuration, waitTime, startTime, endTime });
                                      setTooltipPosition({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseMove={(e) => {
                                      setTooltipPosition({ x: e.clientX, y: e.clientY });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredTask(null);
                                    }}
                                    style={{
                                      position: "absolute",
                                      left: `${leftPercent}%`,
                                      width: `${Math.max(widthPercent, 1)}%`,
                                      height: "100%",
                                      background: hoveredTask?.id === task.id || hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5
                                        ? `linear-gradient(135deg, ${lighterColor} 0%, ${bgColor} 50%, ${darkerColor} 100%)`
                                        : `linear-gradient(135deg, ${bgColor} 0%, ${darkerColor} 100%)`,
                                      borderRadius: "3px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      padding: "0 4px",
                                      fontSize: showOnlyNumber
                                        ? "11px"
                                        : "10px",
                                      fontWeight: showOnlyNumber
                                        ? "600"
                                        : "normal",
                                      color: "white",
                                      overflow: "hidden",
                                      whiteSpace: "nowrap",
                                      boxSizing: "border-box",
                                      border: hoveredTask?.id === task.id || hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5
                                        ? `3px solid ${lighterColor}`
                                        : `2px solid ${darkerColor}`,
                                      boxShadow: hoveredTask?.id === task.id || hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5
                                        ? "0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)"
                                        : "0 2px 6px rgba(0,0,0,0.25)",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease-out",
                                      transform: hoveredTask?.id === task.id || hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5
                                        ? "scale(1.05)"
                                        : "scale(1)",
                                      zIndex: hoveredTask?.id === task.id || hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5
                                        ? 10
                                        : 5,
                                    }}
                                  >
                                    {showOnlyNumber ? (
                                      // Nur Nummer anzeigen bei sehr schmalen Blöcken
                                      <span>{displayTaskNumber}</span>
                                    ) : showShortText ? (
                                      // Kurzer Text bei mittleren Blöcken
                                      <span>
                                        {displayTaskNumber}.{" "}
                                        {task.objectName || task.objectId || ""}
                                      </span>
                                    ) : (
                                      // Volltext bei breiten Blöcken
                                      <span>
                                        {task.objectName || task.objectId || ""}
                                        : {task.serviceName}
                                      </span>
                                    )}
                                  </div>
                                  {/* Trocknungszeit als orange Balken (wenn vorhanden) */}
                                  {waitTime > 0 &&
                                    (() => {
                                      const dryingWidthPercent =
                                        (waitTime / employee.maxTime) * 100;
                                      const showDryingText =
                                        dryingWidthPercent > 8;
                                      const isHovered = hoveredTask?.id === task.id || (hoveredTask?.serviceId === task.serviceId && hoveredTask?.objectId === task.objectId && Math.abs((hoveredTask?.startTime || 0) - startTime) < 5);

                                      return (
                                        <div
                                          onMouseEnter={(e) => {
                                            setHoveredTask({ ...task, displayTaskNumber, taskDuration, waitTime, startTime, endTime, isDrying: true });
                                            setTooltipPosition({ x: e.clientX, y: e.clientY });
                                          }}
                                          onMouseMove={(e) => {
                                            setTooltipPosition({ x: e.clientX, y: e.clientY });
                                          }}
                                          onMouseLeave={() => {
                                            setHoveredTask(null);
                                          }}
                                          style={{
                                            position: "absolute",
                                            left: `${
                                              (endTime / employee.maxTime) * 100
                                            }%`,
                                            width: `${Math.max(
                                              dryingWidthPercent,
                                              1
                                            )}%`,
                                            height: "100%",
                                            background: isHovered
                                              ? "linear-gradient(135deg, #ffb74d 0%, #ff9800 50%, #f57c00 100%)"
                                              : "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                                            borderRadius: "3px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "0 4px",
                                            fontSize: showDryingText
                                              ? "10px"
                                              : "9px",
                                            color: "white",
                                            overflow: "hidden",
                                            whiteSpace: "nowrap",
                                            boxSizing: "border-box",
                                            border: isHovered
                                              ? "3px solid #ffb74d"
                                              : "2px solid #e65100",
                                            boxShadow: isHovered
                                              ? "0 4px 12px rgba(255,152,0,0.5), 0 0 0 1px rgba(255,255,255,0.2)"
                                              : "0 2px 6px rgba(0,0,0,0.25)",
                                            opacity: isHovered ? 1 : 0.9,
                                            cursor: "pointer",
                                            transition: "all 0.2s ease-out",
                                            transform: isHovered ? "scale(1.05)" : "scale(1)",
                                            zIndex: isHovered ? 10 : 5,
                                          }}
                                        >
                                          {showDryingText ? (
                                            <span>
                                              ⏱ {formatTime(waitTime)}
                                            </span>
                                          ) : (
                                            <span>⏱</span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          {/* Raum-Info für diesen Mitarbeiter */}
                          {(() => {
                            const rooms = new Set();
                            employee.tasks.forEach((task) => {
                              if (task.objectName || task.objectId) {
                                rooms.add(task.objectName || task.objectId);
                              }
                            });

                            if (rooms.size > 0) {
                              return (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    fontSize: "10px",
                                    color: "#666",
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span style={{ fontWeight: "500" }}>
                                    Räume/Objekte:
                                  </span>
                                  {Array.from(rooms).map((roomName) => {
                                    const roomTasks = employee.tasks.filter(
                                      (t) =>
                                        (t.objectName || t.objectId) ===
                                        roomName
                                    );
                                    // WICHTIG: duration ist in Minuten (von workflowService)
                                    const roomTime = roomTasks.reduce(
                                      (sum, t) => sum + (t.duration || 0),
                                      0
                                    );
                                    return (
                                      <span key={roomName}>
                                        📍 {roomName} ({formatTime(roomTime)})
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ));
                    })()}

                    {/* Task-Liste */}
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#666",
                          marginBottom: "10px",
                        }}
                      >
                        Arbeitsschritte:
                      </div>

                      {day.tasks.map((task, taskIdx) => {
                        // NEU: Gleiche Farbfunktion wie in der Timeline für Konsistenz
                        const getTaskColor = (task) => {
                          const uniqueId =
                            task.id ||
                            `${task.serviceId || task.serviceName}-${
                              task.objectId || "unknown"
                            }`;
                          if (task.objectId === "project") return "#607D8B";
                          if (task.objectId === "project-end") return "#9E9E9E";
                          const hash = uniqueId
                            .split("")
                            .reduce((acc, char) => {
                              return char.charCodeAt(0) + ((acc << 5) - acc);
                            }, 0);
                          const colors = [
                            "#1976d2",
                            "#388e3c",
                            "#7b1fa2",
                            "#ff9800",
                            "#00796b",
                            "#d32f2f",
                            "#c2185b",
                            "#512da8",
                            "#0288d1",
                            "#689f38",
                            "#f57c00",
                            "#5d4037",
                            "#455a64",
                            "#7b1fa2",
                            "#c2185b",
                            "#303f9f",
                            "#00796b",
                            "#e64a19",
                            "#5e35b1",
                            "#00897b",
                            "#d84315",
                            "#6a1b9a",
                            "#0277bd",
                            "#2e7d32",
                            "#e91e63",
                            "#795548",
                          ];
                          return colors[Math.abs(hash) % colors.length];
                        };

                        const taskColor = getTaskColor(task);

                        return (
                          <div
                            key={taskIdx}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "10px",
                              padding: "10px 12px",
                              marginBottom: "6px",
                              background: "#fafafa",
                              borderRadius: "4px",
                              borderLeft: `3px solid ${taskColor}`,
                            }}
                          >
                            <div
                              style={{
                                background: "#e0e0e0",
                                color: "#666",
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                                fontWeight: "500",
                                flexShrink: 0,
                              }}
                            >
                              {taskIdx + 1}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: "500",
                                  fontSize: "13px",
                                  color: "#333",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {task.isSubService && (
                                  <span style={{ color: "#999" }}>↳</span>
                                )}
                                <span>{task.serviceName}</span>
                                <span
                                  style={{
                                    fontWeight: "normal",
                                    color: "#888",
                                  }}
                                >
                                  ({task.objectName})
                                </span>
                              </div>

                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#666",
                                  marginTop: "4px",
                                }}
                              >
                                <span
                                  style={{
                                    background:
                                      task.workflowPhaseColor || "#f0f0f0",
                                    color: "white",
                                    padding: "1px 6px",
                                    borderRadius: "3px",
                                    marginRight: "8px",
                                    fontSize: "10px",
                                  }}
                                >
                                  {task.workflowPhaseIcon}{" "}
                                  {task.workflowPhaseName}
                                </span>
                                {/* NEU: Mitarbeiter-Badge */}
                                {task.employeeId && (
                                  <span
                                    style={{
                                      background:
                                        task.employeeId === 1
                                          ? "#1976d2"
                                          : task.employeeId === 2
                                          ? "#388e3c"
                                          : task.employeeId === 3
                                          ? "#7b1fa2"
                                          : "#ff9800",
                                      color: "white",
                                      padding: "1px 6px",
                                      borderRadius: "3px",
                                      marginRight: "8px",
                                      fontSize: "10px",
                                    }}
                                  >
                                    👷{" "}
                                    {task.employeeName ||
                                      `MA ${task.employeeId}`}
                                  </span>
                                )}
                                <span
                                  style={{
                                    background: "#f0f0f0",
                                    padding: "1px 6px",
                                    borderRadius: "3px",
                                    marginRight: "8px",
                                  }}
                                >
                                  {task.workAreaName}
                                </span>
                                {task.quantity?.toFixed(1)} {task.unit} ·{" "}
                                {formatTime(
                                  task.duration || task.scheduledTime || task.workTime
                                )}
                                {/* Anzeige für aufgeteilte Tasks */}
                                {(task.isPartial || task.isContinuation) && (
                                  <span
                                    style={{
                                      color: "#1976d2",
                                      marginLeft: "8px",
                                      fontSize: "11px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {task.isContinuation &&
                                      !task.isPartial &&
                                      "✓ Fertig"}
                                    {task.isPartial &&
                                      !task.isContinuation &&
                                      "→ wird fortgesetzt"}
                                    {task.isPartial &&
                                      task.isContinuation &&
                                      "→ wird weiter fortgesetzt"}
                                  </span>
                                )}
                                {task.waitTime > 0 && (
                                  <span
                                    style={{
                                      color: "#e65100",
                                      marginLeft: "10px",
                                    }}
                                  >
                                    + {formatTime(task.waitTime)} Trocknung
                                  </span>
                                )}
                              </div>

                              {/* Gebündelte Unterleistungen Anzeige */}
                              {task.hasBundledServices &&
                                task.bundledServices && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#7b1fa2",
                                      marginTop: "4px",
                                      padding: "4px 8px",
                                      background: "#f3e5f5",
                                      borderRadius: "4px",
                                      display: "inline-block",
                                    }}
                                  >
                                    📦 Inkl.:{" "}
                                    {task.bundledServices
                                      .map(
                                        (b) =>
                                          `${b.title} (${b.standardValuePerUnit} min/${task.unit})`
                                      )
                                      .join(", ")}
                                  </div>
                                )}

                              {/* Unterleistungs-Schritt Anzeige */}
                              {task.subWorkflowOrder &&
                                task.subWorkflowTotal && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#f57c00",
                                      marginTop: "6px",
                                      padding: "6px 8px",
                                      background: "#fff8e1",
                                      borderRadius: "4px",
                                      borderLeft: "3px solid #f57c00",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    🔄 Schritt {task.subWorkflowOrder} von{" "}
                                    {task.subWorkflowTotal}
                                    {task.subWorkflowExplanation && (
                                      <div
                                        style={{
                                          fontWeight: "normal",
                                          marginTop: "4px",
                                        }}
                                      >
                                        {task.subWorkflowExplanation}
                                      </div>
                                    )}
                                  </div>
                                )}

                              {/* Hinweis für aufgeteilte Tasks */}
                              {task.continuationInfo && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#1976d2",
                                    marginTop: "6px",
                                    padding: "6px 8px",
                                    background: "#e3f2fd",
                                    borderRadius: "4px",
                                    borderLeft: "3px solid #1976d2",
                                  }}
                                >
                                  📋 {task.continuationInfo}
                                  {task.isPartial && task.totalTime && (
                                    <span
                                      style={{
                                        marginLeft: "8px",
                                        color: "#666",
                                      }}
                                    >
                                      (Gesamt: {formatTime(task.totalTime)},
                                      heute:{" "}
                                      {formatTime(
                                        task.duration || task.scheduledTime || task.workTime
                                      )}
                                      )
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Workflow-Erklärung */}
                              {task.workflowExplanation &&
                                !task.subWorkflowOrder && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "#666",
                                      marginTop: "6px",
                                      padding: "6px 8px",
                                      background: "#f5f5f5",
                                      borderRadius: "4px",
                                      borderLeft: `3px solid ${
                                        task.workflowPhaseColor || "#2196F3"
                                      }`,
                                    }}
                                  >
                                    💡 {task.workflowExplanation}
                                  </div>
                                )}

                              {/* Workflow-Tipp */}
                              {task.workflowTip && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#E65100",
                                    marginTop: "4px",
                                    padding: "6px 8px",
                                    background: "#FFF8E1",
                                    borderRadius: "4px",
                                  }}
                                >
                                  {task.workflowTip}
                                </div>
                              )}

                              {(task.isSubService ||
                                task.isFromSpecialNote) && (
                                <div style={{ marginTop: "4px" }}>
                                  {task.isSubService && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        background: "#EDE7F6",
                                        color: "#7E57C2",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                        marginRight: "6px",
                                      }}
                                    >
                                      Unterleistung
                                    </span>
                                  )}
                                  {task.isFromSpecialNote && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        background: "#FBE9E7",
                                        color: "#E64A19",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                      }}
                                    >
                                      Sonderangabe
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: "11px",
                                color: "#999",
                                flexShrink: 0,
                                textAlign: "right",
                              }}
                            >
                              {formatClock(task.startTime)} –{" "}
                              {formatClock(task.endTime)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Trocknungsphasen mit detaillierter Erklärung */}
                  </div>
                </div>
              ))}

              {/* Mitarbeiter-Erklärung */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 12px",
                    fontSize: "14px",
                    color: "#333",
                  }}
                >
                  Mitarbeiteranzahl-Berechnung
                </h4>

                <div style={{ fontSize: "13px", color: "#555" }}>
                  {detailedPlan.summary.employeeExplanation.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        marginBottom: "6px",
                        background:
                          item.type === "warning" ? "#FFF3E0" : "white",
                        borderRadius: "4px",
                        borderLeft:
                          item.type === "calculation"
                            ? "3px solid #1976d2"
                            : item.type === "warning"
                            ? "3px solid #FF9800"
                            : item.type === "parallel"
                            ? "3px solid #2196F3"
                            : "none",
                      }}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legende */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  background: "#fafafa",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                <div style={{ fontWeight: "500", marginBottom: "10px" }}>
                  Legende:
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "15px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        background: "#4CAF50",
                        borderRadius: "2px",
                      }}
                    ></span>
                    Arbeitszeit
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        background: "#7E57C2",
                        borderRadius: "2px",
                      }}
                    ></span>
                    Unterleistung
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        background: "#FF7043",
                        borderRadius: "2px",
                      }}
                    ></span>
                    Aus Sonderangabe
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span style={{ color: "#e65100", fontWeight: "bold" }}>
                      ●
                    </span>
                    Trocknungszeit
                  </span>
                </div>

                <div
                  style={{
                    borderTop: "1px solid #e0e0e0",
                    paddingTop: "10px",
                    marginTop: "5px",
                  }}
                >
                  <div style={{ fontWeight: "500", marginBottom: "8px" }}>
                    Parallelarbeit während Trocknung:
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#E8F5E9",
                          border: "2px solid #4CAF50",
                          borderRadius: "2px",
                        }}
                      ></span>
                      Gleicher Raum möglich
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#FFEBEE",
                          border: "2px solid #E53935",
                          borderRadius: "2px",
                        }}
                      ></span>
                      Gleicher Raum nicht möglich
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#E3F2FD",
                          border: "2px solid #1976D2",
                          borderRadius: "2px",
                        }}
                      ></span>
                      Anderer Raum (mit Freigabe)
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        style={{
                          width: "12px",
                          height: "12px",
                          background: "#F3E5F5",
                          border: "2px solid #9C27B0",
                          borderRadius: "2px",
                        }}
                      ></span>
                      Potenzial ohne Freigabe
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Custom Tooltip - außerhalb des scrollbaren Bereichs */}
            {hoveredTask && (
              <TaskTooltip
                task={hoveredTask}
                position={tooltipPosition}
                displayTaskNumber={hoveredTask.displayTaskNumber || 0}
                getTaskColor={getTaskColor}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
