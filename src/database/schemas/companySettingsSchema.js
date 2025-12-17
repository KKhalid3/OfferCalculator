// Schema für Unternehmens-Einstellungen (Onboarding)
export const companySettingsSchema = {
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },

        // Stundenlohn (all-inclusive)
        laborRate: { type: 'number' }, // €/h

        // Arbeitszeiten
        dailyHours: { type: 'number' }, // Stunden Mo-Do (8.25)
        dailyHoursFriday: { type: 'number' }, // Stunden Freitag (7)
        weeklyHours: { type: 'number' }, // Stunden/Woche (40)

        // Mindestzeit
        minTimeAlone: { type: 'number' }, // Minuten (90 = 1:30h)

        // Baustellenpauschale
        siteSetup: { type: 'number' }, // Minuten Einrichtung (60)
        siteClearance: { type: 'number' }, // Minuten Räumung (60)

        // Onboarding-Status
        onboardingCompleted: { type: 'boolean' },

        // === Mehrpersonal-Planung ===
        // Ab wieviel Gesamtstunden Mehrpersonal überhaupt in Betracht gezogen wird
        minHoursForMultiEmployee: { type: ['number', 'null'] }, // z.B. 16h = 2 Arbeitstage

        // Mindestens X Stunden pro Mitarbeiter (um Leerlauf zu vermeiden)
        minHoursPerEmployee: { type: ['number', 'null'] }, // z.B. 6h (nicht unter 1 Tag)

        // Maximaler akzeptabler Effizienzverlust in % wenn mehrere Mitarbeiter
        maxEfficiencyLossPercent: { type: ['number', 'null'] }, // z.B. 10%

        // Ob Parallelarbeit in verschiedenen Räumen erlaubt ist (erfordert Kundenfreigabe)
        allowParallelRoomWork: { type: ['boolean', 'null'] },

        // === Mitarbeiter-Zeitersparnis-Regel (proportional) ===
        // Proportionale Regel: Für n Mitarbeiter müssen (n-1) × dieser Wert Wochen gespart werden
        // Beispiel: 1 = 1 Woche pro zusätzlichem Mitarbeiter
        // - 2 MA → 1 Woche sparen (im Vergleich zu 1 MA)
        // - 3 MA → 2 Wochen sparen (im Vergleich zu 1 MA)
        // - 4 MA → 3 Wochen sparen (im Vergleich zu 1 MA)
        weeksSavedPerAdditionalEmployee: { type: ['number', 'null'] }, // Standard: 1

        // === Überstunden & Task-Aufteilung ===
        // Max. erlaubte Überstunden in % (z.B. 15 = 15% über regulärer Arbeitszeit)
        maxOvertimePercent: { type: ['number', 'null'] },

        // Mindestzeit für einen aufgeteilten Task-Teil in Minuten
        // Wenn Rest < minTaskSplitTime → lieber Überstunden als neuer Tag
        minTaskSplitTime: { type: ['number', 'null'] },

        // Timestamps
        createdAt: { type: 'number' },
        updatedAt: { type: 'number' }
    },
    required: ['id']
};

// Default-Werte für neue Unternehmen
export const defaultCompanySettings = {
    id: 'company_settings',
    laborRate: 65,
    dailyHours: 8.25,
    dailyHoursFriday: 7,
    weeklyHours: 40,
    minTimeAlone: 90, // 1:30h in Minuten
    siteSetup: 60, // 1h in Minuten
    siteClearance: 60, // 1h in Minuten
    onboardingCompleted: false,

    // Mehrpersonal-Planung Defaults
    minHoursForMultiEmployee: 16, // Ab 16h (2 Arbeitstage) Mehrpersonal erwägen
    minHoursPerEmployee: 6, // Min 6h pro Mitarbeiter (Restzeit max 2h Leerlauf)
    maxEfficiencyLossPercent: 10, // Max 10% Effizienzverlust akzeptabel
    allowParallelRoomWork: true, // Parallelarbeit in verschiedenen Räumen erlaubt
    weeksSavedPerAdditionalEmployee: 1, // 1 Woche pro zusätzlichem Mitarbeiter (2 MA → 1 Woche, 3 MA → 2 Wochen, etc.)

    // Überstunden & Task-Aufteilung Defaults
    maxOvertimePercent: 15, // Max 15% Überstunden erlaubt (bei 8h = 1:12h)
    minTaskSplitTime: 60, // Mindestens 60 Min für einen Task-Teil

    createdAt: Date.now(),
    updatedAt: Date.now()
};

