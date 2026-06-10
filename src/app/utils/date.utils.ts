/**
 * PHASE 3: Centralized Date Utilities (Frontend)
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
 * @param dateInput - Date to normalize
 * @returns Date in YYYY-MM-DD format (UTC)
 */
export function normalizeDate(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) {
    return null;
  }

  // If already a YYYY-MM-DD string, validate and return
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  let date: Date;
  
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
 * @param dateInput - Base date
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New date in YYYY-MM-DD format (UTC)
 */
export function addDays(dateInput: Date | string, days: number): string {
  const normalized = normalizeDate(dateInput);
  if (!normalized) {
    throw new Error('Invalid date input for addDays');
  }

  const [year, month, day] = normalized.split('-').map(Number);

  // Create UTC date at midnight
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Add days using UTC date manipulation
  date.setUTCDate(date.getUTCDate() + days);

  // Return normalized date string
  return normalizeDate(date) || '';
}

/**
 * Checks if two dates represent the same calendar day
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if same day
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  return normalized1 === normalized2;
}

/**
 * Gets today's date in YYYY-MM-DD format (UTC)
 * 
 * @returns Today's date
 */
export function getToday(): string {
  return normalizeDate(new Date()) || '';
}

/**
 * Today's calendar date in Asia/Kolkata (YYYY-MM-DD).
 * Use for booking UI default date and same-day slot filtering.
 */
export function getKolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

/**
 * Current minutes since midnight in Asia/Kolkata.
 */
export function getKolkataCurrentMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

/**
 * Gets the day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * 
 * @param dateInput - Date to check
 * @returns Day of week (0-6)
 */
export function getDayOfWeek(dateInput: Date | string): number {
  const normalized = normalizeDate(dateInput);
  if (!normalized) {
    throw new Error('Invalid date input for getDayOfWeek');
  }

  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return date.getUTCDay();
}

/**
 * Checks if a date is in the past (before today)
 * 
 * @param dateInput - Date to check
 * @returns True if date is in the past
 */
export function isPastDate(dateInput: Date | string): boolean {
  const normalized = normalizeDate(dateInput);
  if (!normalized) {
    return false;
  }
  const today = getToday();
  return normalized < today;
}

/**
 * Checks if a date is today
 * 
 * @param dateInput - Date to check
 * @returns True if date is today
 */
export function isToday(dateInput: Date | string): boolean {
  return isSameDay(dateInput, getToday());
}

/**
 * Validates that a date string is in YYYY-MM-DD format
 * 
 * @param dateString - Date string to validate
 * @returns True if valid format
 */
export function isValidDateString(dateString: string): boolean {
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
 * TIME UTILITIES - Handle time strings without Date conversions
 * These functions treat times as pure HH:mm strings to avoid timezone issues
 */

/**
 * Extracts time portion (HH:mm) from a datetime string
 * Handles both ISO datetime strings (2024-01-15T07:00:00.000Z) and pure time strings (07:00)
 * 
 * IMPORTANT: If the datetime is in UTC, this function converts it to IST (UTC+5:30) for display
 * because the backend stores IST times as UTC timestamps (e.g., 7 AM IST stored as 1:30 AM UTC)
 * 
 * @param datetimeString - ISO datetime string or HH:mm time string
 * @returns Time in HH:mm format in IST (e.g., "07:00")
 */
export function extractTime(datetimeString: string | null | undefined): string | null {
  if (!datetimeString) {
    return null;
  }

  // If already in HH:mm format, return as-is (assume it's already in IST)
  if (/^\d{2}:\d{2}$/.test(datetimeString)) {
    return datetimeString;
  }

  // Extract time from ISO datetime string
  // Formats: "2024-01-15T07:00:00.000Z" (UTC) or "2024-01-15T07:00:00+05:30" (IST)
  const timeMatch = datetimeString.match(/T(\d{2}:\d{2})/);
  if (timeMatch) {
    const utcTime = timeMatch[1];
    
    // Check if the datetime string has timezone info
    // If it ends with Z or has +00:00, it's UTC - convert to IST
    // If it has +05:30, it's already IST - return as-is
    if (datetimeString.endsWith('Z') || datetimeString.match(/[+-]00:00/)) {
      // UTC time - convert to IST (add 5:30)
      return convertUTCToIST(utcTime);
    } else if (datetimeString.match(/[+-]05:30/)) {
      // Already IST - return as-is
      return utcTime;
    } else {
      // No timezone info - assume UTC and convert to IST
      return convertUTCToIST(utcTime);
    }
  }

  // Try to parse as Date and extract time
  try {
    const date = new Date(datetimeString);
    if (!isNaN(date.getTime())) {
      // Get UTC hours/minutes from the ISO string (before timezone conversion)
      // Parse the ISO string directly to get UTC time
      const isoMatch = datetimeString.match(/T(\d{2}):(\d{2})/);
      if (isoMatch) {
        const utcHours = parseInt(isoMatch[1], 10);
        const utcMinutes = parseInt(isoMatch[2], 10);
        const utcTime = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
        // Convert UTC to IST
        return convertUTCToIST(utcTime);
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Converts UTC time to IST time (UTC+5:30)
 * 
 * @param utcTime - Time in HH:mm format (UTC)
 * @returns Time in HH:mm format (IST)
 */
function convertUTCToIST(utcTime: string): string {
  const [hoursStr, minutesStr] = utcTime.split(':');
  let hours = parseInt(hoursStr, 10);
  let minutes = parseInt(minutesStr, 10);
  
  // Add 5 hours 30 minutes
  minutes += 30;
  if (minutes >= 60) {
    minutes -= 60;
    hours += 1;
  }
  hours += 5;
  
  // Handle day rollover (hours >= 24)
  if (hours >= 24) {
    hours -= 24;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Formats a time string (HH:mm) to 12-hour AM/PM format
 * Input: "07:00" -> Output: "7:00 AM"
 * Input: "13:30" -> Output: "1:30 PM"
 * 
 * @param timeString - Time in HH:mm format
 * @returns Formatted time string (e.g., "7:00 AM")
 */
export function formatTimeToAMPM(timeString: string | null | undefined): string {
  if (!timeString) {
    return '';
  }

  // Extract time if it's a datetime string
  const time = extractTime(timeString);
  if (!time) {
    return '';
  }

  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return '';
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  const displayMinutes = String(minutes).padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Converts a time string (HH:mm) to total minutes since midnight
 * Used for numerical sorting of times
 * 
 * @param timeString - Time in HH:mm format
 * @returns Total minutes since midnight (e.g., "07:00" -> 420)
 */
export function timeToMinutes(timeString: string | null | undefined): number {
  if (!timeString) {
    return 0;
  }

  // Extract time if it's a datetime string
  const time = extractTime(timeString);
  if (!time) {
    return 0;
  }

  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

/**
 * Extracts date portion (YYYY-MM-DD) from a datetime string
 * Handles ISO datetime strings without using Date conversions for timezone safety
 * 
 * @param datetimeString - ISO datetime string
 * @returns Date in YYYY-MM-DD format
 */
export function extractDateFromDateTime(datetimeString: string | null | undefined): string | null {
  if (!datetimeString) {
    return null;
  }

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(datetimeString)) {
    return datetimeString;
  }

  // Extract date from ISO datetime string (YYYY-MM-DDTHH:mm:ss...)
  const dateMatch = datetimeString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  return null;
}

/**
 * Compares a datetime string with the current datetime
 * Returns true if the datetime is in the past
 * 
 * @param datetimeString - ISO datetime string to compare
 * @returns True if datetime is in the past
 */
export function isPastDateTime(datetimeString: string | null | undefined): boolean {
  if (!datetimeString) {
    return false;
  }

  // Parse the datetime string and compare with now
  // We use Date here for comparison but parse UTC components to avoid timezone issues
  try {
    const bookingDate = new Date(datetimeString);
    const now = new Date();
    
    // Compare timestamps directly
    return bookingDate.getTime() < now.getTime();
  } catch {
    return false;
  }
}

/**
 * Calculates duration between two time strings in minutes
 * 
 * @param startTime - Start time in HH:mm format or ISO datetime string
 * @param endTime - End time in HH:mm format or ISO datetime string
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(startTime: string | null | undefined, endTime: string | null | undefined): number {
  if (!startTime || !endTime) {
    return 0;
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // If times are on the same day, simple subtraction
  // If end is before start, assume it's next day (e.g., 23:00 to 01:00)
  if (endMinutes < startMinutes) {
    return (24 * 60 - startMinutes) + endMinutes;
  }
  
  return endMinutes - startMinutes;
}
