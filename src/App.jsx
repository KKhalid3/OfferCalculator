import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchObjects } from './store/slices/objectsSlice';
import { fetchServices } from './store/slices/servicesSlice';
import { fetchFactors, fetchSpecialServices } from './store/slices/settingsSlice';
import { fetchCompanySettings } from './store/slices/companySettingsSlice';
import { performCalculation } from './services/calculationService';
import ObjectSelector from './components/ObjectSelector/ObjectSelector';
import ServiceSelector from './components/ServiceSelector/ServiceSelector';
import SpecialNotesSelector from './components/SpecialNotesSelector/SpecialNotesSelector';
import CustomerApproval from './components/CustomerApproval/CustomerApproval';
import ResultsDisplay from './components/ResultsDisplay/ResultsDisplay';
import CompanyOnboarding from './components/Onboarding/CompanyOnboarding';
import SubServicesOnboarding from './components/Onboarding/SubServicesOnboarding';
import ServiceConfigOnboarding from './components/Onboarding/ServiceConfigOnboarding';
import SpecialNotesOnboarding from './components/Onboarding/SpecialNotesOnboarding';
import './index.css';

// Onboarding-Schritte
const ONBOARDING_STEPS = {
  COMPANY: 'company',
  SUB_SERVICES: 'sub_services',  // NEU: Unterleistungen zuerst konfigurieren
  SERVICES: 'services',
  SPECIAL_NOTES: 'special_notes',
  COMPLETE: 'complete'
};

// Navigation-Leiste Komponente (immer sichtbar)
function NavigationBar({ currentStep, onNavigate, services, companySettings, onResetDB }) {
  const buttonStyle = (isActive) => ({
    background: isActive ? '#1976D2' : '#2196F3',
    border: isActive ? '3px solid #0d47a1' : 'none',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    fontSize: '14px',
    fontWeight: isActive ? 'bold' : 'normal',
  });
  
  const buttonStyleSubServices = (isActive) => ({
    ...buttonStyle(isActive),
    background: isActive ? '#7B1FA2' : '#9C27B0',
    border: isActive ? '3px solid #4A148C' : 'none',
  });
  
  const buttonStyleServices = (isActive) => ({
    ...buttonStyle(isActive),
    background: isActive ? '#388E3C' : '#4CAF50',
    border: isActive ? '3px solid #1B5E20' : 'none',
  });
  
  const buttonStyleSpecial = (isActive) => ({
    ...buttonStyle(isActive),
    background: isActive ? '#F57C00' : '#ff9800',
    border: isActive ? '3px solid #E65100' : 'none',
  });

  return (
    <div style={{ 
      marginBottom: '20px', 
      display: 'flex', 
      gap: '10px', 
      flexWrap: 'wrap', 
      alignItems: 'center',
      padding: '10px',
      background: '#f5f5f5',
      borderRadius: '8px',
    }}>
      <button 
        onClick={() => onNavigate(ONBOARDING_STEPS.COMPANY)} 
        style={buttonStyle(currentStep === ONBOARDING_STEPS.COMPANY)}
      >
        🏢 Unternehmen
      </button>
      <button 
        onClick={() => onNavigate(ONBOARDING_STEPS.SUB_SERVICES)} 
        style={buttonStyleSubServices(currentStep === ONBOARDING_STEPS.SUB_SERVICES)}
      >
        📎 Unterleistungen
      </button>
      <button 
        onClick={() => onNavigate(ONBOARDING_STEPS.SERVICES)} 
        style={buttonStyleServices(currentStep === ONBOARDING_STEPS.SERVICES)}
      >
        🎨 Leistungen
      </button>
      <button 
        onClick={() => onNavigate(ONBOARDING_STEPS.SPECIAL_NOTES)} 
        style={buttonStyleSpecial(currentStep === ONBOARDING_STEPS.SPECIAL_NOTES)}
      >
        🔧 Sonderangaben
      </button>
      <button 
        onClick={() => onNavigate(ONBOARDING_STEPS.COMPLETE)} 
        style={{ 
          background: currentStep === ONBOARDING_STEPS.COMPLETE ? '#666' : '#999', 
          cursor: 'pointer',
          padding: '8px 16px',
          borderRadius: '20px',
          color: 'white',
          fontSize: '14px',
          border: currentStep === ONBOARDING_STEPS.COMPLETE ? '3px solid #333' : 'none',
        }}
      >
        📊 Kalkulator
      </button>
      
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#666' }}>
        Services: {services?.length || 0} | Stundenlohn: {companySettings?.laborRate || 65} €/h
      </span>
      
      <button 
        onClick={onResetDB} 
        style={{ 
          background: '#dc3545', 
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '20px',
          color: 'white',
          fontSize: '12px',
          border: 'none',
        }}
        title="Datenbank zurücksetzen"
      >
        🔄 DB Reset
      </button>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const objects = useSelector(state => state.objects.objects);
  const services = useSelector(state => state.services.services);
  const customerApproval = useSelector(state => state.settings.customerApproval);
  const calculationsLoading = useSelector(state => state.calculations.loading);
  const companySettings = useSelector(state => state.companySettings.settings);
  
  const specialServices = useSelector(state => state.settings.specialServices);
  
  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(null); // null = prüfen, 'company', 'services', 'special_notes', 'complete'
  const [manualNavigation, setManualNavigation] = useState(false); // Flag für manuelle Navigation
  
  // Wrapper für Navigation mit Flag
  const handleNavigate = (step) => {
    setManualNavigation(true);
    setOnboardingStep(step);
  };

  // Daten beim Start laden
  useEffect(() => {
    dispatch(fetchObjects());
    dispatch(fetchServices());
    dispatch(fetchFactors());
    dispatch(fetchSpecialServices());
    dispatch(fetchCompanySettings());
  }, [dispatch]);

  // Prüfen ob Onboarding nötig ist - NUR beim ersten Laden oder wenn nicht manuell navigiert
  useEffect(() => {
    // Wenn manuell navigiert wurde, nicht überschreiben
    if (manualNavigation) {
      return;
    }
    
    // Nur prüfen, wenn noch kein Step gesetzt ist (initialer Zustand)
    if (onboardingStep !== null) {
      return;
    }
    
    if (companySettings === null || services.length === 0) {
      // Settings oder Services noch nicht geladen
      return;
    }
    
    // Prüfe Company Settings
    if (!companySettings || !companySettings.onboardingCompleted) {
      setOnboardingStep(ONBOARDING_STEPS.COMPANY);
      return;
    }
    
    // Prüfe REINE Unterleistungen (22 Stück erwartet)
    // Gemischte Services (Malervlies, Raufaser, Tapeten entfernen) werden im Hauptleistungen-Onboarding behandelt
    const reineUnterleistungen = services.filter(s => {
      const isUnterleistung = s.serviceType?.includes('Unterleistung Backend');
      const isShopLeistung = s.serviceType?.includes('Shop Leistung');
      return isUnterleistung && !isShopLeistung; // NUR reine Unterleistungen
    });
    const unconfiguredSubServices = reineUnterleistungen.filter(s => !s.subServiceConfigOnboardingCompleted);
    
    console.log(`📎 Reine Unterleistungen: ${reineUnterleistungen.length}, unkonfiguriert: ${unconfiguredSubServices.length}`);
    
    if (unconfiguredSubServices.length > 0) {
      setOnboardingStep(ONBOARDING_STEPS.SUB_SERVICES);
      return;
    }
    
    // Prüfe Hauptleistungen (11 Stück erwartet, inkl. 3 gemischte)
    const hauptLeistungen = services.filter(s => 
      s.serviceType?.includes('Shop Leistung') && 
      !s.serviceType?.includes('Shop Titel Leistung')
    );
    const unconfiguredMainServices = hauptLeistungen.filter(s => !s.configOnboardingCompleted);
    
    console.log(`🎨 Hauptleistungen: ${hauptLeistungen.length}, unkonfiguriert: ${unconfiguredMainServices.length}`);
    
    if (unconfiguredMainServices.length > 0) {
      setOnboardingStep(ONBOARDING_STEPS.SERVICES);
      return;
    }
    
    // Prüfe Sonderangaben (4 Stück erwartet)
    const unconfiguredSpecialNotes = specialServices.filter(s => !s.onboardingCompleted);
    
    console.log(`🔧 Sonderangaben: ${specialServices.length}, unkonfiguriert: ${unconfiguredSpecialNotes.length}`);
    
    if (unconfiguredSpecialNotes.length > 0) {
      setOnboardingStep(ONBOARDING_STEPS.SPECIAL_NOTES);
      return;
    }
    
    // Alles konfiguriert
    console.log('✅ Onboarding komplett - alle Services konfiguriert');
    setOnboardingStep(ONBOARDING_STEPS.COMPLETE);
  }, [companySettings, services, specialServices, onboardingStep, manualNavigation]);

  // Debounced Berechnung - verhindert zu häufige Updates
  const calculationTimeoutRef = useRef(null);
  const isCalculatingRef = useRef(false);
  
  const runCalculation = useCallback(async () => {
    if (isCalculatingRef.current) {
      console.log('Berechnung läuft bereits, überspringe');
      return;
    }
    
    try {
      isCalculatingRef.current = true;
      await performCalculation();
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      isCalculatingRef.current = false;
    }
  }, []);
  
  // Berechnung ausführen wenn sich Objekte oder Freigabe ändern (mit Debounce)
  useEffect(() => {
    if (objects.length > 0 && services.length > 0) {
      // Clear vorherigen Timeout
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
      
      // Debounce: Warte 500ms bevor Berechnung gestartet wird
      calculationTimeoutRef.current = setTimeout(() => {
        runCalculation();
      }, 500);
    }
    
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
  }, [objects, customerApproval, services.length, runCalculation]);

  // Debug: Datenbank zurücksetzen
  const handleResetDB = async () => {
    try {
      // IndexedDB löschen
      const databases = await window.indexedDB.databases();
      for (const db of databases) {
        if (db.name && db.name.includes('offercalculator')) {
          window.indexedDB.deleteDatabase(db.name);
          console.log('Gelöscht:', db.name);
        }
      }
      alert('Datenbank gelöscht. Seite wird neu geladen...');
      window.location.reload();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  // Handler für Onboarding-Abschluss
  const handleCompanyOnboardingComplete = () => {
    // Weiter zu Unterleistungen-Konfiguration (NEU: vor Hauptleistungen)
    setOnboardingStep(ONBOARDING_STEPS.SUB_SERVICES);
    dispatch(fetchServices()); // Neu laden
  };

  const handleSubServicesOnboardingComplete = () => {
    // Weiter zu Hauptleistungs-Konfiguration
    setOnboardingStep(ONBOARDING_STEPS.SERVICES);
    dispatch(fetchServices()); // Neu laden
  };

  const handleServicesOnboardingComplete = () => {
    // Weiter zu Sonderangaben
    setOnboardingStep(ONBOARDING_STEPS.SPECIAL_NOTES);
    dispatch(fetchSpecialServices()); // Neu laden
  };

  const handleSpecialNotesOnboardingComplete = () => {
    // Onboarding abgeschlossen
    setOnboardingStep(ONBOARDING_STEPS.COMPLETE);
    dispatch(fetchServices());
    dispatch(fetchSpecialServices());
    runCalculation();
  };

  // Zeige Company Onboarding
  if (onboardingStep === ONBOARDING_STEPS.COMPANY) {
    return (
      <div className="app">
        <h1>🎨 Malerleistungen Kalkulator</h1>
        <NavigationBar 
          currentStep={onboardingStep} 
          onNavigate={handleNavigate} 
          services={services}
          companySettings={companySettings}
          onResetDB={handleResetDB}
        />
        <CompanyOnboarding onComplete={handleCompanyOnboardingComplete} />
      </div>
    );
  }

  // NEU: Zeige Unterleistungen Onboarding
  if (onboardingStep === ONBOARDING_STEPS.SUB_SERVICES) {
    return (
      <div className="app">
        <h1>🎨 Malerleistungen Kalkulator</h1>
        <NavigationBar 
          currentStep={onboardingStep} 
          onNavigate={handleNavigate} 
          services={services}
          companySettings={companySettings}
          onResetDB={handleResetDB}
        />
        <SubServicesOnboarding onComplete={handleSubServicesOnboardingComplete} />
      </div>
    );
  }

  // Zeige Service Config Onboarding (Hauptleistungen)
  if (onboardingStep === ONBOARDING_STEPS.SERVICES) {
    return (
      <div className="app">
        <h1>🎨 Malerleistungen Kalkulator</h1>
        <NavigationBar 
          currentStep={onboardingStep} 
          onNavigate={handleNavigate} 
          services={services}
          companySettings={companySettings}
          onResetDB={handleResetDB}
        />
        <ServiceConfigOnboarding onComplete={handleServicesOnboardingComplete} />
      </div>
    );
  }

  // Zeige Special Notes Onboarding
  if (onboardingStep === ONBOARDING_STEPS.SPECIAL_NOTES) {
    return (
      <div className="app">
        <h1>🎨 Malerleistungen Kalkulator</h1>
        <NavigationBar 
          currentStep={onboardingStep} 
          onNavigate={handleNavigate} 
          services={services}
          companySettings={companySettings}
          onResetDB={handleResetDB}
        />
        <SpecialNotesOnboarding onComplete={handleSpecialNotesOnboardingComplete} />
      </div>
    );
  }

  // Warte auf Initialisierung
  if (onboardingStep === null) {
    return (
      <div className="app">
        <h1>🎨 Malerleistungen Kalkulator</h1>
        <div className="loading">Initialisiere...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>🎨 Malerleistungen Kalkulator</h1>
      
      {/* Navigation-Leiste */}
      <NavigationBar 
        currentStep={onboardingStep} 
        onNavigate={handleNavigate} 
        services={services}
        companySettings={companySettings}
        onResetDB={handleResetDB}
      />
      
      <ObjectSelector />
      
      {objects.length > 0 && (
        <>
          <ServiceSelector />
          <SpecialNotesSelector />
          <CustomerApproval />
        </>
      )}

      {calculationsLoading && (
        <div className="loading">Berechne...</div>
      )}

      {objects.length > 0 && <ResultsDisplay />}
    </div>
  );
}

export default App;

