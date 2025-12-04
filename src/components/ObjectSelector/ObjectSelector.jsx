import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createObject, deleteObjectById, updateObjectById } from '../../store/slices/objectsSlice';
import { OBJECT_TYPES } from '../../constants';

export default function ObjectSelector() {
  const dispatch = useDispatch();
  const objects = useSelector(state => state.objects.objects);
  const loading = useSelector(state => state.objects.loading);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Wohnzimmer',
    floorArea: '',
    height: '2.5'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.floorArea) {
      alert('Bitte füllen Sie alle Felder aus');
      return;
    }

    dispatch(createObject({
      name: formData.name,
      type: formData.type,
      floorArea: parseFloat(formData.floorArea),
      height: parseFloat(formData.height),
      services: [],
      specialNotes: []
    }));

    // Formular zurücksetzen
    setFormData({
      name: '',
      type: 'Wohnzimmer',
      floorArea: '',
      height: '2.5'
    });
  };

  const handleDelete = (id) => {
    if (window.confirm('Möchten Sie dieses Objekt wirklich löschen?')) {
      dispatch(deleteObjectById(id));
    }
  };

  if (loading) {
    return <div className="loading">Lade Objekte...</div>;
  }

  return (
    <div className="card">
      <h2>Objekte hinzufügen</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Objektname:</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="z.B. Wohnzimmer"
            required
          />
        </div>

        <div className="form-group">
          <label>Objekttyp:</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          >
            {OBJECT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Grundfläche (m²):</label>
          <input
            type="number"
            step="0.1"
            value={formData.floorArea}
            onChange={(e) => setFormData({ ...formData, floorArea: e.target.value })}
            placeholder="z.B. 25"
            required
          />
        </div>

        <div className="form-group">
          <label>Raumhöhe (m):</label>
          <input
            type="number"
            step="0.1"
            value={formData.height}
            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
            placeholder="z.B. 2.5"
            required
          />
        </div>

        <button type="submit">Objekt hinzufügen</button>
      </form>

      <div style={{ marginTop: '30px' }}>
        <h3>Hinzugefügte Objekte ({objects.length})</h3>
        {objects.length === 0 ? (
          <p>Noch keine Objekte hinzugefügt</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {objects.map(obj => (
              <li key={obj.id} style={{ 
                padding: '10px', 
                marginBottom: '10px', 
                background: '#f9f9f9', 
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{obj.name}</strong> ({obj.type}) - {obj.floorArea} m², Höhe: {obj.height} m
                </div>
                <button 
                  onClick={() => handleDelete(obj.id)}
                  style={{ background: '#dc3545' }}
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

