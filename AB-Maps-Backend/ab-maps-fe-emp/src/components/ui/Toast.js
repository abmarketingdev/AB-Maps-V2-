import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

const Toast = ({ toast }) => {
  if (!toast.visible) return null;

  return (
    <div className={`toast-notification ${toast.type}`}>
      <FontAwesomeIcon icon={faExclamationCircle} className="toast-icon" />
      {toast.message}
    </div>
  );
};

export default Toast; 