import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';

export const fetchServices = createAsyncThunk(
  'services/fetchServices',
  async (_, { rejectWithValue }) => {
    try {
      const services = await databaseService.getAllServices();
      console.log(`✅ fetchServices: ${services.length} Services geladen`);

      // Debug: Zeige Service-Typen
      const shopLeistungen = services.filter(s => s.serviceType?.includes('Shop Leistung') && !s.serviceType?.includes('Shop Titel'));
      const unterleistungen = services.filter(s => s.serviceType?.includes('Unterleistung Backend'));
      const reineUnterleistungen = unterleistungen.filter(s => !s.serviceType?.includes('Shop Leistung'));

      console.log(`📊 Haupt-Leistungen: ${shopLeistungen.length}, Unterleistungen: ${unterleistungen.length}, Reine Unterleistungen: ${reineUnterleistungen.length}`);

      return services;
    } catch (error) {
      console.error('❌ Fehler in fetchServices:', error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchServiceById = createAsyncThunk(
  'services/fetchServiceById',
  async (id, { rejectWithValue }) => {
    try {
      return await databaseService.getServiceById(id);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSubServices = createAsyncThunk(
  'services/fetchSubServices',
  async (parentId, { rejectWithValue }) => {
    try {
      return await databaseService.getSubServices(parentId);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateServiceMaterial = createAsyncThunk(
  'services/updateServiceMaterial',
  async ({ serviceId, materialType, materialValue }, { rejectWithValue }) => {
    try {
      return await databaseService.updateServiceMaterial(serviceId, materialType, materialValue);
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Thunk für Service-Konfiguration Update
export const updateServiceConfig = createAsyncThunk(
  'services/updateServiceConfig',
  async ({ serviceId, config }, { rejectWithValue }) => {
    try {
      const result = await databaseService.updateServiceConfig(serviceId, config);
      if (!result) {
        throw new Error(`Service ${serviceId} nicht gefunden oder Update fehlgeschlagen`);
      }
      console.log(`✅ updateServiceConfig: ${serviceId} aktualisiert`);
      return result;
    } catch (error) {
      console.error(`❌ updateServiceConfig Fehler für ${serviceId}:`, error);
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  services: [],
  loading: false,
  error: null,
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setServices: (state, action) => {
      state.services = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchServices
      .addCase(fetchServices.pending, (state) => {
        state.loading = true;
        state.error = null;
        // WICHTIG: Services NICHT löschen während des Ladens, damit UI nicht leer wird
      })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.loading = false;

        // Prüfe ob Services geladen wurden
        if (!action.payload) {
          console.warn('⚠️ fetchServices: action.payload ist null/undefined, behalte alten State');
          return; // Behalte alten State
        }

        // WICHTIG: Wenn weniger Services geladen wurden als erwartet, behalte alten State
        // (36 Services erwartet, wenn weniger = Problem)
        if (action.payload.length === 0) {
          console.warn('⚠️ fetchServices: Keine Services geladen, behalte alten State');
          return; // Behalte alten State
        }

        // Wenn deutlich weniger Services geladen wurden als erwartet, könnte ein Fehler vorliegen
        if (action.payload.length < state.services.length && state.services.length > 0) {
          console.warn(`⚠️ fetchServices: Nur ${action.payload.length} Services geladen, erwartet mindestens ${state.services.length}. Prüfe...`);
          // Prüfe ob es ein echtes Problem ist oder nur ein temporäres
          // Wenn weniger als 10 Services, ist es definitiv ein Problem
          if (action.payload.length < 10) {
            console.error(`❌ KRITISCH: Nur ${action.payload.length} Services geladen! Behalte alten State mit ${state.services.length} Services`);
            return; // Behalte alten State
          }
        }

        // Prüfe ob serviceType bei allen Services vorhanden ist
        const servicesWithoutType = action.payload.filter(s => !s.serviceType);
        if (servicesWithoutType.length > 0) {
          console.error(`❌ KRITISCH: ${servicesWithoutType.length} Services ohne serviceType gefunden!`, servicesWithoutType.map(s => s.id));
        }

        // Ersetze State komplett (das ist korrekt, da wir alle Services neu laden)
        state.services = action.payload;
        console.log(`✅ Redux: ${action.payload.length} Services im State aktualisiert`);
      })
      .addCase(fetchServices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
        console.error('❌ Redux: fetchServices rejected:', action.payload);
        // WICHTIG: Bei Fehler State NICHT löschen, damit UI nicht leer wird
      })
      // fetchServiceById
      .addCase(fetchServiceById.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.services.findIndex(s => s.id === action.payload.id);
          if (index !== -1) {
            state.services[index] = action.payload;
          } else {
            state.services.push(action.payload);
          }
        }
      })
      .addCase(fetchServiceById.rejected, (state, action) => {
        console.error('❌ fetchServiceById rejected:', action.payload);
      })
      // updateServiceMaterial
      .addCase(updateServiceMaterial.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.services.findIndex(s => s.id === action.payload.id);
          if (index !== -1) {
            // Nur die geänderten Felder aktualisieren, serviceType beibehalten!
            state.services[index] = {
              ...state.services[index],
              ...action.payload,
              serviceType: state.services[index].serviceType // serviceType NICHT überschreiben!
            };
          }
        }
      })
      .addCase(updateServiceMaterial.rejected, (state, action) => {
        console.error('❌ updateServiceMaterial rejected:', action.payload);
      })
      // updateServiceConfig
      .addCase(updateServiceConfig.pending, (state) => {
        // Kein loading state, damit UI nicht blockiert wird
      })
      .addCase(updateServiceConfig.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.services.findIndex(s => s.id === action.payload.id);
          const totalServicesBefore = state.services.length;

          if (index !== -1) {
            // KRITISCH: serviceType IMMER aus dem Original-State bewahren!
            const originalService = state.services[index];
            const originalServiceType = originalService?.serviceType;

            // Prüfe ob DB einen serviceType zurückgibt
            const dbServiceType = action.payload.serviceType;

            // Verwende Original serviceType, es sei denn DB hat einen gültigen Wert
            // ABER: Original hat immer Priorität, da wir wissen, dass es korrekt ist
            const finalServiceType = originalServiceType || dbServiceType;

            if (!finalServiceType) {
              console.error(`❌ KRITISCH: Service ${action.payload.id} hat keinen serviceType!`);
            }

            // Merge: Behalte alle Original-Felder, aktualisiere nur die geänderten
            state.services[index] = {
              ...originalService, // Alle Original-Felder beibehalten
              ...action.payload,  // Neue Werte überschreiben
              serviceType: finalServiceType, // serviceType IMMER bewahren
            };

            console.log(`✅ Redux: Service ${action.payload.id} aktualisiert (serviceType: ${finalServiceType}, Total Services: ${state.services.length})`);

            // Sicherheitscheck: State sollte nicht kleiner werden
            if (state.services.length < totalServicesBefore) {
              console.error(`❌ KRITISCH: State wurde kleiner! Vorher: ${totalServicesBefore}, Nachher: ${state.services.length}`);
            }
          } else {
            // Service nicht gefunden - füge hinzu (sollte eigentlich nicht passieren)
            console.warn(`⚠️ Service ${action.payload.id} nicht in Redux State gefunden (${state.services.length} Services im State), füge hinzu`);
            state.services.push(action.payload);
            console.log(`✅ Service hinzugefügt, jetzt ${state.services.length} Services im State`);
          }
        } else {
          console.error('❌ updateServiceConfig.fulfilled: action.payload ist null/undefined!');
        }
      })
      .addCase(updateServiceConfig.rejected, (state, action) => {
        state.error = action.payload;
        console.error('❌ updateServiceConfig rejected:', action.payload);
      });
  },
});

export const { setServices } = servicesSlice.actions;
export default servicesSlice.reducer;

