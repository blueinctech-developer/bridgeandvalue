export function fmtDate(d: string | Date | null | undefined, withTime = true) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Paris",
  });
}

export const KIND_LABEL: Record<string, string> = {
  page: "Page",
  service: "Service",
  project: "Project (theme demo)",
  "project-cat": "Project category (theme demo)",
  author: "Author archive",
  custom: "New page",
};
