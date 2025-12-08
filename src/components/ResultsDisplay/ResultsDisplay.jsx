import React from 'react';
import { useSelector } from 'react-redux';
import CalculationStepsExplanation from '../CalculationStepsExplanation/CalculationStepsExplanation';
import DayPlanningDialog from '../DayPlanningDialog/DayPlanningDialog';

// Formatiert einen Betrag als Euro
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
};

// Formatiert Zeit in Stunden und Minuten
const formatTime = (minutes) => {
  if (!minutes) return '0:00 h';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, '0')} h`;
};

export default function ResultsDisplay() {
  const results = useSelector(state => state.calculations.results);
  const workflows = useSelector(state => state.workflow.workflows);
  const customerApproval = useSelector(state => state.settings.customerApproval);
  const objects = useSelector(state => state.objects.objects);
  const companySettings = useSelector(state => state.companySettings.settings);
  const services = useSelector(state => state.services.services);

  if (!results || !results.objects || results.objects.length === 0) {
    return (
      <div className="card">
        <p>Keine Berechnungsergebnisse verfügbar. Bitte fügen Sie Objekte und Leistungen hinzu.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Kalkulationsergebnisse</h2>
        
        {results.objects.map(obj => {
          const fullObject = objects.find(o => o.id === obj.id);
          return (
            <div key={obj.id} style={{ marginBottom: '30px', padding: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
              <h3>{obj.name} ({obj.type})</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <h4>Mengen:</h4>
                <ul>
                  <li>Deckenfläche: {obj.quantities?.ceilingArea?.toFixed(2) || 0} m²</li>
                  <li>Umfang: {obj.quantities?.perimeter?.toFixed(2) || 0} m</li>
                  <li>Wandfläche: {obj.quantities?.wallArea?.toFixed(2) || 0} m²</li>
                  {obj.quantities?.quantityFactor !== 1 && (
                    <li>Mengenfaktor: {obj.quantities.quantityFactor}</li>
                  )}
                  {obj.quantities?.serviceFactor !== 1 && (
                    <li>Leistungsfaktor: {obj.quantities.serviceFactor}</li>
                  )}
                </ul>
              </div>

              {/* Sonderangaben anzeigen */}
              {obj.specialNotes && obj.specialNotes.length > 0 && (
                <div style={{ marginBottom: '15px', padding: '12px', background: '#fff3e0', borderRadius: '6px', border: '1px solid #ff9800' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#e65100' }}>
                    🔧 Sonderangaben:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {obj.specialNotes.map((note) => {
                      const requiredServiceTitle = note.requiredService 
                        ? services.find(s => s.id === note.requiredService)?.title 
                        : null;
                      
                      return (
                        <div 
                          key={note.id}
                          style={{
                            padding: '10px',
                            background: 'white',
                            borderRadius: '4px',
                            border: '1px solid #ffcc80'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#e65100' }}>
                            ✓ {note.title}
                          </div>
                          {note.uxDescription && (
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontStyle: 'italic' }}>
                              {note.uxDescription}
                            </div>
                          )}
                          {note.factor && note.factor !== 1 && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#1565c0', 
                              background: '#e3f2fd', 
                              padding: '4px 8px', 
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px'
                            }}>
                              ⏱️ Zeitfaktor: ×{note.factor}
                            </div>
                          )}
                          {note.factor === 1 && !note.requiredService && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#666', 
                              background: '#f5f5f5', 
                              padding: '4px 8px', 
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px'
                            }}>
                              ℹ️ Wird separat abgerechnet
                            </div>
                          )}
                          {requiredServiceTitle && (
                            <div style={{ 
                              fontSize: '12px', 
                              color: '#2e7d32', 
                              background: '#e8f5e9', 
                              padding: '4px 8px', 
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '4px',
                              marginLeft: '8px'
                            }}>
                              ➕ Aktiviert: {requiredServiceTitle}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {obj.services && obj.services.length > 0 && (
                <div>
                  <h4>Leistungen:</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ background: '#e0e0e0', textAlign: 'left' }}>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Leistung</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Menge</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Zeit</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Lohnkosten</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Material</th>
                        <th style={{ padding: '8px', border: '1px solid #ccc' }}>Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obj.services.map((svc, idx) => (
                        <tr key={idx} style={{ 
                          background: svc.isFromSpecialNote 
                            ? '#fff3e0' 
                            : svc.isSubService 
                              ? '#f0f7ff'
                              : (idx % 2 === 0 ? 'white' : '#f5f5f5') 
                        }}>
                          <td style={{ 
                            padding: '8px', 
                            border: '1px solid #ccc',
                            paddingLeft: svc.isSubService ? '30px' : '8px'
                          }}>
                            {/* Hauptleistung oder Unterleistung */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {svc.isSubService && (
                                <span style={{ 
                                  color: '#1976d2',
                                  fontSize: '14px'
                                }}>
                                  ↳
                                </span>
                              )}
                              <strong style={{ 
                                color: svc.isSubService ? '#1565c0' : 'inherit'
                              }}>
                                {svc.serviceName}
                              </strong>
                            </div>
                            
                            {/* Tags */}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {svc.isSubService && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  background: '#1976d2', 
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  📎 Unterleistung von: {svc.parentServiceName}
                                </span>
                              )}
                              {svc.isFromSpecialNote && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  background: '#ff9800', 
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  ➕ Aus Sonderangabe
                                </span>
                              )}
                            </div>
                            
                            {/* Effizienz-Info */}
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              Effizienz: {svc.efficiency ? (svc.efficiency * 100).toFixed(0) : 100}%
                              {svc.specialNoteFactor && (
                                <span style={{ marginLeft: '8px', color: '#e65100' }}>
                                  | Sonderfaktor: ×{svc.specialNoteFactor}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                            {svc.quantity?.toFixed(2) || 0} {svc.unit || 'm²'}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                            {formatTime(svc.finalTime)}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                            {formatCurrency(svc.laborCost)}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                            {formatCurrency(svc.materialCost)}
                          </td>
                          <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}>
                            {formatCurrency(svc.totalCost)}
                          </td>
                        </tr>
                      ))}
                      {/* Zwischensumme */}
                      <tr style={{ background: '#d4edda', fontWeight: 'bold' }}>
                        <td colSpan="2" style={{ padding: '8px', border: '1px solid #ccc' }}>
                          Zwischensumme {obj.name}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                          {formatTime(obj.totalTime)}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                          {formatCurrency(obj.totalLaborCost)}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                          {formatCurrency(obj.totalMaterialCost)}
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                          {formatCurrency(obj.totalCost)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Entfernt - wird jetzt in der Tabelle angezeigt */}

              {/* Schritt-für-Schritt Erklärung */}
              <CalculationStepsExplanation
                object={fullObject || obj}
                services={obj.services}
                quantities={obj.quantities}
                customerApproval={customerApproval}
                specialNotesData={obj.specialNotes}
              />
            </div>
          );
        })}

        {/* Tagesplanung Dialog - ÜBER der Preisübersicht */}
        <DayPlanningDialog
          results={results}
          customerApproval={customerApproval}
          companySettings={companySettings}
        />

        {/* Transparente Preisübersicht */}
        <div style={{ marginTop: '30px', padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <h3 style={{ marginBottom: '20px' }}>💰 Transparente Preisübersicht</h3>
          
          {/* Stundenlohn-Info */}
          <div style={{ 
            background: '#bbdefb', 
            padding: '12px 15px', 
            borderRadius: '6px', 
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <span style={{ fontSize: '24px' }}>💶</span>
            <div>
              <strong>Stundenlohn: {formatCurrency(companySettings?.laborRate || 65)}/h</strong>
              <div style={{ fontSize: '12px', color: '#1565c0' }}>
                (all-inclusive: Lohn, Nebenkosten, Gemeinkosten, Gewinn)
              </div>
            </div>
          </div>

          {/* Leistungskosten pro Objekt */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ 
              background: '#1976d2', 
              color: 'white', 
              padding: '10px 15px', 
              borderRadius: '6px 6px 0 0',
              margin: 0
            }}>
              📋 Leistungskosten
            </h4>
            
            {results.objects.map(obj => (
              <div key={obj.id} style={{ 
                background: 'white', 
                border: '1px solid #1976d2',
                borderTop: 'none',
                padding: '15px',
                marginBottom: '0'
              }}>
                <h5 style={{ 
                  margin: '0 0 15px 0', 
                  color: '#1976d2',
                  borderBottom: '1px dashed #ccc',
                  paddingBottom: '8px'
                }}>
                  🏠 {obj.name} ({obj.type})
                </h5>
                
                {/* Sonderangaben-Zusammenfassung für dieses Objekt */}
                {obj.specialNotes && obj.specialNotes.length > 0 && (
                  <div style={{ 
                    background: '#fff3e0', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    marginBottom: '15px',
                    border: '1px solid #ffcc80'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#e65100', fontSize: '13px' }}>
                      🔧 Aktive Sonderangaben für dieses Objekt:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {obj.specialNotes.map((note, noteIdx) => {
                        const hasFactor = note.factor && note.factor !== 1;
                        const hasRequiredService = note.requiredService;
                        const isSeparatelyCharged = !hasFactor && !hasRequiredService;
                        
                        return (
                          <div 
                            key={noteIdx}
                            style={{
                              fontSize: '12px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: hasFactor ? '#ff9800' : isSeparatelyCharged ? '#9e9e9e' : '#4caf50',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {hasFactor && <span>⏱️</span>}
                            {hasRequiredService && <span>➕</span>}
                            {isSeparatelyCharged && <span>ℹ️</span>}
                            <span>{note.title}</span>
                            {hasFactor && <span style={{ fontWeight: 'bold' }}>(×{note.factor})</span>}
                            {isSeparatelyCharged && <span style={{ fontSize: '10px' }}>(separat)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {obj.services && obj.services.map((svc, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: '12px', 
                    paddingBottom: '12px',
                    borderBottom: idx < obj.services.length - 1 ? '1px dotted #e0e0e0' : 'none',
                    marginLeft: svc.isSubService ? '20px' : '0',
                    borderLeft: svc.isSubService ? '3px solid #1976d2' : 'none',
                    paddingLeft: svc.isSubService ? '12px' : '0',
                    background: svc.isSubService ? '#f8fbff' : 'transparent'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      {svc.isSubService && (
                        <span style={{ color: '#1976d2' }}>↳</span>
                      )}
                      <span style={{ color: svc.isSubService ? '#1565c0' : 'inherit' }}>
                        {svc.serviceName}
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        fontWeight: 'normal'
                      }}>
                        ({svc.quantity?.toFixed(1)} {svc.unit || 'm²'})
                      </span>
                      {svc.isSubService && (
                        <span style={{ 
                          fontSize: '10px', 
                          background: '#1976d2', 
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          📎 Unterleistung
                        </span>
                      )}
                      {svc.isFromSpecialNote && (
                        <span style={{ 
                          fontSize: '10px', 
                          background: '#ff9800', 
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          Aus Sonderangabe
                        </span>
                      )}
                    </div>
                    
                    {/* Hinweis zur Hauptleistung bei Unterleistungen */}
                    {svc.isSubService && svc.parentServiceName && (
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#1976d2', 
                        marginBottom: '6px',
                        fontStyle: 'italic'
                      }}>
                        Automatisch enthalten in: {svc.parentServiceName}
                      </div>
                    )}
                    
                    {/* === TRANSPARENTE BERECHNUNGSDETAILS === */}
                    <div style={{ 
                      background: '#f5f5f5', 
                      padding: '10px', 
                      borderRadius: '6px', 
                      marginBottom: '10px',
                      marginLeft: '15px',
                      fontSize: '12px'
                    }}>
                      {/* Zeitberechnung aus Onboarding */}
                      <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #ddd' }}>
                        <div style={{ fontWeight: 'bold', color: '#1565c0', marginBottom: '4px' }}>
                          ⏱️ Zeitberechnung:
                        </div>
                        {svc.standardValuePerUnit ? (
                          <div style={{ color: '#555' }}>
                            {svc.standardValuePerUnit} min/{svc.unit} × {svc.quantity?.toFixed(2)} {svc.unit} = {svc.calculatedBaseTime?.toFixed(2) || (svc.standardValuePerUnit * svc.quantity)?.toFixed(2)} min
                          </div>
                        ) : (
                          <div style={{ color: '#999', fontStyle: 'italic' }}>
                            Keine Zeit pro Einheit konfiguriert
                          </div>
                        )}
                        
                        {/* Mindestzeit */}
                        {svc.minTimeApplied && (
                          <div style={{ 
                            color: '#e65100', 
                            marginTop: '4px',
                            background: '#fff3e0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            ⚠️ Mindestzeit angewendet: {svc.minTime} min (statt {svc.calculatedBaseTime?.toFixed(2)} min)
                          </div>
                        )}
                        
                        {/* Sonderfaktor */}
                        {svc.specialNoteFactor && svc.specialNoteFactor !== 1 && (
                          <div style={{ 
                            color: '#e65100', 
                            marginTop: '4px',
                            background: '#fff3e0',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            🔧 Sonderangaben-Faktor: ×{svc.specialNoteFactor} (+{((svc.specialNoteFactor - 1) * 100).toFixed(0)}%)
                          </div>
                        )}
                        
                        {/* Effizienz */}
                        {svc.efficiency && svc.efficiency !== 1 && (
                          <div style={{ 
                            color: '#2e7d32', 
                            marginTop: '4px',
                            background: '#e8f5e9',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            📈 Effizienz: {(svc.efficiency * 100).toFixed(0)}% 
                            {svc.efficiencyStart && ` (ab ${svc.efficiencyStart} ${svc.unit})`}
                          </div>
                        )}
                        
                        {/* Leistungsfaktor */}
                        {svc.serviceFactor && svc.serviceFactor !== 1 && (
                          <div style={{ 
                            color: '#7b1fa2', 
                            marginTop: '4px',
                            background: '#f3e5f5',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            🏠 Objekttyp-Faktor: ×{svc.serviceFactor}
                          </div>
                        )}
                      </div>
                      
                      {/* Finale Arbeitszeit */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <span style={{ color: '#333' }}>
                          <strong>Finale Arbeitszeit:</strong>
                        </span>
                        <span style={{ fontWeight: 'bold', color: '#1565c0' }}>
                          {formatTime(svc.finalTime)}
                        </span>
                      </div>
                      
                      {/* Lohnkosten */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <span style={{ color: '#555' }}>
                          💼 Lohnkosten: {formatTime(svc.finalTime)} × {formatCurrency(companySettings?.laborRate || 65)}/h
                        </span>
                        <span style={{ fontWeight: '500' }}>
                          = {formatCurrency(svc.laborCost)}
                        </span>
                      </div>
                      
                      {/* Material-Details */}
                      {svc.materialType && svc.materialType !== 'none' && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px'
                        }}>
                          <span style={{ color: '#555' }}>
                            📦 Material: {svc.materialType === 'percent' 
                              ? `${svc.materialValue}% von ${formatCurrency(svc.laborCost)}`
                              : `${formatCurrency(svc.materialValue)}/${svc.unit} × ${svc.quantity?.toFixed(2)}`
                            }
                          </span>
                          <span style={{ fontWeight: '500' }}>
                            = {formatCurrency(svc.materialCost)}
                          </span>
                        </div>
                      )}
                      {(!svc.materialType || svc.materialType === 'none') && (
                        <div style={{ color: '#999', fontSize: '11px', fontStyle: 'italic' }}>
                          📦 Kein Material konfiguriert
                        </div>
                      )}
                    </div>
                    
                    {/* Gesamt für diese Leistung */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginLeft: '15px',
                      marginTop: '6px',
                      paddingTop: '4px',
                      borderTop: '1px solid #eee',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      <span>Summe {svc.serviceName}:</span>
                      <span>{formatCurrency(svc.totalCost)}</span>
                    </div>
                  </div>
                ))}
                
                {/* Zwischensumme Objekt */}
                <div style={{ 
                  background: '#e8f5e9', 
                  padding: '10px 15px', 
                  borderRadius: '4px',
                  marginTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold'
                }}>
                  <span>Zwischensumme {obj.name}:</span>
                  <span>{formatCurrency(obj.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Baustellenpauschale */}
          {(results.siteSetupCost > 0 || results.siteClearanceCost > 0) && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                background: '#7b1fa2', 
                color: 'white', 
                padding: '10px 15px', 
                borderRadius: '6px 6px 0 0',
                margin: 0
              }}>
                🏗️ Baustellenpauschale (einmalig)
              </h4>
              <div style={{ 
                background: 'white', 
                border: '1px solid #7b1fa2',
                borderTop: 'none',
                padding: '15px'
              }}>
                {results.siteSetupCost > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}>
                    <span>
                      🚚 Einrichtung: {formatTime(companySettings?.siteSetup || 60)} × {formatCurrency(companySettings?.laborRate || 65)}/h
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      = {formatCurrency(results.siteSetupCost)}
                    </span>
                  </div>
                )}
                {results.siteClearanceCost > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}>
                    <span>
                      🧹 Räumung: {formatTime(companySettings?.siteClearance || 60)} × {formatCurrency(companySettings?.laborRate || 65)}/h
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      = {formatCurrency(results.siteClearanceCost)}
                    </span>
                  </div>
                )}
                <div style={{ 
                  background: '#f3e5f5', 
                  padding: '10px 15px', 
                  borderRadius: '4px',
                  marginTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold'
                }}>
                  <span>Zwischensumme Baustellenpauschale:</span>
                  <span>{formatCurrency((results.siteSetupCost || 0) + (results.siteClearanceCost || 0))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Gesamtübersicht */}
          <div style={{ 
            background: '#1565c0', 
            color: 'white', 
            padding: '20px', 
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>
              📊 Zusammenfassung
            </h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr auto',
              gap: '8px',
              fontSize: '14px'
            }}>
              <span>⏱️ Arbeitszeit gesamt:</span>
              <span style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {formatTime(results.totalTime)}
              </span>
              
              <span>💼 Lohnkosten (Zeit × {formatCurrency(companySettings?.laborRate || 65)}/h):</span>
              <span style={{ textAlign: 'right' }}>
                {formatCurrency(results.totalLaborCost)}
              </span>
              
              <span>📦 Materialkosten:</span>
              <span style={{ textAlign: 'right' }}>
                + {formatCurrency(results.totalMaterialCost)}
              </span>
              
              <div style={{ 
                gridColumn: '1 / -1', 
                borderTop: '2px solid rgba(255,255,255,0.3)',
                margin: '10px 0',
                paddingTop: '10px'
              }}></div>
              
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                💰 GESAMTPREIS (netto):
              </span>
              <span style={{ 
                textAlign: 'right', 
                fontSize: '24px', 
                fontWeight: 'bold'
              }}>
                {formatCurrency(results.totalCost)}
              </span>
            </div>
          </div>
          
          {/* Zusatzinfos */}
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: 'white', 
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>📅</div>
              <div style={{ fontWeight: 'bold' }}>{results.totalDays || 1}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Arbeitstage</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>👷</div>
              <div style={{ fontWeight: 'bold' }}>{results.optimalEmployees || 1}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Mitarbeiter</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px' }}>⏱️</div>
              <div style={{ fontWeight: 'bold' }}>{formatTime(results.totalTime)}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Gesamtzeit</div>
            </div>
          </div>
        </div>
      </div>

      {workflows && workflows.length > 0 && (
        <div className="card">
          <h2>Arbeitsplan</h2>
          
          {/* Schritt 11-13 Erklärung */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            background: '#fff3cd', 
            borderRadius: '4px',
            border: '1px solid #ffc107'
          }}>
            <h3 style={{ color: '#856404', marginBottom: '10px' }}>
              📋 Schritte 11-13: Workflow-Planung
            </h3>
            
            <div style={{ marginBottom: '15px', padding: '10px', background: 'white', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '30px', 
                  height: '30px', 
                  background: '#007bff', 
                  color: 'white', 
                  borderRadius: '50%', 
                  textAlign: 'center', 
                  lineHeight: '30px',
                  fontWeight: 'bold',
                  marginRight: '10px'
                }}>11</span>
                <strong>Warte- und Trocknungszeiten</strong>
              </div>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#666', marginLeft: '40px' }}>
                Für Leistungen mit Trocknungszeiten wurden Wartezeiten berücksichtigt. 
                Inkompatible Arbeiten wurden auf verschiedene Tage verteilt.
              </p>
            </div>

            <div style={{ marginBottom: '15px', padding: '10px', background: 'white', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '30px', 
                  height: '30px', 
                  background: '#007bff', 
                  color: 'white', 
                  borderRadius: '50%', 
                  textAlign: 'center', 
                  lineHeight: '30px',
                  fontWeight: 'bold',
                  marginRight: '10px'
                }}>12</span>
                <strong>Workflow-Sortierung</strong>
              </div>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#666', marginLeft: '40px' }}>
                Die Leistungen wurden nach der definierten Arbeitsreihenfolge sortiert, 
                um einen logischen Arbeitsablauf zu gewährleisten.
              </p>
            </div>

            <div style={{ padding: '10px', background: 'white', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '30px', 
                  height: '30px', 
                  background: '#007bff', 
                  color: 'white', 
                  borderRadius: '50%', 
                  textAlign: 'center', 
                  lineHeight: '30px',
                  fontWeight: 'bold',
                  marginRight: '10px'
                }}>13</span>
                <strong>Mehrpersonal-Optimierung</strong>
              </div>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#666', marginLeft: '40px' }}>
                Die optimale Mitarbeiteranzahl wurde berechnet, um Effizienzverluste zu vermeiden 
                und die Gesamtarbeitszeit zu optimieren.
              </p>
              <div style={{ marginTop: '8px', padding: '8px', background: '#f8f9fa', borderRadius: '4px', marginLeft: '40px', fontSize: '13px' }}>
                <strong>Ergebnis:</strong> {results.optimalEmployees || 1} Mitarbeiter für {results.totalDays || 0} Arbeitstage
              </div>
            </div>
          </div>

          {workflows.map(day => (
            <div key={day.id} style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              background: '#f9f9f9', 
              borderRadius: '4px' 
            }}>
              <h3>Tag {day.day}</h3>
              <p>Mitarbeiter: {day.employees}</p>
              <p>Arbeitsstunden: {day.hours?.toFixed(2) || 0} h</p>
              {day.waitTimes && day.waitTimes.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong>Wartezeiten:</strong>
                  <ul>
                    {day.waitTimes.map((wt, idx) => (
                      <li key={idx}>
                        Dauer: {wt.duration} min 
                        {wt.serviceId && ` (Service: ${wt.serviceId})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

