/**
 * Date Utility Functions with IST (Asia/Kolkata) Timezone Support
 */
import { formatDistanceToNow, isThisWeek, startOfWeek, endOfWeek } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// IST (Indian Standard Time) timezone constant
export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a date in IST timezone
 * @param {Date|string|number} date - Date to format
 * @param {string} formatStr - Format string (date-fns format)
 * @returns {string} Formatted date string in IST
 */
export function formatDateIST(date, formatStr = 'PPP') {
  if (!date) return '';
  try {
    return formatInTimeZone(new Date(date), IST_TIMEZONE, formatStr);
  } catch (err) {
    console.error('Error formatting date:', err);
    return '';
  }
}

/**
 * Format a date with time in IST timezone
 * @param {Date|string|number} date - Date to format
 * @param {string} formatStr - Format string (default: 'PPP p' = "Jan 1, 2024 at 6:30 PM")
 * @returns {string} Formatted date-time string in IST
 */
export function formatDateTimeIST(date, formatStr = 'PPP p') {
  return formatDateIST(date, formatStr);
}

/**
 * Format a time in IST timezone
 * @param {Date|string|number} date - Date to format
 * @param {string} formatStr - Format string (default: 'h:mm a' = "6:30 PM")
 * @returns {string} Formatted time string in IST
 */
export function formatTimeIST(date, formatStr = 'h:mm a') {
  return formatDateIST(date, formatStr);
}

/**
 * Format a date in short format (dd-MMM-yy) in IST
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string like "03-Feb-26"
 */
export function formatShortDateIST(date) {
  return formatDateIST(date, 'dd-MMM-yy');
}

/**
 * Format day name in IST (e.g., "Monday", "Tuesday")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Full day name like "Monday"
 */
export function formatDayNameIST(date) {
  return formatDateIST(date, 'EEEE');
}

/**
 * Get current date in IST timezone as Date object
 * @returns {Date} Current date/time in IST
 */
export function getNowIST() {
  return toZonedTime(new Date(), IST_TIMEZONE);
}

/**
 * Get today's date string in IST (yyyy-MM-dd)
 * @returns {string} Today's date in IST
 */
export function getTodayIST() {
  return formatDateIST(new Date(), 'yyyy-MM-dd');
}

/**
 * Check if a date is today in IST timezone
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is today in IST
 */
export function isTodayIST(date) {
  if (!date) return false;
  const dateInIST = formatDateIST(date, 'yyyy-MM-dd');
  const todayInIST = getTodayIST();
  return dateInIST === todayInIST;
}

/**
 * Check if a date is tomorrow in IST timezone
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is tomorrow in IST
 */
export function isTomorrowIST(date) {
  if (!date) return false;
  const dateInIST = formatDateIST(date, 'yyyy-MM-dd');
  const now = new Date();
  const tomorrowInIST = formatInTimeZone(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    IST_TIMEZONE,
    'yyyy-MM-dd'
  );
  return dateInIST === tomorrowInIST;
}

/**
 * Check if a date is yesterday in IST timezone
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is yesterday in IST
 */
export function isYesterdayIST(date) {
  if (!date) return false;
  const dateInIST = formatDateIST(date, 'yyyy-MM-dd');
  const now = new Date();
  const yesterdayInIST = formatInTimeZone(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    IST_TIMEZONE,
    'yyyy-MM-dd'
  );
  return dateInIST === yesterdayInIST;
}

/**
 * Format a message timestamp with smart formatting (Today, Yesterday, or date)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted message date
 */
export function formatMessageDate(date) {
  if (!date) return '';
  
  if (isTodayIST(date)) {
    return formatTimeIST(date);
  }
  if (isYesterdayIST(date)) {
    return `Yesterday ${formatTimeIST(date)}`;
  }
  return formatDateIST(date, 'MMM d, h:mm a');
}

/**
 * Format a date header with smart formatting (Today, Yesterday, or full date)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date header
 */
export function formatDateHeader(date) {
  if (!date) return '';
  
  if (isTodayIST(date)) return 'Today';
  if (isYesterdayIST(date)) return 'Yesterday';
  return formatDateIST(date, 'MMMM d, yyyy');
}

/**
 * Format relative time distance (e.g., "2 hours ago") considering IST
 * @param {Date|string|number} date - Date to compare
 * @param {Object} options - Options for formatDistanceToNow
 * @returns {string} Relative time string
 */
export function formatRelativeTimeIST(date, options = { addSuffix: true }) {
  if (!date) return '';
  try {
    // Convert to IST-aware date for comparison
    const istDate = toZonedTime(new Date(date), IST_TIMEZONE);
    return formatDistanceToNow(istDate, options);
  } catch (err) {
    console.error('Error formatting relative time:', err);
    return '';
  }
}

/**
 * Format a date for display in task lists/tables
 * Shows relative for near dates, absolute for far dates
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatTaskDate(date) {
  if (!date) return '';
  
  if (isTodayIST(date)) return 'Today';
  if (isTomorrowIST(date)) return 'Tomorrow';
  if (isYesterdayIST(date)) return 'Yesterday';
  
  return formatDateIST(date, 'MMM d, yyyy');
}

/**
 * Get date key for grouping (yyyy-MM-dd in IST)
 * @param {Date|string|number} date - Date to convert
 * @returns {string} Date key in yyyy-MM-dd format
 */
export function getDateKeyIST(date) {
  return formatDateIST(date, 'yyyy-MM-dd');
}

/**
 * Check if a date is in the past (compared to current IST time)
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPastIST(date) {
  if (!date) return false;
  const istNow = getNowIST();
  const istDate = toZonedTime(new Date(date), IST_TIMEZONE);
  return istDate < istNow;
}

/**
 * Format a date range in IST
 * @param {Date|string|number} startDate - Start date
 * @param {Date|string|number} endDate - End date
 * @returns {string} Formatted date range
 */
export function formatDateRangeIST(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const start = formatDateIST(startDate, 'MMM d');
  const end = formatDateIST(endDate, 'MMM d, yyyy');
  
  return `${start} - ${end}`;
}

/**
 * Parse a date string and ensure it's treated as IST
 * @param {string} dateStr - Date string to parse
 * @returns {Date} Parsed date in IST timezone
 */
export function parseDateIST(dateStr) {
  if (!dateStr) return null;
  return toZonedTime(new Date(dateStr), IST_TIMEZONE);
}

// Re-export date-fns functions that don't need timezone conversion
export { isThisWeek, startOfWeek, endOfWeek };
