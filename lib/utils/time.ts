import { differenceInMinutes, format, parseISO } from "date-fns";

export function minutesSince(iso: string) {
  return Math.max(0, differenceInMinutes(new Date(), parseISO(iso)));
}

export function formatClock(iso: string) {
  return format(parseISO(iso), "HH:mm");
}

export function formatDateTime(iso: string) {
  return format(parseISO(iso), "dd MMM yyyy HH:mm");
}
