/**
 * Date utility functions for area date handling
 */

/**
 * Convert date input (datetime-local format) to ISO 8601 UTC string
 * @param {string} dateTimeLocal - Date string in format "YYYY-MM-DDTHH:mm"
 * @returns {string} ISO 8601 UTC string (e.g., "2024-12-31T23:59:59Z")
 */
export const formatDateToISO = (dateTimeLocal) => {
  if (!dateTimeLocal) return null;
  
  const date = new Date(dateTimeLocal);
  return date.toISOString();
};

/**
 * Convert ISO 8601 UTC string to datetime-local format for input field
 * @param {string} isoString - ISO 8601 string (e.g., "2024-12-31T23:59:59Z")
 * @returns {string} datetime-local format (e.g., "2024-12-31T23:59")
 */
export const formatISOToLocal = (isoString) => {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Get current date in datetime-local format
 * @returns {string} Current date in datetime-local format
 */
export const getCurrentDateLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Validate that end_date is after start_date and not before current date
 * @param {string} endDateLocal - End date in datetime-local format
 * @param {string} startDateLocal - Start date in datetime-local format (optional, defaults to now)
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateDateRange = (endDateLocal, startDateLocal = null) => {
  if (!endDateLocal) {
    return { valid: true, error: null }; // end_date is optional
  }
  
  const endDate = new Date(endDateLocal);
  const currentDate = new Date();
  const startDate = startDateLocal ? new Date(startDateLocal) : currentDate;
  
  // First check: end_date cannot be before current date
  if (endDate < currentDate) {
    return {
      valid: false,
      error: 'Sluttdato kan ikke være før dagens dato'
    };
  }
  
  // Second check: end_date must be after start_date
  if (endDate <= startDate) {
    return {
      valid: false,
      error: 'Sluttdato må være etter startdato (i dag)'
    };
  }
  
  return { valid: true, error: null };
};

