/**
 * Date and timezone utility helpers for StoreMate POS.
 * Handles SQLite CURRENT_TIMESTAMP UTC formatting and Thailand (UTC+7) local time representations.
 */

/**
 * Parses a date value from DB or API.
 * SQLite's CURRENT_TIMESTAMP generates dates in the format 'YYYY-MM-DD HH:MM:SS' in UTC
 * without a 'T' or 'Z' timezone specifier. When passed directly to new Date(), JS parsers
 * in many browsers/runtimes treat date-time strings without timezone specifiers as local time,
 * causing timestamps to be displayed 7 hours behind in UTC+7.
 *
 * Normalizing 'YYYY-MM-DD HH:MM:SS' into 'YYYY-MM-DDTHH:MM:SSZ' ensures JavaScript treats
 * the timestamp as UTC and properly converts it to local browser/system time.
 */
export function parseDbDate(dateInput: string | Date | null | undefined): Date {
  if (!dateInput) {
    return new Date();
  }

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  const str = String(dateInput).trim();
  if (!str) {
    return new Date();
  }

  // SQLite 'YYYY-MM-DD HH:MM:SS' pattern (with optional fractional seconds)
  const sqliteUtcPattern = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  if (sqliteUtcPattern.test(str)) {
    return new Date(str.replace(" ", "T") + "Z");
  }

  // Standard ISO string missing Z or offset, e.g. 'YYYY-MM-DDTHH:MM:SS'
  const isoMissingZPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
  if (isoMissingZPattern.test(str)) {
    return new Date(str + "Z");
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats a date to Thai locale date-time string (e.g. 14/10/2569 15:30:00).
 */
export function formatThaiDateTime(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = parseDbDate(dateInput);
    if (isNaN(d.getTime())) return String(dateInput ?? "");

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };

    return d.toLocaleString("th-TH", options || defaultOptions);
  } catch {
    return String(dateInput ?? "");
  }
}

/**
 * Returns a 'YYYY-MM-DD' formatted string in local time.
 * Unlike d.toISOString().split('T')[0] (which converts to UTC and can shift backwards before 07:00 UTC+7),
 * this uses local getFullYear, getMonth, and getDate.
 */
export function getLocalDateString(dateInput: Date = new Date()): string {
  const d = dateInput instanceof Date && !isNaN(dateInput.getTime()) ? dateInput : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
