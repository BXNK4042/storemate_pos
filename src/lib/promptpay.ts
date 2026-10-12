import QRCode from "qrcode";

export type PromptPayIdType = "phone" | "citizen_id" | "ewallet";
export type PromptPayMode = "dynamic" | "static";

export interface PromptPayOptions {
  id: string;
  type?: PromptPayIdType;
  amount?: number;
  mode?: PromptPayMode;
}

export interface PromptPayQrResult {
  payload: string;
  qrSvg: string;
  qrDataUrl: string;
  referenceNo: string;
  amount?: number;
  mode: PromptPayMode;
  merchantInfo: {
    name: string;
    rawId: string;
    maskedId: string;
    idType: PromptPayIdType;
  };
}

/**
 * Formats a single EMVCo Tag-Length-Value (TLV) string.
 * @param tag 2-character tag
 * @param value tag value
 */
export function formatTlv(tag: string, value: string): string {
  const paddedTag = tag.padStart(2, "0");
  const length = value.length.toString().padStart(2, "0");
  return `${paddedTag}${length}${value}`;
}

/**
 * Calculates CRC-16/CCITT-FALSE checksum.
 * Polynomial: 0x1021, Initial value: 0xFFFF, Final XOR: 0x0000, RefIn: false, RefOut: false.
 * Output: 4 uppercase hex characters zero-padded.
 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Normalizes PromptPay target identifier into standard EMVCo subtag format.
 * - Mobile: Formatted to 13 digits with country code: "0066" + 9 digits (e.g. 0812345678 -> 0066812345678)
 * - Citizen ID / Tax ID: Formatted to 13 digits
 * - e-Wallet: Formatted to 15 digits
 */
export function normalizePromptPayId(id: string, type: PromptPayIdType = "phone"): string {
  const cleaned = (id || "").replace(/\D/g, "");

  if (type === "phone") {
    let digits = cleaned;
    if (digits.startsWith("0066")) {
      digits = digits.slice(4);
    } else if (digits.startsWith("66")) {
      digits = digits.slice(2);
    } else if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }

    if (digits.length !== 9) {
      throw new Error(`เบอร์โทรศัพท์สำหรับพร้อมเพย์ต้องมี 10 หลัก (พบ ${cleaned.length} หลัก)`);
    }
    return `0066${digits}`;
  }

  if (type === "citizen_id") {
    if (cleaned.length !== 13) {
      throw new Error(`เลขประจำตัวประชาชน / ผู้เสียภาษี ต้องมี 13 หลัก (พบ ${cleaned.length} หลัก)`);
    }
    return cleaned;
  }

  if (type === "ewallet") {
    if (cleaned.length !== 15) {
      throw new Error(`e-Wallet ID ต้องมี 15 หลัก (พบ ${cleaned.length} หลัก)`);
    }
    return cleaned;
  }

  throw new Error(`ประเภทพร้อมเพย์ไม่ถูกต้อง: ${type}`);
}

/**
 * Validates a PromptPay ID according to its type.
 */
export function validatePromptPayId(
  id: string,
  type: PromptPayIdType
): { valid: boolean; error?: string } {
  try {
    normalizePromptPayId(id, type);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "รูปแบบข้อมูลไม่ถูกต้อง",
    };
  }
}

/**
 * Formats a PromptPay ID into a masked display string for privacy.
 */
export function maskPromptPayId(id: string, type: PromptPayIdType = "phone"): string {
  const digits = (id || "").replace(/\D/g, "");
  if (!digits) return "-";

  if (type === "phone") {
    let localPhone = digits;
    if (localPhone.startsWith("0066")) {
      localPhone = "0" + localPhone.slice(4);
    } else if (localPhone.startsWith("66")) {
      localPhone = "0" + localPhone.slice(2);
    }
    if (localPhone.length === 10) {
      return `${localPhone.slice(0, 3)}-xxx-${localPhone.slice(6)}`;
    }
    return `${localPhone.slice(0, 3)}...${localPhone.slice(-3)}`;
  }

  if (type === "citizen_id") {
    if (digits.length === 13) {
      return `${digits.slice(0, 1)}-xxxx-xxxxx-${digits.slice(10, 12)}-${digits.slice(12)}`;
    }
    return `${digits.slice(0, 2)}...${digits.slice(-2)}`;
  }

  if (type === "ewallet") {
    if (digits.length === 15) {
      return `${digits.slice(0, 3)}-xxxx-xxxx-${digits.slice(11)}`;
    }
    return `${digits.slice(0, 3)}...${digits.slice(-3)}`;
  }

  return digits;
}

/**
 * Generates an EMVCo-compliant PromptPay QR payload string.
 */
export function generatePromptPayPayload(options: PromptPayOptions): string {
  const { id, type = "phone", amount, mode } = options;

  const normalizedId = normalizePromptPayId(id, type);

  // Determine dynamic vs static
  const isDynamic = mode === "dynamic" || (mode !== "static" && typeof amount === "number" && amount > 0);

  // Tag 00: Payload Format Indicator (Fixed "01")
  const tag00 = formatTlv("00", "01");

  // Tag 01: Point of Initiation Method ("11" = static, "12" = dynamic)
  const tag01 = formatTlv("01", isDynamic ? "12" : "11");

  // Tag 29: Merchant Account Information (PromptPay)
  // AID: A000000677010111 (Bank of Thailand National ITMX PromptPay Application ID, 16 chars)
  const aidSubtag = formatTlv("00", "A000000677010111");

  let targetSubtag = "";
  if (type === "phone") {
    targetSubtag = formatTlv("01", normalizedId);
  } else if (type === "citizen_id") {
    targetSubtag = formatTlv("02", normalizedId);
  } else if (type === "ewallet") {
    targetSubtag = formatTlv("03", normalizedId);
  }

  const tag29Value = `${aidSubtag}${targetSubtag}`;
  const tag29 = formatTlv("29", tag29Value);

  // Tag 53: Transaction Currency (764 = THB)
  const tag53 = formatTlv("53", "764");

  // Tag 54: Transaction Amount (Dynamic only)
  let tag54 = "";
  if (isDynamic && typeof amount === "number" && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    tag54 = formatTlv("54", formattedAmount);
  }

  // Tag 58: Country Code ("TH")
  const tag58 = formatTlv("58", "TH");

  // Payload before CRC
  const payloadBeforeCrc = `${tag00}${tag01}${tag29}${tag53}${tag54}${tag58}6304`;

  // Calculate CRC16-CCITT checksum
  const checksum = crc16(payloadBeforeCrc);

  return `${payloadBeforeCrc}${checksum}`;
}

/**
 * Generates a base64 Data URL for a given QR payload.
 */
export async function generateQrDataUrl(
  payload: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...options,
  });
}

/**
 * Generates an SVG string for a given QR payload.
 */
export async function generateQrSvg(
  payload: string,
  options?: QRCode.QRCodeToStringOptions
): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...options,
  });
}

/**
 * Generates a standard PromptPay reference number for order tracking.
 * Format: PP-YYMMDD-XXXX
 */
export function generatePromptPayReference(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PP-${yy}${mm}${dd}-${random}`;
}
