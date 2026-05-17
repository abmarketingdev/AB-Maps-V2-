import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

const Toast = ({ toast, onClose }) => {
  if (!toast.visible) return null;

  return (
    <div className={`toast-notification ${toast.type}`}>
      <FontAwesomeIcon icon={faExclamationCircle} className="toast-icon" />
      <span>{toast.message}</span>
      <button
        aria-label="Close"
        className="toast-close"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onClose) onClose();
        }}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </div>
  );
};

export default Toast; 