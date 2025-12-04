import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { databaseService } from '../../services/databaseService';

// Async Thunks
export const fetchObjects = createAsyncThunk(
  'objects/fetchObjects',
  async () => {
    return await databaseService.getAllObjects();
  }
);

export const createObject = createAsyncThunk(
  'objects/createObject',
  async (objectData) => {
    return await databaseService.createObject(objectData);
  }
);

export const updateObjectById = createAsyncThunk(
  'objects/updateObjectById',
  async ({ id, updates }) => {
    return await databaseService.updateObject(id, updates);
  }
);

export const deleteObjectById = createAsyncThunk(
  'objects/deleteObjectById',
  async (id) => {
    await databaseService.deleteObject(id);
    return id;
  }
);

const initialState = {
  objects: [],
  loading: false,
  error: null,
};

const objectsSlice = createSlice({
  name: 'objects',
  initialState,
  reducers: {
    setObjects: (state, action) => {
      state.objects = action.payload;
    },
    // Optimistic Update: Aktualisiere sofort im State
    updateObjectServices: (state, action) => {
      const { objectId, services } = action.payload;
      const index = state.objects.findIndex(obj => obj.id === objectId);
      if (index !== -1) {
        state.objects[index].services = services;
        state.objects[index].updatedAt = Date.now();
      }
    },
    // Optimistic Update für Sonderangaben
    updateObjectSpecialNotes: (state, action) => {
      const { objectId, specialNotes } = action.payload;
      const index = state.objects.findIndex(obj => obj.id === objectId);
      if (index !== -1) {
        state.objects[index].specialNotes = specialNotes;
        state.objects[index].updatedAt = Date.now();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchObjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchObjects.fulfilled, (state, action) => {
        state.loading = false;
        state.objects = action.payload;
      })
      .addCase(fetchObjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createObject.fulfilled, (state, action) => {
        state.objects.push(action.payload);
      })
      .addCase(updateObjectById.fulfilled, (state, action) => {
        console.log('Redux: updateObjectById fulfilled:', action.payload);
        const index = state.objects.findIndex(obj => obj.id === action.payload?.id);
        if (index !== -1 && action.payload) {
          // Aktualisiere nur die Felder, die sich geändert haben
          state.objects[index] = { 
            ...state.objects[index], 
            ...action.payload,
            // Behalte den optimistischen Update, falls DB-Update fehlschlägt
          };
          console.log('Redux: Objekt aktualisiert:', state.objects[index]);
        } else {
          console.warn('Redux: Objekt nicht gefunden oder payload null:', action.payload);
        }
      })
      .addCase(updateObjectById.rejected, (state, action) => {
        console.error('Redux: updateObjectById rejected:', action.error);
        // Bei Fehler: Rollback könnte hier implementiert werden
        // Für jetzt: Der optimistic update bleibt bestehen
      })
      .addCase(deleteObjectById.fulfilled, (state, action) => {
        state.objects = state.objects.filter(obj => obj.id !== action.payload);
      });
  },
});

export const { setObjects, updateObjectServices, updateObjectSpecialNotes } = objectsSlice.actions;
export default objectsSlice.reducer;

