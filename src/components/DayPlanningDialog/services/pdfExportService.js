import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { formatTime } from "../utils/timeFormatters";

/**
 * Exportiert den detaillierten Ablaufplan als PDF
 * @param {Object} params - Export-Parameter
 * @param {Object} params.detailedPlan - Detaillierter Plan mit Tagen und Zusammenfassung
 * @param {Object} params.results - Berechnungsergebnisse
 * @param {Object} params.companySettings - Firmeneinstellungen
 * @param {boolean} params.customerApproval - Ob Kundenfreigabe vorhanden ist
 * @param {boolean} params.preview - Ob Vorschau geöffnet werden soll (statt Download)
 * @returns {Promise<void>}
 */
export const exportDayPlanningToPDF = async ({
  detailedPlan,
  results,
  companySettings,
  customerApproval,
  preview = false,
}) => {
  try {
    // WICHTIG: Tagesanzahl aus detailedPlan nehmen (tatsächliche Anzahl der geplanten Tage)
    const totalDaysVal =
      detailedPlan?.summary?.totalDays ||
      detailedPlan?.days?.length ||
      results?.totalDays ||
      1;
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
                    }${
                    task.employeeId
                      ? ` <span style="background: ${
                          task.employeeId === 1
                            ? "#1976d2"
                            : task.employeeId === 2
                            ? "#388e3c"
                            : "#7b1fa2"
                        }; color: white; padding: 1px 4px; border-radius: 2px; font-size: 7px; margin-left: 4px;">MA ${
                          task.employeeId
                        }</span>`
                      : ""
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
    throw new Error("PDF Export fehlgeschlagen. Bitte versuchen Sie es erneut.");
  }
};
