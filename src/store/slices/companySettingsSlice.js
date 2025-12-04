import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';
import { defaultCompanySettings } from '../../database/schemas/companySettingsSchema';

export const fetchCompanySettings = createAsyncThunk(
    'companySettings/fetch',
    async () => {
        try {
            const settings = await databaseService.getCompanySettings();
            return settings || defaultCompanySettings;
        } catch (error) {
            console.error('Fehler beim Laden der Unternehmens-Einstellungen:', error);
            return defaultCompanySettings;
        }
    }
);

export const saveCompanySettings = createAsyncThunk(
    'companySettings/save',
    async (settings) => {
        return await databaseService.saveCompanySettings(settings);
    }
);

const initialState = {
    settings: null,
    loading: false,
    error: null,
};

const companySettingsSlice = createSlice({
    name: 'companySettings',
    initialState,
    reducers: {
        setSettings: (state, action) => {
            state.settings = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCompanySettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCompanySettings.fulfilled, (state, action) => {
                state.loading = false;
                state.settings = action.payload;
            })
            .addCase(fetchCompanySettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            .addCase(saveCompanySettings.fulfilled, (state, action) => {
                state.settings = action.payload;
            });
    },
});

export const { setSettings } = companySettingsSlice.actions;
export default companySettingsSlice.reducer;

