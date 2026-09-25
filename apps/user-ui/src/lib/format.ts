export const rwf = (n: number | null | undefined) => `${Math.round(n || 0).toLocaleString("en-US")} RWF`;

export const formatDate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => {
  if (!d) return "—";
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d);
  return date.toLocaleDateString("en-GB", opts);
};

export const formatDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Today in Kigali (UTC+2) as YYYY-MM-DD */
export const kigaliToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);

export const daysUntil = (date: string) =>
  Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(kigaliToday() + "T00:00:00Z")) / 86400000);

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting payment", className: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Delivered — please confirm", className: "bg-sky-100 text-sky-800" },
  disputed: { label: "Problem reported", className: "bg-orange-100 text-orange-800" },
  released: { label: "Completed", className: "bg-stone-200 text-stone-700" },
  cancelled_by_couple: { label: "Cancelled by you", className: "bg-stone-200 text-stone-700" },
  cancelled_by_provider: { label: "Cancelled by provider", className: "bg-red-100 text-red-800" },
  expired: { label: "Expired", className: "bg-stone-200 text-stone-600" },
  replaced: { label: "Replaced", className: "bg-stone-200 text-stone-600" },
};
