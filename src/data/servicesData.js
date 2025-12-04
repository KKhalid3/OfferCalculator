// Vollständige Leistungsdaten aus Excel-Tabelle
export const servicesData = [
    // Global einmalig
    {
        id: 'service_baustelleneinrichtung',
        title: 'Baustelleneinrichtung',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Anfahrt, Ausladen, Wege sichern',
        includedIn: [],
        unit: 'h',
        maxProductivityPerDay: null,
        standardQuantity: 1,
        standardTime: 45, // 45 min
        standardValuePerUnit: 45,
        formula: 'Mindestzeit, sonst Standardmodus (pro Raum/Fläche/Tag)',
        materialStandard: '1,02',
        waitTime: 0,
        minTime: 45,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Global am Tag
    {
        id: 'service_mindestzeit_tag',
        title: 'Mindestzeit am Tag',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: [],
        unit: 'h',
        maxProductivityPerDay: null,
        standardQuantity: 1,
        standardTime: 90, // 1 h 30 min
        standardValuePerUnit: 90,
        formula: 'aus dem Onboarding',
        materialStandard: '',
        waitTime: 0,
        minTime: 90,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Abdecken (Boden)
    {
        id: 'service_abdecken_boden',
        title: 'Abdecken (Boden)',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Abkleben, Folie/Fleece, Ränder fixieren',
        includedIn: ['service_overholungsanstrich', 'service_neuanstrich_frisch', 'service_neuanstrich_raufaser', 'service_neuanstrich_malervlies', 'service_mustertapete', 'service_malervlies', 'service_raufaser', 'service_tapete_entfernen'],
        unit: 'm²',
        maxProductivityPerDay: 110,
        standardQuantity: 15,
        standardTime: 45, // 45 min
        standardValuePerUnit: 3,
        formula: '3,0 min/m² (45 min ÷ 15 m²) – Praxiswert',
        materialStandard: '1,1',
        waitTime: 0,
        minTime: 90, // 1h 30 min
        efficiencyStart: 60,
        efficiencyCap: 120,
        efficiencyStepPercent: 1
    },

    // Dübellöcher schließen - wird über Sonderangabe "Dübellöcher" aktiviert
    {
        id: 'service_duebelloecher',
        title: 'Dübellöcher schließen (<10% der Fläche)',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Dübellöcher schließen, nachschleifen und vorbessern',
        includedIn: [], // NICHT automatisch inkludiert - wird über Sonderangabe aktiviert
        unit: 'm²',
        maxProductivityPerDay: 250,
        standardQuantity: 40,
        standardTime: 20, // 20 min
        standardValuePerUnit: 0.5,
        formula: '0,5 min/m² (20 min / 40 m²)',
        materialStandard: '1,1',
        waitTime: 30, // 30 min
        minTime: 90, // 1h 30 min
        efficiencyStart: 100,
        efficiencyCap: 250,
        efficiencyStepPercent: 1
    },

    // Teilspachtelung
    {
        id: 'service_teilspachtelung',
        title: 'Teilspachtelung',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'punktuell spachteln, schleifen, grundieren',
        includedIn: ['service_raufaser'],
        unit: 'm²',
        maxProductivityPerDay: 180,
        standardQuantity: 40,
        standardTime: 510, // 8 h 30 min
        standardValuePerUnit: 12.75,
        formula: '12,75 min/m² (510 min ÷ 40 m²)',
        materialStandard: '+5 %',
        waitTime: 240, // 0,5 Tage = 4h
        minTime: null,
        efficiencyStart: 40, // ab 1 Raum
        efficiencyCap: 80, // Deckel 2 Räume
        efficiencyStepPercent: 1
    },

    // Vollflächenspachtelung
    {
        id: 'service_vollflaechenspachtelung',
        title: 'Vollflächenspachtelung ≤ 1 mm',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'vollflächig spachteln, Trocknung, schleifen',
        includedIn: ['service_tuerfluegel_lackieren', 'service_fensterfluegel_innen', 'service_fensterfluegel_aussen', 'service_malervlies', 'service_mustertapete', 'service_neuanstrich_frisch'],
        unit: 'm²',
        maxProductivityPerDay: 70, // Spachtel + 175 Schleifen
        standardQuantity: 40,
        standardTime: 480, // 8,0 h
        standardValuePerUnit: 12,
        formula: 'Spachtel 4,6h + Schliff 1,8h ≈ 6,4h → 8,0h inkl. Rüstzeit',
        materialStandard: '+10 %',
        waitTime: 480, // 1 Tag
        minTime: null,
        efficiencyStart: 40,
        efficiencyCap: 70,
        efficiencyStepPercent: 1
    },

    // Zusätzlicher Grundanstrich - wird über Sonderangabe "Verschmutzung/Verfärbung" aktiviert
    {
        id: 'service_zusaetzlicher_grundanstrich',
        title: 'Zusätzlicher Grundanstrich',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: [], // NICHT automatisch inkludiert - wird über Sonderangabe aktiviert
        unit: 'm²',
        maxProductivityPerDay: 180,
        standardQuantity: 40,
        standardTime: 160, // 2 h 40 min
        standardValuePerUnit: 4,
        formula: '4,0 min/m² (160 min ÷ 40 m²)',
        materialStandard: '1,2',
        waitTime: 60, // 1–1,5 h (durchschnittlich 90 min)
        minTime: null,
        efficiencyStart: 50,
        efficiencyCap: 160,
        efficiencyStepPercent: 1
    },

    // Isoliergrundierung - wird über Sonderangabe "Nikotinverfärbung" aktiviert
    {
        id: 'service_isoliergrundierung',
        title: 'Isoliergrundierung',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: [], // NICHT automatisch inkludiert - wird über Sonderangabe aktiviert
        unit: 'm²',
        maxProductivityPerDay: 180,
        standardQuantity: 40,
        standardTime: 160, // 2 h 40 min
        standardValuePerUnit: 4,
        formula: '4,0 min/m² (160 min ÷ 40 m²)',
        materialStandard: '1,2',
        waitTime: 90, // 1–1,5 h
        minTime: null,
        efficiencyStart: 50,
        efficiencyCap: 160,
        efficiencyStepPercent: 1
    },

    // Grundierung (Standard)
    {
        id: 'service_grundierung_standard',
        title: 'Grundierung (Standard)',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'staubfrei, Grund auftragen',
        includedIn: ['service_raufaser', 'service_malervlies', 'service_mustertapete', 'service_neuanstrich_frisch', 'service_neuanstrich_raufaser', 'service_neuanstrich_malervlies'],
        unit: 'm²',
        maxProductivityPerDay: 190, // 180–200 m²/Tag (Durchschnitt)
        standardQuantity: 40,
        standardTime: 140, // 2 h 20 min
        standardValuePerUnit: 3.5,
        formula: '3,5 min/m² (140 min ÷ 40 m²)',
        materialStandard: '+5 %',
        waitTime: 0,
        minTime: null,
        efficiencyStart: 45,
        efficiencyCap: 150,
        efficiencyStepPercent: 1
    },

    // Boden wasserfest schützen
    {
        id: 'service_boden_wasserfest',
        title: 'Boden wasserfest schützen',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Folie + dicht verkleben',
        includedIn: ['service_tapete_entfernen'],
        unit: 'm²',
        maxProductivityPerDay: 77,
        standardQuantity: 15,
        standardTime: 30, // 30 min
        standardValuePerUnit: 2,
        formula: '2,0 min/m² (70 % von 3,0 min/m²)',
        materialStandard: '+2 %',
        waitTime: 0,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Tapeten entfernen
    {
        id: 'service_tapete_entfernen',
        title: 'Tapeten entfernen (Wände + Decken)',
        parentServiceId: 'service_belaege_entfernen',
        serviceType: 'Unterleistung Backend, Shop Leistung',
        variant: 'Einweichen, abziehen, entsorgen',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 60,
        standardQuantity: 40,
        standardTime: 330, // 5 h 30 min
        standardValuePerUnit: 8.25,
        formula: '8,25 min/m² (330 min ÷ 40 m²)',
        materialStandard: '0,50 €/m²',
        waitTime: 15, // 15 min
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Farbliche Grundierung
    {
        id: 'service_farbliche_grundierung',
        title: 'Farbliche Grundierung',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Grundton zur Tapete',
        includedIn: ['service_mustertapete'],
        unit: 'm²',
        maxProductivityPerDay: 180,
        standardQuantity: 40,
        standardTime: 160, // 2 h 40 min
        standardValuePerUnit: 4,
        formula: '4,0 min/m² (160 min ÷ 40 m²)',
        materialStandard: '+20 %',
        waitTime: 90, // 1–1,5 h
        minTime: null,
        efficiencyStart: 50,
        efficiencyCap: 160,
        efficiencyStepPercent: 1
    },

    // Kleisterauftrag
    {
        id: 'service_kleisterauftrag',
        title: 'Kleisterauftrag',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'wand-/bahnenweise einkleistern',
        includedIn: ['service_raufaser', 'service_malervlies', 'service_mustertapete'],
        unit: 'm²',
        maxProductivityPerDay: 220,
        standardQuantity: 40,
        standardTime: 150, // 2h 30 min
        standardValuePerUnit: 3.75,
        formula: '3,75 min/m² (½ Zeit von Tapezieren)',
        materialStandard: '+2 %',
        waitTime: 0,
        minTime: null,
        efficiencyStart: 80, // ab 2 Räume
        efficiencyCap: 240, // Deckel 6 Räume
        efficiencyStepPercent: 1
    },

    // Tapezieren (Shop Titel)
    {
        id: 'service_tapezieren',
        title: 'Tapezieren',
        parentServiceId: '',
        serviceType: 'Shop Titel Leistung',
        variant: 'zuschneiden, kleben, andrücken',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 110, // 100–120 m²/Tag (Durchschnitt)
        standardQuantity: 40,
        standardTime: 300, // 5,0 h
        standardValuePerUnit: 7.5,
        formula: '7,5 min/m² (300 min ÷ 40 m²)',
        materialStandard: '+10 %',
        waitTime: 0,
        minTime: null,
        efficiencyStart: 60,
        efficiencyCap: 120,
        efficiencyStepPercent: 1
    },

    // Raufaser (Shop Leistung)
    {
        id: 'service_raufaser',
        title: 'Raufaser',
        parentServiceId: 'service_tapezieren',
        serviceType: 'Shop Leistung, Unterleistung Backend',
        variant: '',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: null,
        standardQuantity: null,
        standardTime: null,
        standardValuePerUnit: null,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Malervlies (Shop Leistung)
    {
        id: 'service_malervlies',
        title: 'Malervlies',
        parentServiceId: 'service_tapezieren',
        serviceType: 'Shop Leistung, Unterleistung Backend',
        variant: '',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: null,
        standardQuantity: null,
        standardTime: null,
        standardValuePerUnit: null,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Mustertapete (Shop Leistung)
    {
        id: 'service_mustertapete',
        title: 'Mustertapete',
        parentServiceId: 'service_tapezieren',
        serviceType: 'Shop Leistung',
        variant: 'Muster ausrichten, kleben',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 30,
        standardQuantity: 20,
        standardTime: 330, // 5 h 30 min
        standardValuePerUnit: 16.5,
        formula: '16,5 min/m² (330 min ÷ 20 m²)',
        materialStandard: '10 % + Rollenpreis',
        waitTime: 0,
        minTime: null,
        efficiencyStart: null, // keine Eff./Deckel
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Anstrich Decken und Wände (Shop Titel)
    {
        id: 'service_anstrich',
        title: 'Anstrich Decken und Wände',
        parentServiceId: '',
        serviceType: 'Shop Titel Leistung',
        variant: '',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: null,
        standardQuantity: null,
        standardTime: null,
        standardValuePerUnit: null,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Überholungsanstrich (Shop Leistung)
    {
        id: 'service_overholungsanstrich',
        title: 'Überholungsanstrich - Streichen (Wände + Decken)',
        parentServiceId: 'service_anstrich',
        serviceType: 'Shop Leistung',
        variant: 'Bauteile (ohne Boden) abkleben, beschneiden, rollen',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 150,
        standardQuantity: 40,
        standardTime: 180, // 3,0 h
        standardValuePerUnit: 4.5,
        formula: '4,5 min/m² (180 min ÷ 40 m²)',
        materialStandard: '1,2',
        waitTime: 120, // 60–180 min (Durchschnitt)
        minTime: 90, // 1h 30 min
        efficiencyStart: 60,
        efficiencyCap: 150,
        efficiencyStepPercent: 1
    },

    // Neuanstrich auf frisch gespachtelt
    {
        id: 'service_neuanstrich_frisch',
        title: 'Streichen auf frisch gespachtelt',
        parentServiceId: 'service_anstrich',
        serviceType: 'Shop Leistung',
        variant: 'Voranstrich + Schlussanstrich getrennt',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 150,
        standardQuantity: 40,
        standardTime: 360, // Vor 3,5h + Nach 2,5h = 6h
        standardValuePerUnit: 9,
        formula: 'Vor 3,5h + Nach 2,5h mit Trocknung',
        materialStandard: '+15 %',
        waitTime: 1440, // 24 h
        minTime: null,
        efficiencyStart: 60,
        efficiencyCap: 150,
        efficiencyStepPercent: 1
    },

    // Neuanstrich auf Raufasertapete
    {
        id: 'service_neuanstrich_raufaser',
        title: 'Streichen auf Raufasertapete',
        parentServiceId: 'service_anstrich',
        serviceType: 'Shop Leistung',
        variant: 'Raufaser',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 150,
        standardQuantity: 40,
        standardTime: 345, // Raufaser 3,5h+2,25h = 5,75h
        standardValuePerUnit: 8.625,
        formula: 'Nachstruktur beeinflusst Zeit',
        materialStandard: '+15 %',
        waitTime: 120, // 60–180 min
        minTime: null,
        efficiencyStart: 60,
        efficiencyCap: 150,
        efficiencyStepPercent: 1
    },

    // Neuanstrich auf Malervliestapete
    {
        id: 'service_neuanstrich_malervlies',
        title: 'Streichen auf Malervliestapete',
        parentServiceId: 'service_anstrich',
        serviceType: 'Shop Leistung',
        variant: 'Malervlies',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 150,
        standardQuantity: 41,
        standardTime: 360, // Vlies 3,5h+2,5h = 6h
        standardValuePerUnit: 8.78,
        formula: 'Nachstruktur beeinflusst Zeit',
        materialStandard: '+15 %',
        waitTime: 120, // 60–180 min
        minTime: null,
        efficiencyStart: 60,
        efficiencyCap: 150,
        efficiencyStepPercent: 1
    },

    // Lackieren (Shop Titel)
    {
        id: 'service_lackieren',
        title: 'Lackieren',
        parentServiceId: '',
        serviceType: 'Shop Titel Leistung',
        variant: 'schleifen + grundieren, Trocknung, endlackieren',
        includedIn: [],
        unit: 'Stk',
        maxProductivityPerDay: 4.5, // 4–5 Stk/Tag (Durchschnitt)
        standardQuantity: 1,
        standardTime: 210, // 3,5 h = 1,75h + 1,75h über 2 Tage
        standardValuePerUnit: 210,
        formula: '1,75h + 1,75h über 2 Tage',
        materialStandard: '+22 %',
        waitTime: 360, // 6 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Türflügel lackieren (mit Zarge)
    {
        id: 'service_tuerfluegel_lackieren',
        title: 'Türflügel lackieren (mit Zarge)',
        parentServiceId: 'service_lackieren',
        serviceType: 'Shop Leistung',
        variant: 'schleifen + grundieren, Trocknung, endlackieren',
        includedIn: [],
        unit: 'Stk',
        maxProductivityPerDay: 4.5,
        standardQuantity: 2,
        standardTime: 210, // 3,5 h
        standardValuePerUnit: 105,
        formula: '1,75h + 1,75h über 2 Tage',
        materialStandard: '+22 %',
        waitTime: 420, // 7 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Türflügel schleifen
    {
        id: 'service_tuerfluegel_schleifen',
        title: 'Türflügel schleifen',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_tuerfluegel_lackieren'],
        unit: 'Stk',
        maxProductivityPerDay: 4.5,
        standardQuantity: 3,
        standardTime: 210,
        standardValuePerUnit: 70,
        formula: '1,75h + 1,75h über 2 Tage',
        materialStandard: '+22 %',
        waitTime: 480, // 8 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Türflügel grundieren
    {
        id: 'service_tuerfluegel_grundieren',
        title: 'Türflügel grundieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_tuerfluegel_lackieren'],
        unit: 'Stk',
        maxProductivityPerDay: 4.5,
        standardQuantity: 4,
        standardTime: 210,
        standardValuePerUnit: 52.5,
        formula: '1,75h + 1,75h über 2 Tage',
        materialStandard: '+22 %',
        waitTime: 540, // 9 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Türflügel schlusslackieren
    {
        id: 'service_tuerfluegel_schlusslackieren',
        title: 'Türflügel schlusslackieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_tuerfluegel_lackieren'],
        unit: 'Stk',
        maxProductivityPerDay: 4.5,
        standardQuantity: 5,
        standardTime: 210,
        standardValuePerUnit: 42,
        formula: '1,75h + 1,75h über 2 Tage',
        materialStandard: '+22 %',
        waitTime: 600, // 10 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Fensterflügel lackieren innen
    {
        id: 'service_fensterfluegel_innen',
        title: 'Fensterflügel lackieren – je Seite innen (mittel < 1,5 m²)',
        parentServiceId: 'service_lackieren',
        serviceType: 'Shop Leistung',
        variant: 'abkleben, schleifen, grundieren, lackieren',
        includedIn: [],
        unit: 'Stk',
        maxProductivityPerDay: 3.5, // 3–4 Stk/Tag
        standardQuantity: 2,
        standardTime: 345, // 5h 45 min
        standardValuePerUnit: 172.5,
        formula: '72 min/m² (180 min ÷ 2,5 m²)',
        materialStandard: '+22 %',
        waitTime: 360, // 6 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Fensterflügel innen schleifen
    {
        id: 'service_fensterfluegel_innen_schleifen',
        title: 'Fensterflügel innen schleifen',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_innen'],
        unit: 'Stk',
        maxProductivityPerDay: 10,
        standardQuantity: 2,
        standardTime: 90, // 1 h 30 min
        standardValuePerUnit: 45,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Fensterflügel innen grundieren
    {
        id: 'service_fensterfluegel_innen_grundieren',
        title: 'Fensterflügel innen grundieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_innen'],
        unit: 'Stk',
        maxProductivityPerDay: 3.5,
        standardQuantity: 2,
        standardTime: 120, // 2 h
        standardValuePerUnit: 60,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Fensterflügel innen schlusslackieren
    {
        id: 'service_fensterfluegel_innen_schlusslackieren',
        title: 'Fensterflügel innen schlusslackieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_innen'],
        unit: 'Stk',
        maxProductivityPerDay: 3.5,
        standardQuantity: 2,
        standardTime: 135, // 2 h 15 min
        standardValuePerUnit: 67.5,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Fensterflügel lackieren außen
    {
        id: 'service_fensterfluegel_aussen',
        title: 'Fensterflügel lackieren – je Seite außen (mittel < 1,5 m²)',
        parentServiceId: 'service_lackieren',
        serviceType: 'Shop Leistung',
        variant: 'wie innen, stärker beansprucht',
        includedIn: [],
        unit: 'Stk',
        maxProductivityPerDay: 3.5,
        standardQuantity: 2,
        standardTime: 210, // 3,5 h
        standardValuePerUnit: 105,
        formula: '84 min/m² (210 min ÷ 2,5 m²)',
        materialStandard: '+22 %',
        waitTime: 360, // 6 h
        minTime: null,
        efficiencyStart: 3,
        efficiencyCap: 10,
        efficiencyStepPercent: 1
    },

    // Fensterflügel außen schleifen
    {
        id: 'service_fensterfluegel_aussen_schleifen',
        title: 'Fensterflügel außen schleifen',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_aussen'],
        unit: 'Stk',
        maxProductivityPerDay: null,
        standardQuantity: 2,
        standardTime: 150, // 2 h 30 min
        standardValuePerUnit: 75,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Fensterflügel außen grundieren
    {
        id: 'service_fensterfluegel_aussen_grundieren',
        title: 'Fensterflügel außen grundieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_aussen'],
        unit: 'Stk',
        maxProductivityPerDay: null,
        standardQuantity: 2,
        standardTime: 135, // 2 h 15 min
        standardValuePerUnit: 67.5,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Fensterflügel außen schlusslackieren
    {
        id: 'service_fensterfluegel_aussen_schlusslackieren',
        title: 'Fensterflügel außen schlusslackieren',
        parentServiceId: 'service_lackieren',
        serviceType: 'Unterleistung Backend',
        variant: '',
        includedIn: ['service_fensterfluegel_aussen'],
        unit: 'Stk',
        maxProductivityPerDay: null,
        standardQuantity: 2,
        standardTime: 150, // 2 h 30 min
        standardValuePerUnit: 75,
        formula: '',
        materialStandard: '',
        waitTime: null,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    },

    // Aufräumen / Entsorgen
    {
        id: 'service_aufraeumen',
        title: 'Aufräumen / Entsorgen',
        parentServiceId: '',
        serviceType: 'Unterleistung Backend',
        variant: 'Abfälle sammeln, entsorgen, reinigen',
        includedIn: [],
        unit: 'm²',
        maxProductivityPerDay: 204,
        standardQuantity: 44,
        standardTime: 90, // 1,5 h
        standardValuePerUnit: 2.25,
        formula: '2,25 min/m² (90 min ÷ 40 m²)',
        materialStandard: '',
        waitTime: 0,
        minTime: null,
        efficiencyStart: null,
        efficiencyCap: null,
        efficiencyStepPercent: null
    }
];

// Sonderleistungen
export const specialServicesData = [
    {
        id: 'special_verschmutzung',
        title: 'Verschmutzung/Verfärbung',
        affectsArea: ['Decken', 'Wände', 'Fenster innen', 'Türen'],
        requiredService: 'service_zusaetzlicher_grundanstrich',
        affectsService: ['service_overholungsanstrich', 'service_lackieren'],
        category: 'Leistung',
        objectType: ['Raum', 'Fenster', 'Türen'],
        inputType: 'Leistungsspezifikation',
        source: 'Onboarding',
        uxDescription: 'Wenn der Kunde im Shop die Leistung Überholungsanstrich auswählt, sind mögliche Sonderleistungen hierzu abzufragen. Hier: sind die Oberflächen verschmutzt oder verfärbt',
        factor: 1.0 // KEIN Faktor! Ist eine Zusatzleistung (requiredService), keine Erschwernis
    },
    {
        id: 'special_nikotin',
        title: 'Nikotinverfärbung',
        affectsArea: ['Decken', 'Wände', 'Fenster innen', 'Türen'],
        requiredService: 'service_isoliergrundierung',
        affectsService: ['service_overholungsanstrich', 'service_lackieren'],
        category: 'Leistung',
        objectType: ['Raum', 'Fenster', 'Türen'],
        inputType: 'Leistungsspezifikation',
        source: 'Onboarding',
        uxDescription: 'Wenn der Kunde im Shop die Leistung Überholungsanstrich auswählt, sind mögliche Sonderleistungen hierzu abzufragen. Hier: Wurde in dem Raum geraucht',
        factor: 1.0 // KEIN Faktor! Ist eine Zusatzleistung (requiredService), keine Erschwernis
    },
    {
        id: 'special_duebelloecher',
        title: 'Dübellöcher',
        affectsArea: ['Wände'],
        requiredService: 'service_duebelloecher',
        affectsService: ['service_overholungsanstrich'],
        category: 'Leistung',
        objectType: ['Raum'],
        inputType: 'Leistungsspezifikation',
        source: 'Onboarding',
        uxDescription: 'Wenn der Kunde im Shop die Leistung Überholungsanstrich auswählt, sind mögliche Sonderleistungen hierzu abzufragen. Hier: Sind Dübellöcher in den Wänden zu schließen',
        factor: 1.0 // Wird bereits als Unterleistung behandelt
    },
    {
        id: 'special_umraeumen',
        title: 'Umräumarbeiten werden benötigt',
        affectsArea: [],
        requiredService: null,
        affectsService: [],
        category: 'Leistung',
        objectType: ['Raum'],
        inputType: 'Objektverwaltung',
        source: 'Global',
        uxDescription: 'hier entsteht nur ein textlicher Platzhalter mit dem Hinweis: Arbeiten werden auf Zeitnachweis tatsächlicher Aufwand ausgeführt und separat abgerechnet',
        factor: 1.0 // Wird separat abgerechnet
    }
];

