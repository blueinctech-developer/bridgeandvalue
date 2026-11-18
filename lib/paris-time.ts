/** Dates entered and shown in the admin are Paris time (the business is in Paris). */

const parts = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  return (t: string) => p.find((x) => x.type === t)?.value;
};

/** Value for <input type="datetime-local"> in Paris time. */
export function parisLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const g = parts(new Date(iso));
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** "2026-11-12T09:30" entered in Paris time → ISO UTC; null if it isn't a date-time. */
export function parisToUtc(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = new Date(local + ":00Z");
  const g = parts(asUtc);
  const parisOfUtc = new Date(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00Z`);
  return new Date(asUtc.getTime() - (parisOfUtc.getTime() - asUtc.getTime())).toISOString();
}
