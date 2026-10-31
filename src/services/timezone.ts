import { PeriodName } from '../types';

export function getZonedDate(timeZone?: string | null): Date {
  if (!timeZone) return new Date();
  try {
    const str = new Date().toLocaleString('en-US', { timeZone });
    return new Date(str);
  } catch {
    return new Date();
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB');
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getPeriodOf(dateOrHours: Date | number): PeriodName {
  const hours =
    typeof dateOrHours === 'number'
      ? dateOrHours
      : dateOrHours.getHours() + dateOrHours.getMinutes() / 60;

  if (hours >= 23 || hours < 5) return 'night';
  if (hours < 8) return 'dawn';
  if (hours < 12) return 'morning';
  if (hours < 16) return 'afternoon';
  if (hours < 19) return 'dusk';
  return 'evening';
}
