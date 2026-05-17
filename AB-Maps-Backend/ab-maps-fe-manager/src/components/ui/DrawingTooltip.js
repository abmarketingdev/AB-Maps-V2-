import React from 'react';

const DrawingTooltip = ({ tooltip }) => {
  if (!tooltip.visible) return null;

  const style = {
    position: 'absolute',
    top: tooltip.position.y + 20,
    left: tooltip.position.x + 20,
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    pointerEvents: 'none',
    zIndex: 1001,
  };

  return <div style={style}>{tooltip.content}</div>;
};

export default DrawingTooltip; 