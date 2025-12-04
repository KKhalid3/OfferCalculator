import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';

export const fetchFactors = createAsyncThunk(
  'settings/fetchFactors',
  async () => {
    return await databaseService.getAllFactors();
  }
);

export const fetchSpecialServices = createAsyncThunk(
  'settings/fetchSpecialServices',
  async () => {
    console.log('fetchSpecialServices: Start');
    const specialServices = await databaseService.getAllSpecialServices();
    console.log('fetchSpecialServices: Geladen', specialServices.length, 'Special Services');
    return specialServices;
  }
);

const initialState = {
  factors: [],
  specialServices: [],
  customerApproval: false,
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setCustomerApproval: (state, action) => {
      state.customerApproval = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFactors.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFactors.fulfilled, (state, action) => {
        state.loading = false;
        state.factors = action.payload;
      })
      .addCase(fetchFactors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchSpecialServices.pending, (state) => {
        console.log('Redux: fetchSpecialServices pending');
      })
      .addCase(fetchSpecialServices.fulfilled, (state, action) => {
        state.specialServices = action.payload;
        console.log('✅ Redux: specialServices aktualisiert:', action.payload.length);
        if (action.payload.length > 0) {
          console.log('Erste SpecialService in Redux:', action.payload[0]);
        }
      })
      .addCase(fetchSpecialServices.rejected, (state, action) => {
        console.error('❌ Redux: fetchSpecialServices rejected:', action.error);
      });
  },
});

export const { setCustomerApproval } = settingsSlice.actions;
export default settingsSlice.reducer;

