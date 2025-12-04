import { configureStore } from '@reduxjs/toolkit';
import objectsReducer from './slices/objectsSlice';
import servicesReducer from './slices/servicesSlice';
import settingsReducer from './slices/settingsSlice';
import calculationsReducer from './slices/calculationsSlice';
import workflowReducer from './slices/workflowSlice';
import companySettingsReducer from './slices/companySettingsSlice';

export const store = configureStore({
  reducer: {
    objects: objectsReducer,
    services: servicesReducer,
    settings: settingsReducer,
    calculations: calculationsReducer,
    workflow: workflowReducer,
    companySettings: companySettingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['objects/setObjects', 'services/setServices'],
      },
    }),
});

