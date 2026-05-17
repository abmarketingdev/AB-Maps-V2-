import React from 'react';
import MapUIControl from './MapUIControl';

/**
 * Floating compass indicator showing current heading and cardinal letter.
 * Expects props: heading (0-360 or null), direction (e.g., 'N'),
 * onRequestPermission (function), hasPermission (null/boolean), isMobile (boolean)
 */
const CompassIndicator = ({ heading, direction, onRequestPermission, hasPermission, isMobile }) => {
  if (!isMobile) return null;

  const showPrompt = hasPermission === null || hasPermission === false;
  const angle = typeof heading === 'number' ? Math.round(heading) : null;

  return (
    <MapUIControl
      style={{ position: 'absolute', top: 16, right: 16 }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div
          title={angle != null ? `${angle}°` : 'Heading unavailable'}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            border: '2px solid #1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Needle */}
          <div style={{
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '16px solid #e53935',
            position: 'absolute',
            top: 6,
            transform: `rotate(${angle || 0}deg)`,
            transformOrigin: '50% 16px',
            transition: 'transform 120ms ease',
          }} />
          {/* Center dot */}
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#1976d2',
          }} />
        </div>

        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '6px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #e0e0e0',
          minWidth: 48,
          textAlign: 'center',
          fontWeight: 700,
          color: '#1976d2',
        }}>
          {direction || '—'}
        </div>

        {showPrompt && (
          <button
            onClick={onRequestPermission}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              fontWeight: 600,
            }}
            title="Enable compass"
          >
            Enable
          </button>
        )}
      </div>
    </MapUIControl>
  );
};

export default CompassIndicator;


