import React, { useState, useMemo, useRef } from "react";
import { MINUTES_PER_DAY, HOURS_PER_DAY } from "../../constants";
import { workflowPhases } from "../../data/servicesData";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Formatiert Zeit in Stunden und Minuten
const formatTime = (minutes) => {
  if (!minutes && minutes !== 0) return "0:00 h";
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")} h`;
};

// Formatiert Uhrzeit (für Timeline)
const formatClock = (minutes) => {
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
};

// Erkennt den Arbeitsbereich aus dem Service-Namen
const detectWorkArea = (serviceName) => {
  const name = serviceName.toLowerCase();

  if (name.includes("decke") || name.includes("decken")) return "decke";
  if (name.includes("wand") || name.includes("wände")) return "wand";
  if (name.includes("boden") || name.includes("abdecken")) return "boden";
  if (name.includes("fenster")) return "fenster";
  if (name.includes("tür") || name.includes("zarge")) return "tuer";
  if (
    name.includes("lackier") ||
    name.includes("schleifen") ||
    name.includes("grundier")
  )
    return "lackierung";
  if (
    name.includes("tapete") ||
    name.includes("tapezier") ||
    name.includes("raufaser") ||
    name.includes("vlies")
  )
    return "tapete";
  if (name.includes("spachtel")) return "spachtel";
  if (name.includes("grundierung") || name.includes("grundier"))
    return "grundierung";
  if (name.includes("streichen") || name.includes("anstrich"))
    return "anstrich";

  return "allgemein";
};

// Gibt lesbaren Namen für den Arbeitsbereich zurück
const getAreaName = (area) => {
  const names = {
    decke: "Decke",
    wand: "Wände",
    boden: "Boden",
    fenster: "Fenster",
    tuer: "Türen/Zargen",
    lackierung: "Lackierarbeiten",
    tapete: "Tapezierarbeiten",
    spachtel: "Spachtelarbeiten",
    grundierung: "Grundierung",
    anstrich: "Anstrich",
    allgemein: "Allgemein",
  };
  return names[area] || area;
};

// Prüft ob zwei Arbeitsbereiche parallel im gleichen Raum möglich sind
const canWorkParallelInSameRoom = (dryingArea, otherArea) => {
  // Regeln für Parallelarbeit im gleichen Raum:

  // Boden trocknet: NICHTS anderes möglich (man muss drauf stehen!)
  if (dryingArea === "boden") {
    return {
      canWork: false,
      reason: "Boden trocknet – Raum nicht betretbar",
    };
  }

  // Decke trocknet: Wände, Fenster, Türen können gemacht werden
  if (dryingArea === "decke") {
    if (["wand", "fenster", "tuer", "lackierung"].includes(otherArea)) {
      return {
        canWork: true,
        reason: "Decke trocknet – Wände/Fenster/Türen sind unabhängig",
      };
    }
    if (otherArea === "boden") {
      return {
        canWork: true,
        reason: "Decke trocknet – Bodenarbeiten möglich",
      };
    }
  }

  // Wände trocknen: Fenster, Türen können gemacht werden (sind oft unabhängig)
  if (dryingArea === "wand") {
    if (["fenster", "tuer"].includes(otherArea)) {
      return {
        canWork: true,
        reason: "Wände trocknen – Fenster/Türen können bearbeitet werden",
      };
    }
    if (otherArea === "decke") {
      return {
        canWork: false,
        reason:
          "Wände trocknen – Deckenarbeiten würden Wände beschädigen (Tropfen)",
      };
    }
  }

  // Fenster/Türen trocknen: Andere Flächen können gemacht werden
  if (["fenster", "tuer", "lackierung"].includes(dryingArea)) {
    if (["wand", "decke"].includes(otherArea)) {
      return {
        canWork: true,
        reason: `${getAreaName(dryingArea)} trocknet – ${getAreaName(
          otherArea
        )} kann bearbeitet werden`,
      };
    }
  }

  // Spachtel/Grundierung trocknet: Gleiche Fläche muss warten
  if (["spachtel", "grundierung", "tapete", "anstrich"].includes(dryingArea)) {
    if (otherArea === dryingArea) {
      return {
        canWork: false,
        reason: "Gleiche Oberflächenbehandlung – muss erst trocknen",
      };
    }
  }

  // Standard: Gleicher Bereich = warten
  if (dryingArea === otherArea) {
    return {
      canWork: false,
      reason: `${getAreaName(
        dryingArea
      )} trocknet – gleicher Bereich nicht bearbeitbar`,
    };
  }

  // Standard: Andere Bereiche können oft parallel gemacht werden
  return {
    canWork: true,
    reason: `${getAreaName(dryingArea)} trocknet – ${getAreaName(
      otherArea
    )} ist unabhängig`,
  };
};

export default function DayPlanningDialog({
  results,
  customerApproval,
  companySettings,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const printContentRef = useRef(null);

  // PDF Export - Optimierte Seitennutzung mit intelligentem Umbruch
  const handleExportPDF = async (preview = false) => {
    setIsExporting(true);

    try {
      const totalDaysVal = results?.totalDays || 1;
      const optimalEmployees = results?.optimalEmployees || 1;
      const totalTimeVal = results?.totalTime || 0;
      const totalWaitTimeVal = detailedPlan.summary.totalWaitTime || 0;
      const date = new Date();
      const dateStr = `${String(date.getDate()).padStart(2, "0")}.${String(
        date.getMonth() + 1
      ).padStart(2, "0")}.${date.getFullYear()}`;

      // Temporärer Container für PDF-Rendering
      const printContainer = document.createElement("div");
      printContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 750px;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(printContainer);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2 - 8; // 8mm für Footer
      const pxToMm = usableWidth / 750; // Umrechnungsfaktor

      let currentY = margin;
      let isFirstElement = true;

      // Hilfsfunktion: Element rendern und Höhe in mm zurückgeben
      const renderSection = async (htmlContent) => {
        printContainer.innerHTML = htmlContent;
        await new Promise((resolve) => setTimeout(resolve, 30));

        const canvas = await html2canvas(printContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: 750,
          windowWidth: 750,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgHeightMm = (canvas.height / 2) * pxToMm; // /2 wegen scale:2

        return { imgData, imgHeightMm, imgWidth: usableWidth };
      };

      // Hilfsfunktion: Abschnitt zur PDF hinzufügen
      const addToPdf = async (htmlContent) => {
        const { imgData, imgHeightMm, imgWidth } = await renderSection(
          htmlContent
        );

        // Prüfen ob Platz auf aktueller Seite
        if (!isFirstElement && currentY + imgHeightMm > usableHeight + margin) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, "PNG", margin, currentY, imgWidth, imgHeightMm);
        currentY += imgHeightMm + 2; // 2mm Abstand zwischen Abschnitten
        isFirstElement = false;
      };

      // === Header + Zusammenfassung + Mitarbeiter-Kalkulation ===
      const headerHtml = `
        <div style="padding: 15px; color: #333; font-size: 11px; line-height: 1.4;">
          <div style="border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 12px;">
            ${
              companySettings?.companyName
                ? `<div style="color: #666; font-size: 10px; margin-bottom: 3px;">${companySettings.companyName}</div>`
                : ""
            }
            <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #1a1a1a;">Detaillierter Ablaufplan</h1>
            <div style="color: #666; font-size: 10px; margin-top: 4px;">Erstellt am ${dateStr}</div>
          </div>
          <div style="display: flex; margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 6px;">
            <div style="flex: 1; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #1976d2;">${totalDaysVal}</div>
              <div style="font-size: 9px; color: #666;">Arbeitstag${
                totalDaysVal !== 1 ? "e" : ""
              }</div>
            </div>
            <div style="flex: 1; text-align: center; border-left: 1px solid #ddd;">
              <div style="font-size: 24px; font-weight: 700; color: #1976d2;">${optimalEmployees}</div>
              <div style="font-size: 9px; color: #666;">Mitarbeiter</div>
            </div>
            <div style="flex: 1; text-align: center; border-left: 1px solid #ddd;">
              <div style="font-size: 24px; font-weight: 700; color: #1976d2;">${formatTime(
                totalTimeVal
              )}</div>
              <div style="font-size: 9px; color: #666;">Arbeitszeit</div>
            </div>
            ${
              totalWaitTimeVal > 0
                ? `
            <div style="flex: 1; text-align: center; border-left: 1px solid #ddd;">
              <div style="font-size: 24px; font-weight: 700; color: #e65100;">${formatTime(
                totalWaitTimeVal
              )}</div>
              <div style="font-size: 9px; color: #666;">Trocknungszeit</div>
            </div>
            `
                : ""
            }
          </div>
          ${
            detailedPlan.summary.employeeExplanation?.length > 0
              ? `
          <div style="padding: 10px 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px;">
            <div style="font-size: 11px; font-weight: 600; color: #333; margin-bottom: 8px;">Mitarbeiter-Kalkulation</div>
            ${detailedPlan.summary.employeeExplanation
              .map(
                (exp) => `
              <div style="font-size: 9px; color: ${
                exp.type === "warning"
                  ? "#e65100"
                  : exp.type === "tip" || exp.type === "parallel"
                  ? "#2e7d32"
                  : "#555"
              }; margin-bottom: 4px; padding-left: 8px; border-left: 2px solid ${
                  exp.type === "warning"
                    ? "#e65100"
                    : exp.type === "tip" || exp.type === "parallel"
                    ? "#2e7d32"
                    : "#ccc"
                };">
                ${exp.text}
              </div>
            `
              )
              .join("")}
          </div>
          `
              : ""
          }
        </div>
      `;

      await addToPdf(headerHtml);

      // === JEDER TAG - passt sich an verfügbaren Platz an ===
      for (const day of detailedPlan.days) {
        const dayHtml = `
          <div style="padding: 12px 15px; color: #333; font-size: 10px; line-height: 1.3;">
            <div style="background: #1976d2; color: white; padding: 8px 12px; border-radius: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 14px; font-weight: 600;">Tag ${
                day.dayNumber
              }</div>
              <div style="font-size: 11px;">
                Arbeit: <strong>${formatTime(day.totalWorkTime)}</strong>
                ${
                  day.totalWaitTime > 0
                    ? `<span style="margin-left: 15px; color: #ffcc80;">Trocknung: <strong>${formatTime(
                        day.totalWaitTime
                      )}</strong></span>`
                    : ""
                }
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
              <thead>
                <tr style="background: #f0f0f0;">
                  <th style="text-align: left; padding: 6px; font-weight: 600; color: #555; width: 25px; border-bottom: 1px solid #ddd;">#</th>
                  <th style="text-align: left; padding: 6px; font-weight: 600; color: #555; border-bottom: 1px solid #ddd;">Aufgabe</th>
                  <th style="text-align: left; padding: 6px; font-weight: 600; color: #555; width: 90px; border-bottom: 1px solid #ddd;">Objekt</th>
                  <th style="text-align: center; padding: 6px; font-weight: 600; color: #555; width: 60px; border-bottom: 1px solid #ddd;">Menge</th>
                  <th style="text-align: right; padding: 6px; font-weight: 600; color: #555; width: 50px; border-bottom: 1px solid #ddd;">Zeit</th>
                  <th style="text-align: right; padding: 6px; font-weight: 600; color: #555; width: 60px; border-bottom: 1px solid #ddd;">Trock.</th>
                </tr>
              </thead>
              <tbody>
                ${day.tasks
                  .map(
                    (task, idx) => `
                  <tr style="background: ${
                    idx % 2 === 0 ? "#fafafa" : "#fff"
                  }; border-bottom: 1px solid #eee;">
                    <td style="padding: 5px 6px; color: #888; font-size: 8px; vertical-align: top;">${
                      idx + 1
                    }</td>
                    <td style="padding: 5px 6px; vertical-align: top;">
                      <div style="font-weight: 500; color: #222; font-size: 9px;">${
                        task.serviceName
                      }</div>
                      ${
                        task.workflowPhaseName
                          ? `<div style="font-size: 8px; color: #888; margin-top: 1px;">${task.workflowPhaseName}</div>`
                          : ""
                      }
                      ${
                        task.workflowExplanation
                          ? `<div style="font-size: 8px; color: #666; margin-top: 2px; padding: 3px 5px; background: #f5f5f5; border-radius: 3px;">${task.workflowExplanation}</div>`
                          : ""
                      }
                      ${
                        task.workflowTip
                          ? `<div style="font-size: 8px; color: #e65100; margin-top: 2px; padding: 3px 5px; background: #fff8e1; border-radius: 3px;">💡 ${task.workflowTip}</div>`
                          : ""
                      }
                    </td>
                    <td style="padding: 5px 6px; color: #555; vertical-align: top; font-size: 8px;">${
                      task.objectName
                    }</td>
                    <td style="padding: 5px 6px; color: #555; text-align: center; vertical-align: top; font-size: 8px;">${
                      task.quantity?.toFixed(1) || "-"
                    } ${task.unit || ""}</td>
                    <td style="padding: 5px 6px; font-weight: 600; text-align: right; vertical-align: top; font-size: 9px;">${formatTime(
                      task.workTime
                    )}</td>
                    <td style="padding: 5px 6px; color: #e65100; font-weight: 600; text-align: right; vertical-align: top; font-size: 9px;">${
                      task.waitTime > 0 ? `+${formatTime(task.waitTime)}` : "-"
                    }</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            ${
              day.dryingPhases.filter((p) => p.dryingTime > 0).length > 0
                ? `
            <div style="margin-top: 10px; padding: 8px 10px; background: #fff3e0; border-radius: 5px; border-left: 3px solid #e65100;">
              <div style="font-size: 10px; font-weight: 600; color: #e65100; margin-bottom: 6px;">⏱ Trocknungsphasen</div>
              ${day.dryingPhases
                .filter((p) => p.dryingTime > 0)
                .map(
                  (phase) => `
                <div style="margin-bottom: 6px; font-size: 8px;">
                  <div style="color: #333; font-weight: 500;">Nach "${
                    phase.afterTask
                  }": ${formatTime(phase.dryingTime)}</div>
                  ${
                    phase.sameRoomCanDo?.length > 0
                      ? `<div style="color: #2e7d32; margin-top: 2px; margin-left: 8px;">✓ Möglich: ${phase.sameRoomCanDo
                          .slice(0, 2)
                          .map((i) => i.task)
                          .join(", ")}${
                          phase.sameRoomCanDo.length > 2
                            ? ` (+${phase.sameRoomCanDo.length - 2})`
                            : ""
                        }</div>`
                      : ""
                  }
                  ${
                    customerApproval && phase.otherRoomCanDo?.length > 0
                      ? `<div style="color: #1976d2; margin-top: 2px; margin-left: 8px;">✓ Andere Räume: ${phase.otherRoomCanDo
                          .slice(0, 2)
                          .map((i) => i.task)
                          .join(", ")}${
                          phase.otherRoomCanDo.length > 2
                            ? ` (+${phase.otherRoomCanDo.length - 2})`
                            : ""
                        }</div>`
                      : ""
                  }
                </div>
              `
                )
                .join("")}
            </div>
            `
                : ""
            }
          </div>
        `;

        await addToPdf(dayHtml);
      }

      // === Legende - kompakt am Ende ===
      const legendHtml = `
        <div style="padding: 10px 15px; color: #333; font-size: 9px; line-height: 1.3;">
          <div style="padding: 10px 12px; background: #f5f5f5; border-radius: 5px;">
            <div style="font-size: 10px; font-weight: 600; color: #333; margin-bottom: 8px;">Legende</div>
            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; background: #4CAF50; border-radius: 2px; display: inline-block;"></span>
                <span>Arbeitszeit</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; background: #9C27B0; border-radius: 2px; display: inline-block;"></span>
                <span>Unterleistung</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; background: #FF9800; border-radius: 2px; display: inline-block;"></span>
                <span>Sonderangabe</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; background: #e65100; border-radius: 50%; display: inline-block;"></span>
                <span>Trocknung</span>
              </div>
            </div>
            <div style="font-size: 9px; font-weight: 500; color: #555; margin-bottom: 5px;">Parallelarbeit:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; border: 2px solid #4CAF50; border-radius: 2px; display: inline-block;"></span>
                <span>Gleicher Raum OK</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; border: 2px solid #f44336; border-radius: 2px; display: inline-block;"></span>
                <span>Nicht möglich</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; border: 2px solid #2196F3; border-radius: 2px; display: inline-block;"></span>
                <span>Anderer Raum</span>
              </div>
            </div>
          </div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 8px; color: #888; text-align: center;">
            ${
              companySettings?.companyName
                ? `${companySettings.companyName} | `
                : ""
            }Erstellt am ${dateStr}
          </div>
        </div>
      `;

      await addToPdf(legendHtml);

      // Seitenzahlen hinzufügen
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Seite ${i} von ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      // Cleanup
      document.body.removeChild(printContainer);

      // Dateiname mit Datum
      const fileDate = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const fileName = `Ablaufplan_${fileDate}.pdf`;

      if (preview) {
        const pdfBlob = pdf.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank");
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("PDF Export fehlgeschlagen:", error);
      alert("PDF Export fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setIsExporting(false);
    }
  };

  // =====================================================
  // INTELLIGENTE TAGESPLANUNG - Optimale Tagesfüllung
  // Mit Überstunden-Toleranz und intelligenter Task-Aufteilung
  // =====================================================
  const detailedPlan = useMemo(() => {
    if (!results?.objects) return { days: [], summary: {} };

    const dailyMinutes = MINUTES_PER_DAY;

    // Überstunden-Einstellungen aus companySettings
    const maxOvertimePercent = companySettings?.maxOvertimePercent ?? 15;
    const minTaskSplitTime = companySettings?.minTaskSplitTime ?? 60;

    // Maximale Tageszeit inkl. Überstunden
    const maxDayMinutes = Math.round(
      dailyMinutes * (1 + maxOvertimePercent / 100)
    );

    // Schritt 1: Alle Tasks sammeln mit Details
    const taskPool = [];
    const tasksByObject = {};

    results.objects.forEach((obj) => {
      tasksByObject[obj.id] = [];
      obj.services?.forEach((svc) => {
        const workArea = detectWorkArea(svc.serviceName);
        const phase =
          workflowPhases[svc.workflowPhase] || workflowPhases.beschichtung;

        const task = {
          id: `${obj.id}-${svc.serviceName}`,
          objectId: obj.id,
          objectName: obj.name,
          objectType: obj.type,
          serviceName: svc.serviceName,
          totalTime: Math.round(svc.finalTime),
          remainingTime: Math.round(svc.finalTime),
          waitTime: Math.round(svc.waitTime || 0),
          isSubService: svc.isSubService,
          isFromSpecialNote: svc.isFromSpecialNote,
          quantity: svc.quantity,
          unit: svc.unit,
          parentServiceName: svc.parentServiceName,
          workArea: workArea,
          workAreaName: getAreaName(workArea),
          workflowOrder: svc.workflowOrder || 20,
          workflowPhase: svc.workflowPhase || "beschichtung",
          workflowPhaseName: phase?.name || "Beschichtung",
          workflowPhaseIcon: phase?.icon || "📋",
          workflowPhaseColor: phase?.color || "#2196F3",
          workflowExplanation: svc.workflowExplanation || null,
          scheduled: false,
        };

        taskPool.push(task);
        tasksByObject[obj.id].push(task);
      });
    });

    // Sortiere Tasks innerhalb jedes Objekts nach workflowOrder
    const objectIds = Object.keys(tasksByObject);
    for (const objectId of objectIds) {
      tasksByObject[objectId].sort((a, b) => a.workflowOrder - b.workflowOrder);
    }

    // Schritt 2: Intelligente Tagesplanung
    const days = [];
    let currentDay = {
      dayNumber: 1,
      tasks: [],
      totalWorkTime: 0,
      totalWaitTime: 0,
      dryingPhases: [],
      utilization: 0, // Auslastung in %
      hasOvertime: false,
      overtimeMinutes: 0,
    };

    let timeInDay = 0;
    let activeDryingPhases = []; // [{objectId, area, endsAt, serviceName}]
    let currentObjectIndex = 0;

    // Hilfsfunktion: Prüft ob Arbeit während Trocknungsphase möglich ist
    const canWorkDuringDrying = (dryingArea, otherArea, sameRoom) => {
      if (dryingArea === "boden" && sameRoom) {
        return {
          canWork: false,
          reason: "Boden trocknet – Raum nicht betretbar",
        };
      }
      if (!sameRoom) {
        return { canWork: true, reason: "Anderer Raum – unabhängig" };
      }
      if (dryingArea === "decke" && sameRoom) {
        if (
          ["wand", "fenster", "tuer", "lackierung", "boden"].includes(otherArea)
        ) {
          return {
            canWork: true,
            reason: "Decke trocknet – andere Bereiche unabhängig",
          };
        }
      }
      if (dryingArea === "wand" && sameRoom) {
        if (["fenster", "tuer"].includes(otherArea)) {
          return {
            canWork: true,
            reason: "Wände trocknen – Fenster/Türen möglich",
          };
        }
        if (otherArea === "decke") {
          return {
            canWork: false,
            reason: "Wände trocknen – Decke würde Wände beschädigen",
          };
        }
      }
      if (["fenster", "tuer", "lackierung"].includes(dryingArea) && sameRoom) {
        if (["wand", "decke"].includes(otherArea)) {
          return {
            canWork: true,
            reason: "Türen/Fenster trocknen – Wände/Decke möglich",
          };
        }
      }
      if (dryingArea === otherArea) {
        return { canWork: false, reason: "Gleicher Bereich – muss trocknen" };
      }
      return {
        canWork: true,
        reason: "Verschiedene Bereiche – parallel möglich",
      };
    };

    // Hilfsfunktion: Nächsten verfügbaren Task finden
    const getNextAvailableTask = () => {
      // Prüfe alle Objekte, startend beim aktuellen
      for (let i = 0; i < objectIds.length; i++) {
        const objIndex = (currentObjectIndex + i) % objectIds.length;
        const objectId = objectIds[objIndex];
        const tasks = tasksByObject[objectId];

        for (const task of tasks) {
          if (task.remainingTime <= 0) continue;

          // Prüfe ob Vorgänger im gleichen Objekt abgeschlossen sind
          const taskIndex = tasks.indexOf(task);
          const predecessorsComplete = tasks
            .slice(0, taskIndex)
            .every((t) => t.remainingTime <= 0);
          if (!predecessorsComplete) continue;

          // Prüfe ob Objekt in Trocknungsphase ist
          const dryingPhase = activeDryingPhases.find(
            (d) => d.objectId === objectId
          );
          if (dryingPhase) {
            const canWork = canWorkDuringDrying(
              dryingPhase.area,
              task.workArea,
              true
            );
            if (!canWork.canWork) continue;
          }

          return {
            task,
            objectId,
            reason: predecessorsComplete
              ? "Workflow-Reihenfolge"
              : "Parallel möglich",
          };
        }
      }

      // Priorität 2: Tasks aus anderen Objekten (wenn Kundenfreigabe oder Trocknungszeit)
      if (customerApproval || activeDryingPhases.length > 0) {
        for (const objectId of objectIds) {
          const tasks = tasksByObject[objectId];

          for (const task of tasks) {
            if (task.remainingTime <= 0) continue;

            const taskIndex = tasks.indexOf(task);
            const predecessorsComplete = tasks
              .slice(0, taskIndex)
              .every((t) => t.remainingTime <= 0);
            if (!predecessorsComplete) continue;

            return {
              task,
              objectId,
              reason: "Parallele Arbeit in anderem Raum",
            };
          }
        }
      }

      return null;
    };

    // Hilfsfunktion: Task oder Teil davon zum Tag hinzufügen
    // MIT Überstunden-Logik und intelligenter Task-Aufteilung
    const addTaskToDay = (task, objectId) => {
      const remainingInDay = dailyMinutes - timeInDay;
      const maxRemainingWithOvertime = maxDayMinutes - timeInDay;

      // Wenn Tag schon über Maximum → kein Platz mehr
      if (maxRemainingWithOvertime <= 0) return false;

      let timeToSchedule = 0;
      let isOvertime = false;
      let isPartial = false;

      // ENTSCHEIDUNGSLOGIK:
      // 1. Passt Task komplett in reguläre Zeit?
      if (task.remainingTime <= remainingInDay) {
        timeToSchedule = task.remainingTime;
        isPartial = false;
        isOvertime = false;
      }
      // 2. Passt Task komplett MIT Überstunden?
      else if (task.remainingTime <= maxRemainingWithOvertime) {
        timeToSchedule = task.remainingTime;
        isPartial = false;
        isOvertime = timeInDay + task.remainingTime > dailyMinutes;
      }
      // 3. Task muss aufgeteilt werden
      else {
        // Berechne wie viel Rest auf Tag 2 käme
        const potentialRest = task.remainingTime - maxRemainingWithOvertime;

        // Wenn Rest < minTaskSplitTime → alles mit Überstunden machen (wenn möglich)
        if (potentialRest < minTaskSplitTime && potentialRest > 0) {
          // Prüfe ob wir den kompletten Task mit etwas mehr Überstunden schaffen könnten
          // (Ausnahme: Wenn Task viel zu groß, dann normal aufteilen)
          if (task.remainingTime <= maxDayMinutes * 1.1) {
            // Akzeptiere etwas mehr Überstunden um nicht für Rest einen neuen Tag zu brauchen
            timeToSchedule = task.remainingTime;
            isPartial = false;
            isOvertime = true;
          } else {
            // Task zu groß - aufteilen aber mit Überstunden
            timeToSchedule = maxRemainingWithOvertime;
            isPartial = true;
            isOvertime = timeInDay + timeToSchedule > dailyMinutes;
          }
        }
        // Wenn heutiger Teil < minTaskSplitTime → lieber alles morgen
        else if (remainingInDay < minTaskSplitTime && remainingInDay > 0) {
          // Zu wenig Zeit heute für sinnvollen Arbeitsblock → Task auf morgen verschieben
          return false; // Signal: Tag beenden, Task morgen machen
        }
        // Normale Aufteilung: Mit Überstunden so viel wie möglich heute
        else {
          timeToSchedule = maxRemainingWithOvertime;
          isPartial = true;
          isOvertime = timeInDay + timeToSchedule > dailyMinutes;
        }
      }

      const isContinuation = task.totalTime !== task.remainingTime;

      const taskEntry = {
        ...task,
        startTime: timeInDay,
        endTime: timeInDay + timeToSchedule,
        scheduledTime: timeToSchedule,
        isPartial: isPartial,
        isContinuation: isContinuation,
        isOvertime: isOvertime,
        overtimeMinutes: isOvertime
          ? Math.max(0, timeInDay + timeToSchedule - dailyMinutes)
          : 0,
        continuationInfo: isContinuation
          ? `Fortsetzung von Tag ${days.length}`
          : isPartial
          ? `Wird an Tag ${days.length + 2} fortgesetzt`
          : null,
      };

      currentDay.tasks.push(taskEntry);
      currentDay.totalWorkTime += timeToSchedule;
      timeInDay += timeToSchedule;
      task.remainingTime -= timeToSchedule;

      // Überstunden-Marker für den Tag setzen
      if (isOvertime) {
        currentDay.hasOvertime = true;
        currentDay.overtimeMinutes = Math.max(0, timeInDay - dailyMinutes);
      }

      // Trocknungsphase nur wenn Task komplett abgeschlossen
      if (task.remainingTime <= 0 && task.waitTime > 0) {
        currentDay.totalWaitTime += task.waitTime;

        // Detaillierte Trocknungsphase für Anzeige
        const remainingTasks = taskPool.filter((t) => t.remainingTime > 0);
        const otherObjectTasks = remainingTasks.filter(
          (t) => t.objectId !== objectId
        );
        const sameObjectTasks = remainingTasks.filter(
          (t) => t.objectId === objectId
        );

        const dryingPhase = {
          afterTask: task.serviceName,
          afterTaskObject: task.objectName,
          afterTaskArea: task.workAreaName,
          dryingArea: task.workArea,
          dryingTime: task.waitTime,
          dryingStart: timeInDay,
          dryingEnd: timeInDay + task.waitTime,
          sameRoomCanDo: [],
          sameRoomCannotDo: [],
          otherRoomCanDo: [],
          otherRoomPotential: [],
          parallelWorkScheduled: [], // NEU: Was tatsächlich geplant wurde
          reason: "",
        };

        // Analysiere was während Trocknung möglich ist
        sameObjectTasks.forEach((t) => {
          const parallelCheck = canWorkParallelInSameRoom(
            task.workArea,
            t.workArea
          );
          if (parallelCheck.canWork) {
            dryingPhase.sameRoomCanDo.push({
              task: t.serviceName,
              object: t.objectName,
              area: t.workAreaName,
              time: t.remainingTime,
              reason: parallelCheck.reason,
            });
          } else {
            dryingPhase.sameRoomCannotDo.push({
              task: t.serviceName,
              object: t.objectName,
              area: t.workAreaName,
              time: t.remainingTime,
              reason: parallelCheck.reason,
            });
          }
        });

        if (customerApproval) {
          otherObjectTasks.forEach((t) => {
            const fits = t.remainingTime <= task.waitTime;
            dryingPhase.otherRoomCanDo.push({
              task: t.serviceName,
              object: t.objectName,
              area: t.workAreaName,
              time: t.remainingTime,
              reason: fits
                ? `Passt komplett in Trocknungszeit`
                : `Kann begonnen werden`,
              fitsInDryingTime: fits,
            });
          });
          dryingPhase.reason =
            "Mit Kundenfreigabe: Arbeiten in anderen Räumen während der Trocknungszeit.";
        } else {
          otherObjectTasks.forEach((t) => {
            const fits = t.remainingTime <= task.waitTime;
            dryingPhase.otherRoomPotential.push({
              task: t.serviceName,
              object: t.objectName,
              area: t.workAreaName,
              time: t.remainingTime,
              reason: fits ? `Würde komplett passen` : `Könnte begonnen werden`,
              fitsInDryingTime: fits,
            });
          });
          dryingPhase.reason =
            "Ohne Kundenfreigabe: Wartezeit bis Trocknung abgeschlossen.";
        }

        currentDay.dryingPhases.push(dryingPhase);

        // Aktive Trocknungsphase registrieren
        activeDryingPhases.push({
          objectId: objectId,
          area: task.workArea,
          endsAt: timeInDay + task.waitTime,
          serviceName: task.serviceName,
        });
      }

      if (task.remainingTime <= 0) {
        task.scheduled = true;
      }

      return true;
    };

    // Hilfsfunktion: Neuen Tag starten
    const startNewDay = () => {
      // Auslastung berechnen (bei Überstunden kann > 100% sein)
      currentDay.utilization = Math.round(
        (currentDay.totalWorkTime / dailyMinutes) * 100
      );
      // Überstunden-Info final setzen
      currentDay.overtimeMinutes = Math.max(
        0,
        currentDay.totalWorkTime - dailyMinutes
      );
      currentDay.hasOvertime = currentDay.overtimeMinutes > 0;

      days.push({ ...currentDay });
      currentDay = {
        dayNumber: days.length + 1,
        tasks: [],
        totalWorkTime: 0,
        totalWaitTime: 0,
        dryingPhases: [],
        utilization: 0,
        hasOvertime: false,
        overtimeMinutes: 0,
      };
      timeInDay = 0;
      activeDryingPhases = []; // Über Nacht trocknen alle Oberflächen
    };

    // Hauptschleife: Tage optimal füllen
    let iterations = 0;
    const maxIterations = 1000;

    while (iterations < maxIterations) {
      iterations++;

      // Alle Tasks erledigt?
      const allDone = taskPool.every((t) => t.remainingTime <= 0);
      if (allDone) break;

      // Abgelaufene Trocknungsphasen entfernen
      activeDryingPhases = activeDryingPhases.filter(
        (d) => d.endsAt > timeInDay
      );

      // Nächsten verfügbaren Task finden
      const next = getNextAvailableTask();

      if (next) {
        const added = addTaskToDay(next.task, next.objectId);

        if (!added) {
          // Tag voll - neuen Tag starten
          startNewDay();
          continue;
        }

        // Bei Trocknungsphase: Zum nächsten Objekt wechseln wenn möglich
        if (activeDryingPhases.length > 0 && customerApproval) {
          currentObjectIndex = (currentObjectIndex + 1) % objectIds.length;
        }
      } else {
        // Kein Task verfügbar
        // Prüfe ob Tag mit Überstunden fast voll ist
        if (timeInDay >= maxDayMinutes * 0.95) {
          // Tag ist fast voll (inkl. Überstunden)
          startNewDay();
        } else if (activeDryingPhases.length > 0) {
          // Trocknungszeit - prüfen ob heute noch etwas passiert
          const minDryingEnd = Math.min(
            ...activeDryingPhases.map((d) => d.endsAt)
          );

          // Trocknung kann auch während Überstunden enden
          if (minDryingEnd <= maxDayMinutes) {
            // Trocknung endet heute (evtl. mit Überstunden) - Zeit vorspulen
            timeInDay = minDryingEnd;
            activeDryingPhases = activeDryingPhases.filter(
              (d) => d.endsAt > timeInDay
            );
          } else {
            // Trocknung dauert bis morgen - prüfe ob andere Räume bearbeitet werden können
            const unfinishedOtherObjects = taskPool.filter(
              (t) =>
                t.remainingTime > 0 &&
                !activeDryingPhases.some((d) => d.objectId === t.objectId)
            );

            if (unfinishedOtherObjects.length > 0 && customerApproval) {
              // Noch Arbeit in anderen Räumen - weitermachen
              continue;
            } else {
              // Tag beenden
              startNewDay();
            }
          }
        } else {
          // Sicherheit: Tag beenden
          if (currentDay.tasks.length > 0) {
            startNewDay();
          } else {
            break;
          }
        }
      }
    }

    // Letzten Tag hinzufügen wenn nicht leer
    if (currentDay.tasks.length > 0) {
      currentDay.utilization = Math.round(
        (currentDay.totalWorkTime / dailyMinutes) * 100
      );
      currentDay.overtimeMinutes = Math.max(
        0,
        currentDay.totalWorkTime - dailyMinutes
      );
      currentDay.hasOvertime = currentDay.overtimeMinutes > 0;
      days.push(currentDay);
    }

    // Zusammenfassung berechnen
    const totalWorkMinutes =
      results.totalTime || taskPool.reduce((sum, t) => sum + t.totalTime, 0);
    const totalWorkHours = totalWorkMinutes / 60;
    const totalWaitMinutes = taskPool.reduce(
      (sum, t) => sum + (t.waitTime || 0),
      0
    );
    const avgUtilization =
      days.length > 0
        ? Math.round(
            days.reduce((sum, d) => sum + d.utilization, 0) / days.length
          )
        : 0;

    // Mitarbeiter-Erklärung
    let employeeExplanation = [];

    if (totalWorkHours <= HOURS_PER_DAY) {
      employeeExplanation.push({
        text: `Die Gesamtarbeitszeit (${formatTime(
          totalWorkMinutes
        )}) passt in einen Arbeitstag (${HOURS_PER_DAY}h).`,
        type: "info",
      });
      employeeExplanation.push({
        text: `Ein Mitarbeiter ist für diese Arbeit optimal.`,
        type: "result",
      });
    } else {
      const optimalEmployees =
        results.optimalEmployees || Math.ceil(totalWorkHours / HOURS_PER_DAY);
      const hoursPerEmployee = totalWorkHours / optimalEmployees;

      employeeExplanation.push({
        text: `Gesamtarbeitszeit: ${formatTime(
          totalWorkMinutes
        )} (${totalWorkHours.toFixed(1)} Stunden)`,
        type: "info",
      });
      employeeExplanation.push({
        text: `Arbeitstag: ${HOURS_PER_DAY} Stunden`,
        type: "info",
      });

      if (hoursPerEmployee < 4) {
        employeeExplanation.push({
          text: `Bei mehr Mitarbeitern würde jeder weniger als 4h Arbeit haben – Effizienzverlust.`,
          type: "warning",
        });
      }

      employeeExplanation.push({
        text: `Berechnung: ${totalWorkHours.toFixed(
          1
        )}h ÷ ${HOURS_PER_DAY}h = ${(totalWorkHours / HOURS_PER_DAY).toFixed(
          1
        )} → ${optimalEmployees} Mitarbeiter`,
        type: "calculation",
      });
    }

    // Hinweise zu Trocknungszeiten
    if (totalWaitMinutes > 30) {
      if (customerApproval) {
        employeeExplanation.push({
          text: `Mit Kundenfreigabe: Während ${formatTime(
            totalWaitMinutes
          )} Trocknungszeit werden Arbeiten in anderen Räumen durchgeführt.`,
          type: "parallel",
        });
      } else {
        employeeExplanation.push({
          text: `Hinweis: Es gibt ${formatTime(
            totalWaitMinutes
          )} Trocknungszeit.`,
          type: "warning",
        });
        employeeExplanation.push({
          text: `Tipp: Mit Kundenfreigabe könnten während der Trocknungszeiten Arbeiten in anderen Räumen durchgeführt werden.`,
          type: "tip",
        });
      }
    }

    // Hinweis zu optimierter Planung
    const hasPartialTasks = days.some((d) =>
      d.tasks.some((t) => t.isPartial || t.isContinuation)
    );
    if (hasPartialTasks) {
      employeeExplanation.push({
        text: `Die Planung wurde optimiert: Einige Arbeiten werden über mehrere Tage aufgeteilt, um die Arbeitstage bestmöglich zu nutzen.`,
        type: "info",
      });
    }

    // Auslastungs-Info
    if (avgUtilization > 0) {
      employeeExplanation.push({
        text: `Durchschnittliche Tagesauslastung: ${avgUtilization}%`,
        type:
          avgUtilization >= 80
            ? "success"
            : avgUtilization >= 60
            ? "info"
            : "warning",
      });
    }

    // Überstunden-Info
    const daysWithOvertime = days.filter(
      (d) => d.hasOvertime && d.overtimeMinutes > 0
    );
    const totalOvertimeMinutes = days.reduce(
      (sum, d) => sum + (d.overtimeMinutes || 0),
      0
    );
    if (daysWithOvertime.length > 0) {
      employeeExplanation.push({
        text: `Überstunden: ${formatTime(totalOvertimeMinutes)} an ${
          daysWithOvertime.length
        } Tag(en) – vermeidet ineffiziente Kurztage.`,
        type: "info",
      });
    }

    return {
      days,
      allTasks: taskPool,
      summary: {
        totalDays: days.length,
        totalWorkTime: totalWorkMinutes,
        totalWaitTime: totalWaitMinutes,
        optimalEmployees: results.optimalEmployees || 1,
        employeeExplanation,
        canParallelize: customerApproval && totalWaitMinutes > 30,
        customerApproval,
        avgUtilization,
      },
    };
  }, [results, customerApproval]);

  if (!results?.objects?.length) return null;

  // Daten direkt aus results für Konsistenz mit Preisübersicht
  const totalDays = results.totalDays || 1;
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

                  {/* Timeline */}
                  <div style={{ padding: "15px" }}>
                    {/* Zeitskala */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                        fontSize: "11px",
                        color: "#999",
                        paddingLeft: "2px",
                        paddingRight: "2px",
                      }}
                    >
                      {[0, 2, 4, 6, 8].map((h) => (
                        <span key={h}>{h}h</span>
                      ))}
                    </div>

                    {/* Timeline Bar */}
                    <div
                      style={{
                        position: "relative",
                        height: "32px",
                        background: "#f0f0f0",
                        borderRadius: "4px",
                        marginBottom: "15px",
                        overflow: "hidden",
                      }}
                    >
                      {/* Stundenmarkierungen */}
                      {[1, 2, 3, 4, 5, 6, 7].map((h) => (
                        <div
                          key={h}
                          style={{
                            position: "absolute",
                            left: `${(h / 8) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: "1px",
                            background: "#ddd",
                          }}
                        />
                      ))}

                      {/* Arbeitsblöcke */}
                      {day.tasks.map((task, idx) => {
                        const taskDuration =
                          task.scheduledTime || task.workTime;
                        const widthPercent =
                          (taskDuration / MINUTES_PER_DAY) * 100;
                        const leftPercent =
                          (task.startTime / MINUTES_PER_DAY) * 100;

                        let bgColor = "#4CAF50";
                        if (task.isSubService) bgColor = "#7E57C2";
                        else if (task.isFromSpecialNote) bgColor = "#FF7043";

                        return (
                          <div
                            key={idx}
                            style={{
                              position: "absolute",
                              left: `${leftPercent}%`,
                              width: `${Math.max(widthPercent, 1)}%`,
                              height: "100%",
                              background: bgColor,
                              borderRadius: "2px",
                              display: "flex",
                              alignItems: "center",
                              padding: "0 6px",
                              fontSize: "10px",
                              color: "white",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              boxSizing: "border-box",
                            }}
                            title={`${task.serviceName} (${
                              task.objectName
                            }) - ${formatTime(taskDuration)}${
                              task.isPartial ? " (wird fortgesetzt)" : ""
                            }${task.isContinuation ? " (Fortsetzung)" : ""}`}
                          >
                            {widthPercent > 12 ? task.serviceName : ""}
                          </div>
                        );
                      })}
                    </div>

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

                      {day.tasks.map((task, taskIdx) => (
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
                            borderLeft: `3px solid ${
                              task.isSubService
                                ? "#7E57C2"
                                : task.isFromSpecialNote
                                ? "#FF7043"
                                : "#4CAF50"
                            }`,
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
                                style={{ fontWeight: "normal", color: "#888" }}
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
                              {formatTime(task.scheduledTime || task.workTime)}
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

                            {/* Unterleistungs-Schritt Anzeige */}
                            {task.subWorkflowOrder && task.subWorkflowTotal && (
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
                                    style={{ marginLeft: "8px", color: "#666" }}
                                  >
                                    (Gesamt: {formatTime(task.totalTime)},
                                    heute:{" "}
                                    {formatTime(
                                      task.scheduledTime || task.workTime
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

                            {(task.isSubService || task.isFromSpecialNote) && (
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
                      ))}
                    </div>

                    {/* Trocknungsphasen mit detaillierter Erklärung */}
                    {day.dryingPhases && day.dryingPhases.length > 0 && (
                      <div style={{ marginTop: "15px" }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#e65100",
                            marginBottom: "10px",
                          }}
                        >
                          Trocknungs- und Wartezeiten:
                        </div>

                        {day.dryingPhases.map((phase, idx) => (
                          <div
                            key={idx}
                            style={{
                              marginBottom: "15px",
                              padding: "15px",
                              background: "#FFF8E1",
                              borderRadius: "6px",
                              border: "1px solid #FFE082",
                            }}
                          >
                            {/* Trocknungs-Header */}
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "500",
                                color: "#E65100",
                                marginBottom: "10px",
                                paddingBottom: "10px",
                                borderBottom: "1px solid #FFE082",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                }}
                              >
                                <span>Nach „{phase.afterTask}"</span>
                                <span
                                  style={{
                                    fontWeight: "normal",
                                    color: "#666",
                                  }}
                                >
                                  {formatTime(phase.dryingTime)} Trocknungszeit
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "normal",
                                  color: "#666",
                                  marginTop: "4px",
                                }}
                              >
                                Raum: <strong>{phase.afterTaskObject}</strong> ·
                                Bereich: <strong>{phase.afterTaskArea}</strong>
                              </div>
                            </div>

                            {/* Erklärung */}
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#555",
                                marginBottom: "12px",
                                lineHeight: "1.5",
                              }}
                            >
                              {phase.reason}
                            </div>

                            {/* === GLEICHER RAUM: Was kann parallel gemacht werden === */}
                            {phase.sameRoomCanDo.length > 0 && (
                              <div style={{ marginBottom: "12px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    color: "#2E7D32",
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <span style={{ fontSize: "14px" }}>✓</span>
                                  Im gleichen Raum ({phase.afterTaskObject})
                                  möglich:
                                </div>
                                {phase.sameRoomCanDo.map((item, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: "12px",
                                      padding: "8px 10px",
                                      background: "#E8F5E9",
                                      borderRadius: "4px",
                                      marginBottom: "4px",
                                      borderLeft: "3px solid #4CAF50",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                      }}
                                    >
                                      <span>
                                        <strong>{item.task}</strong>
                                        <span
                                          style={{
                                            color: "#666",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          ({item.area})
                                        </span>
                                      </span>
                                      <span style={{ color: "#666" }}>
                                        {formatTime(item.time)}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#2E7D32",
                                        marginTop: "4px",
                                      }}
                                    >
                                      → {item.reason}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* === GLEICHER RAUM: Was kann NICHT gemacht werden === */}
                            {phase.sameRoomCannotDo.length > 0 && (
                              <div style={{ marginBottom: "12px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    color: "#C62828",
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <span style={{ fontSize: "14px" }}>✗</span>
                                  Im gleichen Raum ({phase.afterTaskObject})
                                  NICHT möglich:
                                </div>
                                {phase.sameRoomCannotDo.map((item, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: "12px",
                                      padding: "8px 10px",
                                      background: "#FFEBEE",
                                      borderRadius: "4px",
                                      marginBottom: "4px",
                                      borderLeft: "3px solid #E53935",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                      }}
                                    >
                                      <span>
                                        <strong>{item.task}</strong>
                                        <span
                                          style={{
                                            color: "#666",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          ({item.area})
                                        </span>
                                      </span>
                                      <span style={{ color: "#666" }}>
                                        {formatTime(item.time)}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#C62828",
                                        marginTop: "4px",
                                      }}
                                    >
                                      → {item.reason}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* === ANDERE RÄUME: Mit Kundenfreigabe möglich === */}
                            {phase.otherRoomCanDo.length > 0 && (
                              <div style={{ marginBottom: "12px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    color: "#1565C0",
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <span style={{ fontSize: "14px" }}>✓</span>
                                  In anderen Räumen möglich (Kundenfreigabe
                                  aktiv):
                                </div>
                                {phase.otherRoomCanDo.map((item, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: "12px",
                                      padding: "8px 10px",
                                      background: "#E3F2FD",
                                      borderRadius: "4px",
                                      marginBottom: "4px",
                                      borderLeft: "3px solid #1976D2",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                      }}
                                    >
                                      <span>
                                        <strong>{item.task}</strong>
                                        <span
                                          style={{
                                            color: "#666",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          – Raum: {item.object} ({item.area})
                                        </span>
                                      </span>
                                      <span style={{ color: "#666" }}>
                                        {formatTime(item.time)}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#1565C0",
                                        marginTop: "4px",
                                      }}
                                    >
                                      → {item.reason}
                                      {item.fitsInDryingTime && (
                                        <span
                                          style={{
                                            marginLeft: "8px",
                                            background: "#1976D2",
                                            color: "white",
                                            padding: "1px 6px",
                                            borderRadius: "3px",
                                            fontSize: "10px",
                                          }}
                                        >
                                          Passt komplett
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* === ANDERE RÄUME: Potenzial OHNE Kundenfreigabe === */}
                            {phase.otherRoomPotential.length > 0 && (
                              <div style={{ marginBottom: "12px" }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "500",
                                    color: "#7B1FA2",
                                    marginBottom: "6px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <span style={{ fontSize: "14px" }}>💡</span>
                                  Mit Kundenfreigabe WÄREN in anderen Räumen
                                  möglich:
                                </div>
                                {phase.otherRoomPotential.map((item, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: "12px",
                                      padding: "8px 10px",
                                      background: "#F3E5F5",
                                      borderRadius: "4px",
                                      marginBottom: "4px",
                                      borderLeft: "3px solid #9C27B0",
                                      opacity: 0.85,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: "6px",
                                      }}
                                    >
                                      <span>
                                        <strong>{item.task}</strong>
                                        <span
                                          style={{
                                            color: "#666",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          – Raum: {item.object} ({item.area})
                                        </span>
                                      </span>
                                      <span style={{ color: "#666" }}>
                                        {formatTime(item.time)}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#7B1FA2",
                                        marginTop: "4px",
                                      }}
                                    >
                                      → {item.reason}
                                      {item.fitsInDryingTime && (
                                        <span
                                          style={{
                                            marginLeft: "8px",
                                            background: "#9C27B0",
                                            color: "white",
                                            padding: "1px 6px",
                                            borderRadius: "3px",
                                            fontSize: "10px",
                                          }}
                                        >
                                          Würde komplett passen
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#7B1FA2",
                                    marginTop: "8px",
                                    padding: "8px",
                                    background: "#EDE7F6",
                                    borderRadius: "4px",
                                    fontStyle: "italic",
                                  }}
                                >
                                  Hinweis: Ohne Kundenfreigabe müssen
                                  Mitarbeiter warten, bis die Trocknung
                                  abgeschlossen ist. Mit Kundenfreigabe könnten
                                  diese Arbeiten parallel durchgeführt werden.
                                </div>
                              </div>
                            )}

                            {/* Keine weiteren Arbeiten */}
                            {phase.sameRoomCanDo.length === 0 &&
                              phase.sameRoomCannotDo.length === 0 &&
                              phase.otherRoomCanDo.length === 0 &&
                              phase.otherRoomPotential.length === 0 && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#666",
                                    fontStyle: "italic",
                                  }}
                                >
                                  Keine weiteren Arbeiten geplant während dieser
                                  Trocknungsphase.
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    )}
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
          </div>
        </div>
      )}
    </>
  );
}
