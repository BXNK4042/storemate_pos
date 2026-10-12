export type ExpiryStatus = "expired" | "expiring_soon" | "valid" | "none";

export interface ExpiryInfo {
  status: ExpiryStatus;
  label: string;
  diffDays?: number;
}

export function getExpiryStatus(expiryDateStr?: string | null): ExpiryInfo {
  if (!expiryDateStr || !expiryDateStr.trim()) {
    return { status: "none", label: "-" };
  }

  const parts = expiryDateStr.trim().split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return { status: "none", label: "-" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(parts[0], parts[1] - 1, parts[2]);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "expired", label: "หมดอายุ", diffDays };
  } else if (diffDays <= 7) {
    return { status: "expiring_soon", label: "ใกล้หมดอายุ", diffDays };
  } else {
    return { status: "valid", label: expiryDateStr, diffDays };
  }
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
