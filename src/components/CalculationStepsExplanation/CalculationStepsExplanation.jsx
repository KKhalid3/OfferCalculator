import React, { useState } from 'react';

export default function CalculationStepsExplanation({ object, services, quantities, customerApproval, specialNotesData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!object || !quantities) return null;

  const steps = [];
  
  // Sonderangaben-Daten für bessere Anzeige (aus Result oder Redux)
  const specialNotes = specialNotesData || [];

  // Schritt 1: Leistungserfassung
  steps.push({
    number: 1,
    title: 'Leistungserfassung',
    description: `Für die ausgewählte Hauptleistung wurden automatisch alle zugehörigen Unterleistungen hinzugefügt.`,
    details: services && services.length > 0 
      ? `Gefundene Leistungen: ${services.map(s => s.serviceName).join(', ')}`
      : 'Keine Leistungen gefunden'
  });

  // Schritt 3: Mengenberechnung Decke
  steps.push({
    number: 3,
    title: 'Mengenberechnung Decke',
    description: `Die Deckenfläche wird direkt aus der Grundfläche übernommen (1:1).`,
    details: `Grundfläche: ${object.floorArea} m² → Deckenfläche: ${quantities.ceilingArea?.toFixed(2) || 0} m²`
  });

  // Schritt 4: Mengenberechnung Umfang
  const calculatedPerimeter = 4 * Math.sqrt(object.floorArea);
  steps.push({
    number: 4,
    title: 'Mengenberechnung Raumumfang',
    description: `Der Umfang wird berechnet mit der Formel: Umfang = 4 × √(Grundfläche).`,
    details: `Berechnung: 4 × √${object.floorArea} = ${calculatedPerimeter.toFixed(2)} m`
  });

  // Schritt 5: Objekttyp-Faktoren
  if (quantities.quantityFactor !== 1 || quantities.serviceFactor !== 1) {
    steps.push({
      number: 5,
      title: 'Objekttyp-Faktoren anwenden',
      description: `Für den Objekttyp "${object.type}" wurden spezifische Faktoren angewendet.`,
      details: quantities.quantityFactor !== 1 
        ? `Mengenfaktor: ${quantities.quantityFactor} (angewendet auf Umfang) → Neuer Umfang: ${quantities.perimeter?.toFixed(2) || 0} m`
        : `Kein Mengenfaktor für ${object.type}`,
      additionalDetails: quantities.serviceFactor !== 1
        ? `Leistungsfaktor: ${quantities.serviceFactor} (wird auf die Arbeitszeit angewendet)`
        : `Kein Leistungsfaktor für ${object.type}`
    });
  } else {
    steps.push({
      number: 5,
      title: 'Objekttyp-Faktoren prüfen',
      description: `Für den Objekttyp "${object.type}" wurden keine speziellen Faktoren gefunden.`,
      details: 'Standardfaktoren (1.0) werden verwendet.'
    });
  }

  // Schritt 6: Mengenberechnung Wände
  steps.push({
    number: 6,
    title: 'Mengenberechnung Wandflächen',
    description: `Die Wandfläche wird berechnet: Wandfläche = Umfang × Raumhöhe.`,
    details: `Berechnung: ${quantities.perimeter?.toFixed(2) || 0} m × ${object.height} m = ${quantities.wallArea?.toFixed(2) || 0} m²`
  });

  // Schritt 7: Sonderangaben (detailliert mit Faktoren)
  if (specialNotes && specialNotes.length > 0) {
    // Kategorisiere Sonderangaben
    const notesWithFactor = specialNotes.filter(n => n.factor && n.factor !== 1);
    const notesWithRequiredService = specialNotes.filter(n => n.requiredService);
    const notesSeparatelyCharged = specialNotes.filter(n => (!n.factor || n.factor === 1) && !n.requiredService);
    
    let detailsText = `${specialNotes.length} Sonderangabe(n) ausgewählt:`;
    let additionalText = '';
    
    // Sonderangaben mit Zeitfaktor
    if (notesWithFactor.length > 0) {
      additionalText += `\n\n⏱️ Zeitfaktoren angewendet:\n`;
      notesWithFactor.forEach(note => {
        additionalText += `• "${note.title}": Faktor ×${note.factor} (${((note.factor - 1) * 100).toFixed(0)}% mehr Zeit)\n`;
      });
    }
    
    // Sonderangaben mit Zusatzleistung
    if (notesWithRequiredService.length > 0) {
      additionalText += `\n\n➕ Zusatzleistungen aktiviert:\n`;
      notesWithRequiredService.forEach(note => {
        additionalText += `• "${note.title}" aktiviert eine zusätzliche Leistung\n`;
      });
    }
    
    // Sonderangaben die separat abgerechnet werden
    if (notesSeparatelyCharged.length > 0) {
      additionalText += `\n\nℹ️ Separat abgerechnet (nicht in Kalkulation):\n`;
      notesSeparatelyCharged.forEach(note => {
        additionalText += `• "${note.title}" – wird nach tatsächlichem Aufwand separat berechnet\n`;
      });
    }
    
    steps.push({
      number: 7,
      title: 'Sonderangaben berücksichtigen',
      description: `Für dieses Objekt wurden Sonderangaben erfasst. Je nach Art beeinflussen sie die Arbeitszeit, aktivieren Zusatzleistungen oder werden separat abgerechnet.`,
      details: detailsText,
      additionalDetails: additionalText.trim() || 'Alle Sonderangaben werden entsprechend ihrer Konfiguration berücksichtigt.',
      specialNotesDetails: specialNotes // Für detaillierte Anzeige im Template
    });
  } else if (object.specialNotes && object.specialNotes.length > 0) {
    // Fallback: Nur IDs vorhanden, keine detaillierten Daten
    steps.push({
      number: 7,
      title: 'Sonderangaben berücksichtigen',
      description: `Für dieses Objekt wurden Sonderangaben erfasst.`,
      details: `${object.specialNotes.length} Sonderangabe(n) aktiv. Die Faktoren werden auf die Baseline-Zeit angewendet.`,
      additionalDetails: 'Hinweis: Detaillierte Sonderangaben-Informationen werden geladen...'
    });
  } else {
    steps.push({
      number: 7,
      title: 'Sonderangaben prüfen',
      description: `Keine Sonderangaben für dieses Objekt erfasst.`,
      details: 'Standard-Arbeitszeiten werden verwendet. Mögliche Sonderangaben wären z.B. Nikotinbelastung, starke Verschmutzung, Stuck, Umräumarbeiten etc.'
    });
  }

  // Schritt 8-9: Baseline und Effizienz (wird pro Service angezeigt)
  if (services && services.length > 0) {
    services.forEach((svc, idx) => {
      // Schritt 8: Baseline
      const timePerUnit = svc.quantity > 0 ? (svc.baseTime / svc.quantity) : 0;
      steps.push({
        number: 8,
        title: `Baseline-Zeit (${svc.serviceName})`,
        description: `Die Standardkalkulationszeit wurde aus dem Onboarding herangezogen. Sie basiert auf einem definierten Standardfall.`,
        details: `Baseline: ${(svc.baseTime / 60)?.toFixed(2) || 0} Stunden für ${svc.quantity?.toFixed(2) || 0} m²`,
        additionalDetails: `Zeit je Einheit: ${(timePerUnit / 60)?.toFixed(4) || 0} Stunden/m² (berechnet aus Standardfall: Standard-Zeit ÷ Standard-Menge × aktuelle Menge)`,
        serviceSpecific: true
      });

      // Schritt 9: Effizienz
      if (svc.efficiency && svc.efficiency !== 1) {
        const timeSaved = svc.baseTime - svc.finalTime;
        steps.push({
          number: 9,
          title: `Effizienzgrad (${svc.serviceName})`,
          description: customerApproval 
            ? `Durch die Kundenfreigabe konnten Effizienzsteigerungen angewendet werden. Bei größeren Mengen wird die Arbeit effizienter.`
            : `Effizienzsteigerungen sind möglich, benötigen aber Kundenfreigabe.`,
          details: `Effizienzfaktor: ${(svc.efficiency * 100).toFixed(1)}% → Zeit reduziert von ${(svc.baseTime / 60)?.toFixed(2)} h auf ${(svc.finalTime / 60)?.toFixed(2)} h`,
          additionalDetails: timeSaved > 0 
            ? `Zeitersparnis: ${(timeSaved / 60)?.toFixed(2)} Stunden durch Effizienzsteigerung.`
            : 'Die Effizienzsteigerung basiert auf der Gesamtmenge und der maximalen Tagesproduktivität.'
        });
      } else {
        steps.push({
          number: 9,
          title: `Effizienzgrad (${svc.serviceName})`,
          description: customerApproval 
            ? `Keine Effizienzsteigerung möglich. Die Menge ist zu gering für eine Effizienzsteigerung oder bereits optimal.`
            : `Effizienzsteigerungen benötigen Kundenfreigabe für parallele Arbeiten an mehreren Objekten.`,
          details: 'Standard-Effizienz (100%) wird verwendet. Die Baseline-Zeit wird unverändert übernommen.',
          additionalDetails: customerApproval 
            ? 'Die Effizienzsteigerung beginnt ab einer bestimmten Menge (Effektivitätsmenge) und steigt linear mit der Menge.'
            : 'Aktivieren Sie die Kundenfreigabe, um Effizienzsteigerungen bei größeren Mengen zu nutzen.'
        });
      }
    });
  }

  // Schritt 10: Kundenfreigabe
  steps.push({
    number: 10,
    title: 'Kundenfreigabe',
    description: customerApproval
      ? `Kundenfreigabe erteilt: Effizienzsteigerungen können angewendet werden.`
      : `Keine Kundenfreigabe: Effizienzsteigerungen werden nicht angewendet.`,
    details: customerApproval
      ? 'Mehrere Objekte können gleichzeitig bearbeitet werden, was zu Effizienzsteigerungen führt.'
      : 'Aktivieren Sie die Freigabe, um Effizienzsteigerungen bei größeren Mengen zu nutzen.'
  });

  // Schritt 11-13: Workflow (wird separat angezeigt)

  return (
    <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
      <h3 
        style={{ 
          marginBottom: '15px', 
          color: '#856404',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          userSelect: 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ 
          display: 'inline-block',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
          fontSize: '14px'
        }}>
          ▶
        </span>
        📋 Schritt-für-Schritt Erklärung der Berechnung
      </h3>
      
      {isExpanded && steps.map((step, idx) => (
        <div 
          key={idx} 
          style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            background: 'white', 
            borderRadius: '4px',
            borderLeft: step.number === 7 && step.specialNotesDetails?.length > 0 
              ? '4px solid #ff9800' 
              : '4px solid #007bff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '30px', 
              height: '30px', 
              background: step.number === 7 && step.specialNotesDetails?.length > 0 ? '#ff9800' : '#007bff', 
              color: 'white', 
              borderRadius: '50%', 
              textAlign: 'center', 
              lineHeight: '30px',
              fontWeight: 'bold',
              marginRight: '10px'
            }}>
              {step.number}
            </span>
            <h4 style={{ margin: 0, color: '#333' }}>{step.title}</h4>
          </div>
          
          <p style={{ margin: '8px 0', color: '#666', fontSize: '14px' }}>
            {step.description}
          </p>
          
          <div style={{ 
            marginTop: '8px', 
            padding: '10px', 
            background: '#f8f9fa', 
            borderRadius: '4px',
            fontSize: '13px',
            color: '#495057'
          }}>
            <strong>Details:</strong> {step.details}
          </div>
          
          {/* Spezielle Anzeige für Sonderangaben (Schritt 7) */}
          {step.specialNotesDetails && step.specialNotesDetails.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              {step.specialNotesDetails.map((note, noteIdx) => {
                const hasFactor = note.factor && note.factor !== 1;
                const hasRequiredService = note.requiredService;
                const isSeparatelyCharged = !hasFactor && !hasRequiredService;
                
                return (
                  <div 
                    key={noteIdx}
                    style={{
                      padding: '10px',
                      marginBottom: '8px',
                      background: hasFactor ? '#fff3e0' : isSeparatelyCharged ? '#f5f5f5' : '#e8f5e9',
                      borderRadius: '4px',
                      border: `1px solid ${hasFactor ? '#ff9800' : isSeparatelyCharged ? '#bdbdbd' : '#4caf50'}`,
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: hasFactor ? '#e65100' : isSeparatelyCharged ? '#616161' : '#2e7d32' }}>
                      {hasFactor ? '⏱️' : hasRequiredService ? '➕' : 'ℹ️'} {note.title}
                    </div>
                    {note.uxDescription && (
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontStyle: 'italic' }}>
                        {note.uxDescription}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {hasFactor && (
                        <span style={{ 
                          background: '#ff9800', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          marginRight: '8px'
                        }}>
                          Zeitfaktor: ×{note.factor} (+{((note.factor - 1) * 100).toFixed(0)}%)
                        </span>
                      )}
                      {hasRequiredService && (
                        <span style={{ 
                          background: '#4caf50', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          marginRight: '8px'
                        }}>
                          Aktiviert Zusatzleistung
                        </span>
                      )}
                      {isSeparatelyCharged && (
                        <span style={{ 
                          background: '#9e9e9e', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px'
                        }}>
                          Wird separat abgerechnet
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {step.additionalDetails && !step.specialNotesDetails && (
            <div style={{ 
              marginTop: '5px', 
              padding: '10px', 
              background: '#f8f9fa', 
              borderRadius: '4px',
              fontSize: '13px',
              color: '#495057',
              whiteSpace: 'pre-line'
            }}>
              <strong>Zusätzlich:</strong> {step.additionalDetails}
            </div>
          )}
        </div>
      ))}
      
      {isExpanded && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          background: '#d1ecf1', 
          borderRadius: '4px',
          fontSize: '13px',
          color: '#0c5460'
        }}>
          <strong>Hinweis:</strong> Die Schritte 11-13 (Wartezeiten, Workflow-Sortierung, Mehrpersonal) 
          werden im Arbeitsplan berücksichtigt.
        </div>
      )}
    </div>
  );
}

