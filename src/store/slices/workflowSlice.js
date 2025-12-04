import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';

export const saveWorkflow = createAsyncThunk(
  'workflow/saveWorkflow',
  async (workflowData) => {
    return await databaseService.saveWorkflow(workflowData);
  }
);

export const fetchWorkflows = createAsyncThunk(
  'workflow/fetchWorkflows',
  async () => {
    return await databaseService.getAllWorkflows();
  }
);

const initialState = {
  workflows: [],
  optimalEmployees: 1,
  loading: false,
  error: null,
};

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    setOptimalEmployees: (state, action) => {
      state.optimalEmployees = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveWorkflow.fulfilled, (state, action) => {
        const index = state.workflows.findIndex(w => w.id === action.payload.id);
        if (index !== -1) {
          state.workflows[index] = action.payload;
        } else {
          state.workflows.push(action.payload);
        }
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        state.workflows = action.payload;
      });
  },
});

export const { setOptimalEmployees } = workflowSlice.actions;
export default workflowSlice.reducer;

