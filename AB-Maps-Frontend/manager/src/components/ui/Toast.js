import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faCheckCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const Toast = ({ toast }) => {
  if (!toast.visible) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return faCheckCircle;
      case 'error':
        return faExclamationCircle;
      case 'info':
        return faInfoCircle;
      default:
        return faInfoCircle;
    }
  };

  return (
    <div className={`toast-notification ${toast.type}`}>
      <FontAwesomeIcon icon={getIcon(toast.type)} className="toast-icon" />
      {toast.message}
    </div>
  );
};

export default Toast; 