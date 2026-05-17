import React, { useState } from 'react';
import {
  NEI_SUBCATEGORY_VALUES,
  NEI_SUBCATEGORY_LABELS,
  NEI_SUBCATEGORY_UNSPECIFIED_LABEL,
  isNeiSubcategory,
} from '../../constants/neiSubcategory';

/**
 * Second step after user chooses Nei: pick reason or unspecified, then confirm.
 */
export default function NeiSubcategoryInlineStep({
  onConfirm,
  onBack,
  disabled = false,
  confirmLabel = 'Bekreft',
  serverError = null,
}) {
  const [sel, setSel] = useState(null);
  const [clientError, setClientError] = useState(null);

  const handleConfirm = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const sub =
      sel === null || sel === '__unspecified__' ? null : sel;
    if (sub != null && sub !== '' && !isNeiSubcategory(sub)) {
      setClientError('Ugyldig valg.');
      return;
    }
    setClientError(null);
    onConfirm(sub);
  };

  return (
    <div
      className="nei-subcat-inline-step"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8e8e8' }}
    >
      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, color: '#2b2d42' }}>
        Grunn for Nei
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 220,
          overflowY: 'auto',
        }}
      >
        {NEI_SUBCATEGORY_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setSel(v);
            }}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 8,
              border: sel === v ? '2px solid #c0392b' : '1px solid #ddd',
              background: sel === v ? '#fdeded' : '#fff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            {NEI_SUBCATEGORY_LABELS[v]}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setSel('__unspecified__');
          }}
          style={{
            textAlign: 'left',
            padding: '8px 10px',
            borderRadius: 8,
            border: sel === '__unspecified__' ? '2px solid #7f8c8d' : '1px solid #ddd',
            background: sel === '__unspecified__' ? '#f4f4f4' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 13,
            color: '#555',
          }}
        >
          {NEI_SUBCATEGORY_UNSPECIFIED_LABEL}
        </button>
      </div>
      {(serverError || clientError) ? (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: '8px 10px',
            fontSize: 12,
            color: '#7f1d1d',
            background: '#fee2e2',
            borderRadius: 8,
            border: '1px solid #fecaca',
          }}
        >
          {serverError || clientError}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={handleConfirm}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#c0392b',
            color: '#fff',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            background: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          Tilbake
        </button>
      </div>
    </div>
  );
}
