/**
 * Date helpers in Africa/Kigali time (UTC+2, no daylight saving).
 * Event dates are stored as plain "YYYY-MM-DD" strings in Kigali time.
 */
import { TIMEZONE_OFFSET_HOURS } from "./config";

const OFFSET_MS = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in Kigali as YYYY-MM-DD */
export const kigaliToday = (now: Date = new Date()): string =>
  new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** Kigali weekday for a moment (0 = Sunday … 4 = Thursday) */
export const kigaliWeekday = (now: Date = new Date()): number =>
  new Date(now.getTime() + OFFSET_MS).getUTCDay();

export const isValidDateString = (d: unknown): d is string =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z"));

export const isValidTime = (t: unknown): t is string =>
  typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** Whole days from `from` to `to` (both YYYY-MM-DD) */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY_MS);

/** Days from today (Kigali) until the event date */
export const daysUntil = (eventDate: string, now: Date = new Date()): number =>
  daysBetween(kigaliToday(now), eventDate);

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(date + "T00:00:00Z") + days * DAY_MS).toISOString().slice(0, 10);

/** Start of a Kigali calendar day as a UTC Date */
export const kigaliStartOfDay = (date: string): Date =>
  new Date(Date.parse(date + "T00:00:00Z") - OFFSET_MS);

/** End of a Kigali calendar day as a UTC Date */
export const kigaliEndOfDay = (date: string): Date =>
  new Date(kigaliStartOfDay(date).getTime() + DAY_MS - 1);

export const addHours = (d: Date, hours: number): Date => new Date(d.getTime() + hours * 3600 * 1000);
export const addMonths = (d: Date, months: number): Date => {
  const copy = new Date(d);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};
