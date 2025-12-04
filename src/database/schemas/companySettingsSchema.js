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
    createdAt: Date.now(),
    updatedAt: Date.now()
};

