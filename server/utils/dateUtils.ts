// server/utils/dateUtils.ts

/**
 * Convert any date string to start of day UTC
 * Works for: 2025-11-27, 2025-11-27T12:00:00.000Z, etc.
 */
export function toStartOfDayUTC(dateInput: string | Date): Date {
  let dateStr: string;
  
  if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split('T')[0];
  } else {
    // Extract just the date part (YYYY-MM-DD)
    dateStr = dateInput.split('T')[0];
  }
  
  // Always return start of day UTC
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Convert any date string to end of day UTC
 */
export function toEndOfDayUTC(dateInput: string | Date): Date {
  let dateStr: string;
  
  if (dateInput instanceof Date) {
    dateStr = dateInput.toISOString().split('T')[0];
  } else {
    dateStr = dateInput.split('T')[0];
  }
  
  return new Date(`${dateStr}T23:59:59.999Z`);
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function toDateString(dateInput: string | Date): string {
  if (dateInput instanceof Date) {
    return dateInput.toISOString().split('T')[0];
  }
  return dateInput.split('T')[0];
}

/**
 * Create date range for queries
 */
export function createDateRange(startDate: string | Date, endDate: string | Date) {
  return {
    startDateTime: toStartOfDayUTC(startDate),
    endDateTime: toEndOfDayUTC(endDate),
  };
}

/**
 * Check if date is valid
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get array of dates between start and end (inclusive)
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}