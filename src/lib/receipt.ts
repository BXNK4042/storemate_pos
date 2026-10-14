/**
 * Core receipt formatting engine for StoreMate POS.
 * Supports Plain Text (TXT) and ESC/POS thermal printing (58mm / 80mm).
 * Client-safe and pure: does not require native database modules.
 */

import { parseDbDate } from "./date-utils";

export interface ReceiptItemInput {
  item_id?: number;
  item_name: string;
  item_price?: number;
  quantity: number;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  final_price?: number;
}

export interface ReceiptOrderInput {
  order_id?: number;
  order_name: string;
  order_price: number;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  promptpay_type?: "dynamic" | "static" | null;
  promptpay_ref?: string | null;
  promptpay_payload?: string | null;
  status?: string;
  refund_reason?: string | null;
  created_at: string | Date;
  items: ReceiptItemInput[];
}

export interface ReceiptOptions {
  width?: number; // 32 for 58mm, 42 or 48 for 80mm
  storeName?: string;
  storeAddress?: string;
  storeTaxId?: string;
  storePhone?: string;
  footerMessage?: string;
}

/**
 * Normalizes Thai combining characters (upper/lower vowels and tone marks)
 * which do not occupy horizontal column width in monospace printing.
 */
export function getDisplayWidth(str: string): number {
  const combiningRegex = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
  const stripped = str.replace(combiningRegex, "");
  return stripped.length;
}

/**
 * Truncates a string to a maximum display width, respecting Thai combining characters.
 */
export function truncateDisplay(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (getDisplayWidth(str) <= maxWidth) return str;

  let currentWidth = 0;
  let result = "";
  for (const char of Array.from(str)) {
    const isCombining = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(char);
    const charWidth = isCombining ? 0 : 1;
    if (currentWidth + charWidth > maxWidth) break;
    result += char;
    currentWidth += charWidth;
  }
  return result;
}

/**
 * Wraps text into multiple lines respecting maxWidth display width.
 */
export function wrapDisplay(str: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [str];
  if (getDisplayWidth(str) <= maxWidth) return [str];

  const lines: string[] = [];
  let currentLine = "";
  let currentWidth = 0;

  for (const char of Array.from(str)) {
    const isCombining = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(char);
    const charWidth = isCombining ? 0 : 1;

    if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

export function padRight(str: string, targetWidth: number): string {
  const width = getDisplayWidth(str);
  if (width >= targetWidth) return str;
  return str + " ".repeat(targetWidth - width);
}

export function padLeft(str: string, targetWidth: number): string {
  const width = getDisplayWidth(str);
  if (width >= targetWidth) return str;
  return " ".repeat(targetWidth - width) + str;
}

export function centerText(str: string, totalWidth: number): string {
  const width = getDisplayWidth(str);
  if (width >= totalWidth) return str;
  const leftPad = Math.floor((totalWidth - width) / 2);
  const rightPad = totalWidth - width - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}

export function formatTwoCols(left: string, right: string, totalWidth: number): string {
  const leftWidth = getDisplayWidth(left);
  const rightWidth = getDisplayWidth(right);
  const spaces = Math.max(1, totalWidth - leftWidth - rightWidth);
  return left + " ".repeat(spaces) + right;
}

export function formatLine(char: string = "-", totalWidth: number = 32): string {
  return char.repeat(Math.max(1, totalWidth));
}

export function formatDateTime(dateInput: string | Date): string {
  try {
    const d = parseDbDate(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Generates formatted raw plain text receipt.
 */
export function formatTextReceipt(order: ReceiptOrderInput, options: ReceiptOptions = {}): string {
  const width = options.width && options.width >= 24 ? options.width : 32;
  const storeName = options.storeName?.trim() || "ร้านค้า StoreMate";
  const footerMessage = options.footerMessage?.trim() || "ขอบคุณที่ใช้บริการ";
  const isRefunded = order.status === "refunded";
  const isPromptPay = order.payment_method === "promptpay";

  const lines: string[] = [];

  // 1. Header
  lines.push(centerText(storeName, width));
  if (options.storeAddress?.trim()) {
    lines.push(centerText(options.storeAddress.trim(), width));
  }
  if (options.storeTaxId?.trim()) {
    lines.push(centerText(`เลขประจำตัวผู้เสียภาษี: ${options.storeTaxId.trim()}`, width));
  }
  if (options.storePhone?.trim()) {
    lines.push(centerText(`โทร: ${options.storePhone.trim()}`, width));
  }
  lines.push(centerText(`เลขที่: ${order.order_name}`, width));
  lines.push(centerText(`วันที่: ${formatDateTime(order.created_at)}`, width));

  // 2. Divider
  lines.push(formatLine("-", width));

  // 3. Refund Banner
  if (isRefunded) {
    lines.push(centerText("*** ยกเลิก / คืนเงินแล้ว ***", width));
    if (order.refund_reason?.trim()) {
      lines.push(centerText(`เหตุผล: ${order.refund_reason.trim()}`, width));
    }
    lines.push(formatLine("-", width));
  }

  // 4. Item Table
  const qtyWidth = Math.max(6, Math.floor(width * 0.2));
  const priceWidth = Math.max(8, Math.floor(width * 0.28));
  const nameWidth = width - qtyWidth - priceWidth;

  // Table header
  lines.push(
    padRight("รายการ", nameWidth) +
    padLeft("จำนวน", qtyWidth) +
    padLeft("รวม(฿)", priceWidth)
  );

  for (const item of order.items) {
    const itemTotal = item.final_price !== undefined
      ? item.final_price
      : (item.subtotal ?? (item.item_price ?? 0) * item.quantity);
    const qtyStr = `x${item.quantity}`;
    const priceStr = Number(itemTotal).toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const itemDisplayName = item.item_name;
    if (getDisplayWidth(itemDisplayName) <= nameWidth) {
      lines.push(
        padRight(itemDisplayName, nameWidth) +
        padLeft(qtyStr, qtyWidth) +
        padLeft(priceStr, priceWidth)
      );
    } else {
      const wrapped = wrapDisplay(itemDisplayName, nameWidth);
      lines.push(
        padRight(wrapped[0], nameWidth) +
        padLeft(qtyStr, qtyWidth) +
        padLeft(priceStr, priceWidth)
      );
      for (let i = 1; i < wrapped.length; i++) {
        lines.push(padRight(wrapped[i], nameWidth));
      }
    }

    // Item-level discount
    const itemDiscount = item.discount_amount ?? 0;
    if (itemDiscount > 0) {
      const discPercent = item.discount_type === "percentage" && item.discount_value
        ? ` (${item.discount_value}%)`
        : "";
      const discLabel = `  ↳ ส่วนลด${discPercent}:`;
      const discVal = `-${itemDiscount.toLocaleString()} ฿`;
      lines.push(formatTwoCols(discLabel, discVal, width));
    }
  }

  // 5. Divider
  lines.push(formatLine("-", width));

  // 6. Summary & Taxes
  if (order.subtotal !== undefined && order.subtotal !== order.order_price) {
    lines.push(formatTwoCols("ยอดรวมสินค้า", `${order.subtotal.toLocaleString()} ฿`, width));
  }

  const orderDiscount = order.discount_amount ?? 0;
  if (orderDiscount > 0) {
    const billPercent = order.discount_type === "percentage" && order.discount_value
      ? ` (${order.discount_value}%)`
      : "";
    lines.push(formatTwoCols(`ส่วนลดท้ายบิล${billPercent}`, `-${orderDiscount.toLocaleString()} ฿`, width));
  }

  lines.push(formatTwoCols("ยอดรวมก่อนภาษี", `${(order.order_price * 0.93).toFixed(2)} ฿`, width));
  lines.push(formatTwoCols("ภาษีมูลค่าเพิ่ม (7%)", `${(order.order_price * 0.07).toFixed(2)} ฿`, width));
  lines.push(formatTwoCols("ยอดสุทธิ", `${order.order_price.toLocaleString()} ฿`, width));

  // 7. Payment Information
  lines.push(formatLine("-", width));
  lines.push(formatTwoCols("สถานะ", isRefunded ? "คืนเงินแล้ว" : "ชำระเงินสำเร็จ", width));
  lines.push(formatTwoCols("วิธีชำระ", isPromptPay ? "พร้อมเพย์ (PromptPay QR)" : "เงินสด", width));

  if (isPromptPay) {
    const qrTypeStr = order.promptpay_type === "static"
      ? "Static QR (ใส่ยอดเอง)"
      : "Dynamic QR (ยอดตรง)";
    lines.push(formatTwoCols("รูปแบบ QR", qrTypeStr, width));
    if (order.promptpay_ref) {
      lines.push(formatTwoCols("รหัสอ้างอิง QR", order.promptpay_ref, width));
    }
  }

  const paidAmount = order.amount_paid ?? order.order_price;
  lines.push(formatTwoCols(isPromptPay ? "ยอดโอนชำระ" : "รับเงินสด", `${paidAmount.toLocaleString()} ฿`, width));

  if (!isPromptPay) {
    const change = order.change_amount ?? 0;
    const isExact = change === 0 || paidAmount === order.order_price;
    const changeStr = isExact ? `${change.toLocaleString()} ฿ (ยอดพอดี)` : `${change.toLocaleString()} ฿`;
    lines.push(formatTwoCols("เงินทอน", changeStr, width));
  }

  // 8. Footer
  lines.push(formatLine("-", width));
  lines.push(centerText(footerMessage, width));
  lines.push(centerText("StoreMate POS", width));

  return lines.join("\n") + "\n";
}

/**
 * Builder for ESC/POS thermal printer byte streams.
 */
export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  private encoder = new TextEncoder();

  init(): this {
    this.chunks.push(new Uint8Array([0x1B, 0x40])); // ESC @
    return this;
  }

  align(alignment: "left" | "center" | "right"): this {
    const n = alignment === "left" ? 0 : alignment === "center" ? 1 : 2;
    this.chunks.push(new Uint8Array([0x1B, 0x61, n])); // ESC a n
    return this;
  }

  bold(enable: boolean): this {
    this.chunks.push(new Uint8Array([0x1B, 0x45, enable ? 1 : 0])); // ESC E n
    return this;
  }

  size(doubleSize: boolean): this {
    this.chunks.push(new Uint8Array([0x1D, 0x21, doubleSize ? 0x11 : 0x00])); // GS ! n
    return this;
  }

  text(str: string): this {
    this.chunks.push(this.encoder.encode(str));
    return this;
  }

  line(str: string = ""): this {
    this.chunks.push(this.encoder.encode(str + "\n"));
    return this;
  }

  feed(lines: number = 3): this {
    this.chunks.push(new Uint8Array([0x1B, 0x64, lines])); // ESC d n
    return this;
  }

  cut(): this {
    this.chunks.push(new Uint8Array([0x1D, 0x56, 0x42, 0x00])); // GS V B 0
    return this;
  }

  build(): Uint8Array {
    const totalLength = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

/**
 * Generates an ESC/POS binary command sequence (Uint8Array)
 * suitable for USB, Serial, or Network thermal printers.
 */
export function generateEscPosReceipt(order: ReceiptOrderInput, options: ReceiptOptions = {}): Uint8Array {
  const width = options.width && options.width >= 24 ? options.width : 32;
  const storeName = options.storeName?.trim() || "ร้านค้า StoreMate";
  const footerMessage = options.footerMessage?.trim() || "ขอบคุณที่ใช้บริการ";
  const isRefunded = order.status === "refunded";
  const isPromptPay = order.payment_method === "promptpay";

  const builder = new EscPosBuilder();

  // 1. Initialize
  builder.init();

  // 2. Header
  builder.align("center");
  builder.size(true).bold(true).line(storeName).size(false).bold(false);

  if (options.storeAddress?.trim()) {
    builder.line(options.storeAddress.trim());
  }
  if (options.storeTaxId?.trim()) {
    builder.line(`เลขประจำตัวผู้เสียภาษี: ${options.storeTaxId.trim()}`);
  }
  if (options.storePhone?.trim()) {
    builder.line(`โทร: ${options.storePhone.trim()}`);
  }
  builder.line(`เลขที่: ${order.order_name}`);
  builder.line(`วันที่: ${formatDateTime(order.created_at)}`);

  // Divider
  builder.line(formatLine("-", width));

  // 3. Refund Notice
  if (isRefunded) {
    builder.bold(true).line("*** ยกเลิก / คืนเงินแล้ว ***").bold(false);
    if (order.refund_reason?.trim()) {
      builder.line(`เหตุผล: ${order.refund_reason.trim()}`);
    }
    builder.line(formatLine("-", width));
  }

  // 4. Item Table
  builder.align("left");
  const qtyWidth = Math.max(6, Math.floor(width * 0.2));
  const priceWidth = Math.max(8, Math.floor(width * 0.28));
  const nameWidth = width - qtyWidth - priceWidth;

  builder.bold(true).line(
    padRight("รายการ", nameWidth) +
    padLeft("จำนวน", qtyWidth) +
    padLeft("รวม(฿)", priceWidth)
  ).bold(false);

  for (const item of order.items) {
    const itemTotal = item.final_price !== undefined
      ? item.final_price
      : (item.subtotal ?? (item.item_price ?? 0) * item.quantity);
    const qtyStr = `x${item.quantity}`;
    const priceStr = Number(itemTotal).toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const itemDisplayName = item.item_name;
    if (getDisplayWidth(itemDisplayName) <= nameWidth) {
      builder.line(
        padRight(itemDisplayName, nameWidth) +
        padLeft(qtyStr, qtyWidth) +
        padLeft(priceStr, priceWidth)
      );
    } else {
      const wrapped = wrapDisplay(itemDisplayName, nameWidth);
      builder.line(
        padRight(wrapped[0], nameWidth) +
        padLeft(qtyStr, qtyWidth) +
        padLeft(priceStr, priceWidth)
      );
      for (let i = 1; i < wrapped.length; i++) {
        builder.line(padRight(wrapped[i], nameWidth));
      }
    }

    const itemDiscount = item.discount_amount ?? 0;
    if (itemDiscount > 0) {
      const discPercent = item.discount_type === "percentage" && item.discount_value
        ? ` (${item.discount_value}%)`
        : "";
      const discLabel = `  ↳ ส่วนลด${discPercent}:`;
      const discVal = `-${itemDiscount.toLocaleString()} ฿`;
      builder.line(formatTwoCols(discLabel, discVal, width));
    }
  }

  // 5. Divider
  builder.line(formatLine("-", width));

  // 6. Summary & Taxes
  if (order.subtotal !== undefined && order.subtotal !== order.order_price) {
    builder.line(formatTwoCols("ยอดรวมสินค้า", `${order.subtotal.toLocaleString()} ฿`, width));
  }

  const orderDiscount = order.discount_amount ?? 0;
  if (orderDiscount > 0) {
    const billPercent = order.discount_type === "percentage" && order.discount_value
      ? ` (${order.discount_value}%)`
      : "";
    builder.line(formatTwoCols(`ส่วนลดท้ายบิล${billPercent}`, `-${orderDiscount.toLocaleString()} ฿`, width));
  }

  builder.line(formatTwoCols("ยอดรวมก่อนภาษี", `${(order.order_price * 0.93).toFixed(2)} ฿`, width));
  builder.line(formatTwoCols("ภาษีมูลค่าเพิ่ม (7%)", `${(order.order_price * 0.07).toFixed(2)} ฿`, width));
  builder.bold(true).line(formatTwoCols("ยอดสุทธิ", `${order.order_price.toLocaleString()} ฿`, width)).bold(false);

  // 7. Payment Information
  builder.line(formatLine("-", width));
  builder.line(formatTwoCols("สถานะ", isRefunded ? "คืนเงินแล้ว" : "ชำระเงินสำเร็จ", width));
  builder.line(formatTwoCols("วิธีชำระ", isPromptPay ? "พร้อมเพย์ (PromptPay QR)" : "เงินสด", width));

  if (isPromptPay) {
    const qrTypeStr = order.promptpay_type === "static"
      ? "Static QR (ใส่ยอดเอง)"
      : "Dynamic QR (ยอดตรง)";
    builder.line(formatTwoCols("รูปแบบ QR", qrTypeStr, width));
    if (order.promptpay_ref) {
      builder.line(formatTwoCols("รหัสอ้างอิง QR", order.promptpay_ref, width));
    }
  }

  const paidAmount = order.amount_paid ?? order.order_price;
  builder.line(formatTwoCols(isPromptPay ? "ยอดโอนชำระ" : "รับเงินสด", `${paidAmount.toLocaleString()} ฿`, width));

  if (!isPromptPay) {
    const change = order.change_amount ?? 0;
    const isExact = change === 0 || paidAmount === order.order_price;
    const changeStr = isExact ? `${change.toLocaleString()} ฿ (ยอดพอดี)` : `${change.toLocaleString()} ฿`;
    builder.line(formatTwoCols("เงินทอน", changeStr, width));
  }

  // 8. Footer
  builder.line(formatLine("-", width));
  builder.align("center");
  builder.line(footerMessage);
  builder.line("StoreMate POS");

  // 9. Feed & Cut
  builder.feed(3);
  builder.cut();

  return builder.build();
}
