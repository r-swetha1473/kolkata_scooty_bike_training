/**
 * PHASE 3: Centralized Date Utilities
 * 
 * All date operations should use these utilities to ensure:
 * - Consistent UTC handling
 * - No timezone drift
 * - Predictable date arithmetic
 */

/**
 * Normalizes a date input to YYYY-MM-DD format
 * Handles: Date objects, ISO strings, YYYY-MM-DD strings
 * 
 * @param {Date|string} dateInput - Date to normalize
 * @returns {string} Date in YYYY-MM-DD format (UTC)
 */
function normalizeDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  // If already a YYYY-MM-DD string, validate and return
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  let date;
  
  // Parse input to Date object
  if (dateInput instanceof Date) {
    date = new Date(dateInput);
  } else if (typeof dateInput === 'string') {
    // Handle ISO strings or date strings
    date = new Date(dateInput);
  } else {
    throw new Error(`Invalid date input: ${dateInput}`);
  }

  // Validate date
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateInput}`);
  }

  // Extract UTC components to avoid timezone issues
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Adds or subtracts days from a date
 * Always moves exactly N calendar days (no skipping)
 * 
 * @param {Date|string} dateInput - Base date
 * @param {number} days - Number of days to add (positive) or subtract (negative)
 * @returns {string} New date in YYYY-MM-DD format (UTC)
 */
function addDays(dateInput, days) {
  const normalized = normalizeDate(dateInput);
  const [year, month, day] = normalized.split('-').map(Number);

  // Create UTC date at midnight
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Add days using UTC date manipulation
  date.setUTCDate(date.getUTCDate() + days);

  // Return normalized date string
  return normalizeDate(date);
}

/**
 * Checks if two dates represent the same calendar day
 * 
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {boolean} True if same day
 */
function isSameDay(date1, date2) {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  return normalized1 === normalized2;
}

/**
 * Gets today's date in YYYY-MM-DD format (UTC)
 * 
 * @returns {string} Today's date
 */
function getToday() {
  return normalizeDate(new Date());
}

/**
 * Gets the current date/time in UTC
 * 
 * @returns {Date} Current UTC date/time
 */
function getNow() {
  return new Date();
}

/**
 * Formats a date for display (converts UTC to IST for display)
 * 
 * @param {Date|string} dateInput - Date to format
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(dateInput, options = {}) {
  const normalized = normalizeDate(dateInput);
  const [year, month, day] = normalized.split('-').map(Number);
  
  // Create date in IST (UTC+5:30)
  const istDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  // Convert to IST by adding 5:30 hours
  istDate.setUTCHours(istDate.getUTCHours() + 5);
  istDate.setUTCMinutes(istDate.getUTCMinutes() + 30);

  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
    ...options
  };

  return istDate.toLocaleDateString('en-IN', defaultOptions);
}

/**
 * Validates that a date string is in YYYY-MM-DD format
 * 
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid format
 */
function isValidDateString(dateString) {
  if (typeof dateString !== 'string') {
    return false;
  }
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  
  return date.getUTCFullYear() === year &&
         date.getUTCMonth() === month - 1 &&
         date.getUTCDate() === day;
}

/**
 * Gets the day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * 
 * @param {Date|string} dateInput - Date to check
 * @returns {number} Day of week (0-6)
 */
function getDayOfWeek(dateInput) {
  const normalized = normalizeDate(dateInput);
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return date.getUTCDay();
}

/**
 * Checks if a date is in the past (before today)
 * 
 * @param {Date|string} dateInput - Date to check
 * @returns {boolean} True if date is in the past
 */
function isPastDate(dateInput) {
  const normalized = normalizeDate(dateInput);
  const today = getToday();
  return normalized < today;
}

/**
 * Checks if a date is today
 * 
 * @param {Date|string} dateInput - Date to check
 * @returns {boolean} True if date is today
 */
function isToday(dateInput) {
  return isSameDay(dateInput, getToday());
}

/**
 * Formats a timestamp for customer-facing messages in Asia/Kolkata.
 *
 * @param {Date|string} dateInput
 * @returns {string}
 */
function formatKolkataDateTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

module.exports = {
  normalizeDate,
  addDays,
  isSameDay,
  getToday,
  getNow,
  formatDateForDisplay,
  isValidDateString,
  getDayOfWeek,
  isPastDate,
  isToday,
  formatKolkataDateTime
};
