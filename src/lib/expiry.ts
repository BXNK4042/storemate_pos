export type ExpiryStatus = "expired" | "expiring_soon" | "valid" | "none";

export interface ExpiryInfo {
  status: ExpiryStatus;
  label: string;
  diffDays?: number;
}

export function getExpiryStatus(_expiryDateStr?: string | null): ExpiryInfo {
  return { status: "none", label: "-" };
}

export function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return "-";
  const parts = dateStr.trim().split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
