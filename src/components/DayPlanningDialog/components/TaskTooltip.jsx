import React from "react";
import { formatTime, formatClock } from "../utils/timeFormatters";

/**
 * Custom Tooltip Component für Timeline-Tasks
 * Zeigt detaillierte Informationen über einen Task an
 */
export default function TaskTooltip({ task, position, displayTaskNumber, getTaskColor }) {
  if (!task) return null;

  const taskDuration = task.duration || task.scheduledTime || task.taskDuration || 0;
  const waitTime = task.waitTime || 0;
  const startTime = task.startTime || 0;
  const endTime = task.endTime || (startTime + taskDuration);
  const isDrying = task.isDrying || false;
  const bgColor = isDrying ? "#ff9800" : (getTaskColor ? getTaskColor(task) : "#1976d2");

  // Berechne Tooltip-Position (verhindert, dass Tooltip außerhalb des Bildschirms ist)
  const tooltipStyle = {
    position: "fixed",
    left: `${position.x + 15}px`,
    top: `${position.y + 15}px`,
    background: "white",
    padding: "12px 16px",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.1)",
    zIndex: 10000,
    minWidth: "280px",
    maxWidth: "350px",
    pointerEvents: "none",
    border: `3px solid ${bgColor}`,
    transform: "translateY(0)",
    animation: "tooltipFadeIn 0.15s ease-out",
  };

  // Prüfe ob Tooltip rechts außerhalb wäre
  if (position.x > window.innerWidth - 300) {
    tooltipStyle.left = `${position.x - 320}px`;
  }
  // Prüfe ob Tooltip unten außerhalb wäre
  if (position.y > window.innerHeight - 200) {
    tooltipStyle.top = `${position.y - 180}px`;
  }

  return (
    <>
      <style>
        {`
          @keyframes tooltipFadeIn {
            from {
              opacity: 0;
              transform: translateY(-5px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div style={tooltipStyle}>
        {/* Header mit Task-Nummer und Service-Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
            paddingBottom: "10px",
            borderBottom: "2px solid #f0f0f0",
          }}
        >
          {!isDrying && (
            <span
              style={{
                background: bgColor,
                color: "white",
                padding: "4px 10px",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "13px",
                minWidth: "40px",
                textAlign: "center",
              }}
            >
              #{displayTaskNumber}
            </span>
          )}
          {isDrying && (
            <span
              style={{
                background: "#ff9800",
                color: "white",
                padding: "4px 10px",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "13px",
                minWidth: "40px",
                textAlign: "center",
              }}
            >
              ⏱
            </span>
          )}
          <span
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#333",
              flex: 1,
            }}
          >
            {isDrying ? "Trocknungszeit" : (task.serviceName || "Unbekannt")}
          </span>
        </div>

        {/* Objekt/Raum Info */}
        {!isDrying && (
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "14px" }}>📍</span>
            <span style={{ fontWeight: "500" }}>
              {task.objectName || task.objectId || "Unbekannt"}
            </span>
          </div>
        )}

        {/* Zeit-Informationen */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDrying ? "1fr" : "1fr 1fr",
            gap: "10px",
            marginBottom: "10px",
            padding: "10px",
            background: isDrying ? "#fff3e0" : "#f8f9fa",
            borderRadius: "6px",
          }}
        >
          {!isDrying && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#999",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ⏱ Arbeitszeit
              </div>
              <div
                style={{
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "#333",
                }}
              >
                {formatTime(taskDuration)}
              </div>
            </div>
          )}
          {(waitTime > 0 || isDrying) && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#999",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ⏳ Trocknungszeit
              </div>
              <div
                style={{
                  fontWeight: "700",
                  fontSize: "14px",
                  color: "#e65100",
                }}
              >
                {formatTime(isDrying ? waitTime : waitTime)}
              </div>
            </div>
          )}
          {isDrying && task.serviceName && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #ffcc80" }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "#999",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Nach Aufgabe
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  fontWeight: "500",
                }}
              >
                {task.serviceName}
              </div>
              {task.objectName && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    marginTop: "4px",
                  }}
                >
                  📍 {task.objectName}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zeitraum */}
        <div
          style={{
            fontSize: "11px",
            color: "#888",
            marginBottom: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>🕐</span>
          <span>
            {formatClock(startTime)} – {formatClock(endTime)}
          </span>
        </div>

        {/* Zusätzliche Infos */}
        {(task.quantity || task.isPartial || task.isContinuation) && (
          <div
            style={{
              paddingTop: "10px",
              borderTop: "1px solid #eee",
              fontSize: "11px",
              color: "#666",
            }}
          >
            {task.quantity && (
              <div style={{ marginBottom: "4px" }}>
                <span style={{ fontWeight: "500" }}>Menge:</span>{" "}
                {task.isPartial && task.totalQuantity && task.totalQuantity !== task.quantity
                  ? `${task.quantity.toFixed(1)} / ${task.totalQuantity.toFixed(1)}`
                  : task.quantity.toFixed(1)}{" "}
                {task.unit}
                {task.isPartial && task.totalQuantity && task.totalQuantity !== task.quantity && (
                  <span style={{ fontSize: "10px", color: "#999", marginLeft: "4px" }}>
                    (von {task.totalQuantity.toFixed(1)} {task.unit})
                  </span>
                )}
              </div>
            )}
            {task.isPartial && (
              <div
                style={{
                  color: "#1976d2",
                  fontWeight: "500",
                  marginTop: "6px",
                }}
              >
                → wird fortgesetzt
              </div>
            )}
            {task.isContinuation && !task.isPartial && (
              <div
                style={{
                  color: "#388e3c",
                  fontWeight: "500",
                  marginTop: "6px",
                }}
              >
                ✓ Fortsetzung
              </div>
            )}
            {task.isPartial && task.isContinuation && (
              <div
                style={{
                  color: "#1976d2",
                  fontWeight: "500",
                  marginTop: "6px",
                }}
              >
                → wird weiter fortgesetzt
              </div>
            )}
          </div>
        )}

        {/* Workflow-Phase */}
        {task.workflowPhaseName && (
          <div
            style={{
              marginTop: "10px",
              paddingTop: "10px",
              borderTop: "1px solid #eee",
            }}
          >
            <span
              style={{
                background: task.workflowPhaseColor || "#f0f0f0",
                color: "white",
                padding: "3px 8px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: "500",
              }}
            >
              {task.workflowPhaseIcon} {task.workflowPhaseName}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
