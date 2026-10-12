import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDisplayWidth,
  truncateDisplay,
  wrapDisplay,
  centerText,
  padRight,
  padLeft,
  formatTwoCols,
  formatTextReceipt,
  generateEscPosReceipt,
  ReceiptOrderInput,
} from "./receipt";

describe("Thai Display Width & Alignment Helpers", () => {
  it("getDisplayWidth: correctly counts Thai strings with combining vowels and tone marks", () => {
    // English ASCII: length === display width
    assert.equal(getDisplayWidth("StoreMate"), 9);

    // Thai with combining characters
    // "น้ำดื่ม": น (1) + ้ (0) + ำ (1) + ด (1) + ื (0) + ่ (0) + ม (1) = 4 columns
    assert.equal(getDisplayWidth("น้ำดื่ม"), 4);

    // "โค้ก": โ (1) + ค (1) + ้ (0) + ก (1) = 3 columns
    assert.equal(getDisplayWidth("โค้ก"), 3);

    // Standard string length would be 4 for "โค้ก" and 7 for "น้ำดื่ม"
    assert.notEqual("น้ำดื่ม".length, getDisplayWidth("น้ำดื่ม"));
    assert.equal("น้ำดื่ม".length, 7);
  });

  it("truncateDisplay: correctly truncates respecting combining marks", () => {
    const text = "น้ำดื่มขวดใหญ่";
    // First 4 display characters should yield "น้ำดื่ม"
    const truncated = truncateDisplay(text, 4);
    assert.equal(truncated, "น้ำดื่ม");
    assert.equal(getDisplayWidth(truncated), 4);
  });

  it("wrapDisplay: cleanly breaks long lines into chunks within max width", () => {
    const text = "โค้กกระป๋อง325มล";
    const chunks = wrapDisplay(text, 6);
    for (const chunk of chunks) {
      assert.ok(getDisplayWidth(chunk) <= 6);
    }
    assert.equal(chunks.join(""), text);
  });

  it("centerText: centers text within total width", () => {
    const centered = centerText("POS", 11);
    assert.equal(getDisplayWidth(centered), 11);
    assert.equal(centered, "    POS    ");
  });

  it("formatTwoCols: aligns left and right text to total width", () => {
    const row = formatTwoCols("ยอดสุทธิ", "100.00 ฿", 32);
    assert.equal(getDisplayWidth(row), 32);
    assert.ok(row.startsWith("ยอดสุทธิ"));
    assert.ok(row.endsWith("100.00 ฿"));
  });

  it("padRight and padLeft: correctly pad Thai and ASCII strings to target width", () => {
    const rightPadded = padRight("ชาเย็น", 10);
    assert.equal(getDisplayWidth(rightPadded), 10);
    assert.ok(rightPadded.startsWith("ชาเย็น"));

    const leftPadded = padLeft("50 ฿", 8);
    assert.equal(getDisplayWidth(leftPadded), 8);
    assert.ok(leftPadded.endsWith("50 ฿"));
  });
});

describe("Plain Text Receipt Formatting (formatTextReceipt)", () => {
  const sampleCashOrder: ReceiptOrderInput = {
    order_id: 101,
    order_name: "POS-000101",
    order_price: 150,
    subtotal: 150,
    payment_method: "cash",
    amount_paid: 200,
    change_amount: 50,
    status: "completed",
    created_at: "2026-10-12T14:30:00Z",
    items: [
      {
        item_id: 1,
        item_name: "ข้าวผัดกุ้ง",
        item_price: 60,
        quantity: 2,
        subtotal: 120,
        final_price: 120,
      },
      {
        item_id: 2,
        item_name: "โค้ก 325 มล.",
        item_price: 15,
        quantity: 2,
        subtotal: 30,
        final_price: 30,
      },
    ],
  };

  it("checks 32-col (58mm) and 42-col (80mm) output widths", () => {
    const receipt32 = formatTextReceipt(sampleCashOrder, { width: 32 });
    const receipt42 = formatTextReceipt(sampleCashOrder, { width: 42 });

    const lines32 = receipt32.split("\n").filter((l) => l.length > 0);
    const lines42 = receipt42.split("\n").filter((l) => l.length > 0);

    for (const line of lines32) {
      assert.ok(
        getDisplayWidth(line) <= 32,
        `Line exceeds 32 width (${getDisplayWidth(line)}): "${line}"`
      );
    }

    for (const line of lines42) {
      assert.ok(
        getDisplayWidth(line) <= 42,
        `Line exceeds 42 width (${getDisplayWidth(line)}): "${line}"`
      );
    }
  });

  it("accurately renders cash receipt with change and tender details", () => {
    const text = formatTextReceipt(sampleCashOrder, { width: 32 });

    assert.ok(text.includes("POS-000101"));
    assert.ok(text.includes("ข้าวผัดกุ้ง"));
    assert.ok(text.includes("โค้ก 325 มล."));
    assert.ok(text.includes("ยอดสุทธิ"));
    assert.ok(text.includes("150 ฿"));
    assert.ok(text.includes("เงินสด"));
    assert.ok(text.includes("รับเงินสด"));
    assert.ok(text.includes("200 ฿"));
    assert.ok(text.includes("เงินทอน"));
    assert.ok(text.includes("50 ฿"));
    assert.ok(text.includes("ภาษีมูลค่าเพิ่ม (7%)"));
    assert.ok(text.includes("ขอบคุณที่ใช้บริการ"));
  });

  it("accurately renders exact payment cash badge", () => {
    const exactOrder: ReceiptOrderInput = {
      ...sampleCashOrder,
      amount_paid: 150,
      change_amount: 0,
    };
    const text = formatTextReceipt(exactOrder, { width: 32 });
    assert.ok(text.includes("(ยอดพอดี)"));
  });

  it("accurately renders PromptPay receipt with reference number", () => {
    const promptPayOrder: ReceiptOrderInput = {
      order_id: 102,
      order_name: "POS-000102",
      order_price: 320,
      subtotal: 320,
      payment_method: "promptpay",
      promptpay_type: "dynamic",
      promptpay_ref: "REF-20261012-9988",
      amount_paid: 320,
      change_amount: 0,
      status: "completed",
      created_at: "2026-10-12T15:00:00Z",
      items: [
        {
          item_id: 3,
          item_name: "ชุดหมูกระทะ",
          item_price: 320,
          quantity: 1,
          subtotal: 320,
          final_price: 320,
        },
      ],
    };

    const text = formatTextReceipt(promptPayOrder, { width: 32 });
    assert.ok(text.includes("พร้อมเพย์ (PromptPay QR)"));
    assert.ok(text.includes("Dynamic QR (ยอดตรง)"));
    assert.ok(text.includes("REF-20261012-9988"));
    assert.ok(text.includes("ยอดโอนชำระ"));
  });

  it("accurately renders discounts (item discount and order discount)", () => {
    const discountedOrder: ReceiptOrderInput = {
      order_id: 103,
      order_name: "POS-000103",
      order_price: 180,
      subtotal: 200,
      discount_type: "fixed",
      discount_value: 20,
      discount_amount: 20,
      payment_method: "cash",
      amount_paid: 200,
      change_amount: 20,
      status: "completed",
      created_at: "2026-10-12T15:15:00Z",
      items: [
        {
          item_id: 4,
          item_name: "เสื้อยืดคอกลม",
          item_price: 120,
          quantity: 2,
          subtotal: 240,
          discount_type: "percentage",
          discount_value: 10,
          discount_amount: 24,
          final_price: 216,
        },
      ],
    };

    const text = formatTextReceipt(discountedOrder, { width: 32 });
    // Item discount check
    assert.ok(text.includes("↳ ส่วนลด"));
    assert.ok(text.includes("-24 ฿"));
    // Order discount check
    assert.ok(text.includes("ส่วนลดท้ายบิล"));
    assert.ok(text.includes("-20 ฿"));
  });

  it("renders refunded banner when status is 'refunded'", () => {
    const refundedOrder: ReceiptOrderInput = {
      ...sampleCashOrder,
      status: "refunded",
      refund_reason: "ลูกค้าเปลี่ยนใจ",
    };

    const text = formatTextReceipt(refundedOrder, { width: 32 });
    assert.ok(text.includes("*** ยกเลิก / คืนเงินแล้ว ***"));
    assert.ok(text.includes("เหตุผล: ลูกค้าเปลี่ยนใจ"));
    assert.ok(text.includes("คืนเงินแล้ว"));
  });
});

describe("ESC/POS Command Generation (generateEscPosReceipt)", () => {
  const sampleOrder: ReceiptOrderInput = {
    order_id: 201,
    order_name: "POS-000201",
    order_price: 85,
    subtotal: 85,
    payment_method: "cash",
    amount_paid: 100,
    change_amount: 15,
    status: "completed",
    created_at: "2026-10-12T16:00:00Z",
    items: [
      {
        item_id: 5,
        item_name: "ชานมไข่มุก",
        item_price: 85,
        quantity: 1,
        subtotal: 85,
        final_price: 85,
      },
    ],
  };

  it("returns valid Uint8Array buffer", () => {
    const escpos = generateEscPosReceipt(sampleOrder);
    assert.ok(escpos instanceof Uint8Array);
    assert.ok(escpos.length > 50);
  });

  it("starts with ESC @ printer initialization sequence ([0x1B, 0x40])", () => {
    const escpos = generateEscPosReceipt(sampleOrder);
    assert.equal(escpos[0], 0x1B);
    assert.equal(escpos[1], 0x40);
  });

  it("contains alignment commands and ends with paper cut sequence ([0x1D, 0x56, 0x42, 0x00])", () => {
    const escpos = generateEscPosReceipt(sampleOrder);

    // Verify alignment command (ESC a n: 0x1B 0x61) exists in the buffer
    let hasAlignCommand = false;
    for (let i = 0; i < escpos.length - 2; i++) {
      if (escpos[i] === 0x1B && escpos[i + 1] === 0x61) {
        hasAlignCommand = true;
        break;
      }
    }
    assert.ok(hasAlignCommand, "Buffer should contain ESC a alignment command");

    // Ends with paper cut sequence: [0x1D, 0x56, 0x42, 0x00]
    const len = escpos.length;
    assert.equal(escpos[len - 4], 0x1D);
    assert.equal(escpos[len - 3], 0x56);
    assert.equal(escpos[len - 2], 0x42);
    assert.equal(escpos[len - 1], 0x00);
  });
});
