const MANILA_TIMEZONE = "Asia/Manila";

const phpCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPhp(amount: number | string | null | undefined): string {
  const numeric = typeof amount === "string" ? Number.parseFloat(amount) : Number(amount ?? 0);
  return phpCurrencyFormatter.format(Number.isFinite(numeric) ? numeric : 0);
}

/**
 * Returns YYYY-MM-DD in Asia/Manila timezone.
 */
export function getManilaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Resolves the active Saturday service date in Asia/Manila.
 * - mode === "upcoming": returns today if Saturday, otherwise the upcoming Saturday (for QR Pass).
 * - mode === "latest": returns today if Saturday, otherwise the most recent Saturday (for Reports/Liquidation).
 */
export function getSaturdayServiceDate(
  mode: "upcoming" | "latest" = "upcoming",
  referenceDate: Date = new Date()
): string {
  const manilaStr = getManilaDateString(referenceDate);
  const [y, m, d] = manilaStr.split("-").map(Number);
  const utcMidday = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = utcMidday.getUTCDay(); // 0=Sun ... 6=Sat

  if (dayOfWeek === 6) {
    return manilaStr;
  }

  const deltaDays =
    mode === "upcoming"
      ? 6 - dayOfWeek
      : -((dayOfWeek + 1) % 7);

  utcMidday.setUTCDate(utcMidday.getUTCDate() + deltaDays);
  const ry = utcMidday.getUTCFullYear();
  const rm = String(utcMidday.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(utcMidday.getUTCDate()).padStart(2, "0");
  return `${ry}-${rm}-${rd}`;
}

export function formatManilaDate(isoDateOrTimestamp: string | null | undefined): string {
  if (!isoDateOrTimestamp) return "—";
  const normalized =
    isoDateOrTimestamp.length === 10
      ? `${isoDateOrTimestamp}T12:00:00+08:00`
      : isoDateOrTimestamp;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return isoDateOrTimestamp;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatManilaDateTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "—";
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

/**
 * Generates deterministic weekly QR payload (0 KB database storage).
 * Format: SYCC:${userId}:${YYYY-MM-DD}
 */
export function buildQrPayload(profileId: string, serviceDate: string): string {
  return `SYCC:${profileId}:${serviceDate}`;
}

export interface ParsedQrPayload {
  profileId: string;
  serviceDate: string;
}

const QR_REGEX =
  /^SYCC:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}):(\d{4}-\d{2}-\d{2})$/;

export function parseQrPayload(raw: string): ParsedQrPayload | null {
  const match = raw.trim().match(QR_REGEX);
  if (!match) return null;
  return {
    profileId: match[1],
    serviceDate: match[2],
  };
}
