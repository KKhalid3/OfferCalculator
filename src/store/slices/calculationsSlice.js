import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';

export const saveCalculation = createAsyncThunk(
  'calculations/saveCalculation',
  async (calculationData) => {
    return await databaseService.saveCalculation(calculationData);
  }
);

export const fetchCalculationsByObject = createAsyncThunk(
  'calculations/fetchCalculationsByObject',
  async (objectId) => {
    return await databaseService.getCalculationsByObject(objectId);
  }
);

const initialState = {
  calculations: [],
  results: null,
  loading: false,
  error: null,
};

const calculationsSlice = createSlice({
  name: 'calculations',
  initialState,
  reducers: {
    setResults: (state, action) => {
      state.results = action.payload;
    },
    clearResults: (state) => {
      state.results = null;
      state.calculations = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveCalculation.fulfilled, (state, action) => {
        const index = state.calculations.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.calculations[index] = action.payload;
        } else {
          state.calculations.push(action.payload);
        }
      })
      .addCase(fetchCalculationsByObject.fulfilled, (state, action) => {
        state.calculations = action.payload;
      });
  },
});

export const { setResults, clearResults } = calculationsSlice.actions;
export default calculationsSlice.reducer;

