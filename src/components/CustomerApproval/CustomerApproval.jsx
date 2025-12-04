import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCustomerApproval } from '../../store/slices/settingsSlice';

export default function CustomerApproval() {
  const dispatch = useDispatch();
  const customerApproval = useSelector(state => state.settings.customerApproval);

  return (
    <div className="card">
      <h2>Kundenfreigabe</h2>
      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={customerApproval}
          onChange={(e) => dispatch(setCustomerApproval(e.target.checked))}
          style={{ marginRight: '10px', width: '20px', height: '20px' }}
        />
        <div>
          <strong>Freigabe für parallele Arbeiten an mehreren Objekten</strong>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
            Wenn aktiviert, können Effizienzsteigerungen bei größeren Mengen angewendet werden.
            Mehrere Objekte können gleichzeitig bearbeitet werden.
          </p>
        </div>
      </label>
    </div>
  );
}

