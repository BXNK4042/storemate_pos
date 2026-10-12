import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "./db";
import {
  calculateDenominations,
  calculateCashPayment,
  getSmartCashSuggestions,
  isHugeOverpayment,
  sanitizeCashInput,
} from "./cash";
import {
  InsufficientCashError,
  InvalidCashAmountError,
  createOrder,
} from "./orders";

describe("Cash Engine & Denominations", () => {
  it("should return empty array for 0 or negative change", () => {
    assert.deepEqual(calculateDenominations(0), []);
    assert.deepEqual(calculateDenominations(-50), []);
  });

  it("should calculate correct breakdown for standard bill & coin combinations", () => {
    // 385 THB: 100x3 + 50x1 + 20x1 + 10x1 + 5x1
    const breakdown = calculateDenominations(385);
    const summary = breakdown.map((b) => `${b.value}x${b.count}`);
    assert.deepEqual(summary, ["100x3", "50x1", "20x1", "10x1", "5x1"]);
    const sum = breakdown.reduce((acc, curr) => acc + curr.total, 0);
    assert.equal(sum, 385);
  });

  it("should correctly dispense 1000 and 500 baht bills", () => {
    // 1650 THB: 1000x1 + 500x1 + 100x1 + 50x1
    const breakdown = calculateDenominations(1650);
    assert.equal(breakdown[0].value, 1000);
    assert.equal(breakdown[0].count, 1);
    assert.equal(breakdown[1].value, 500);
    assert.equal(breakdown[1].count, 1);
    assert.equal(breakdown[2].value, 100);
    assert.equal(breakdown[2].count, 1);
    assert.equal(breakdown[3].value, 50);
    assert.equal(breakdown[3].count, 1);
  });

  it("should handle floating-point satang amounts without rounding artifacts", () => {
    // Change of 28.75 THB: 20x1 + 5x1 + 2x1 + 1x1 + 0.5x1 + 0.25x1
    const breakdown = calculateDenominations(28.75);
    const total = breakdown.reduce((acc, b) => acc + b.total, 0);
    assert.equal(total, 28.75);

    const satang50 = breakdown.find((b) => b.value === 0.5);
    const satang25 = breakdown.find((b) => b.value === 0.25);
    assert.equal(satang50?.count, 1);
    assert.equal(satang25?.count, 1);
  });

  it("should handle floating-point subtraction accurately (e.g. 99.90 - 70 = 29.90)", () => {
    const result = calculateCashPayment(70, 99.9);
    assert.equal(result.change, 29.9);
    assert.equal(result.isExact, false);
    assert.equal(result.isInsufficient, false);
    assert.equal(result.shortfall, 0);

    const breakdownTotal = result.denominations.reduce((acc, b) => acc + b.total, 0);
    // 29.90 has 20 + 5 + 2 + 2 + 0.5 + 0.25 = 29.75 (0.15 remainder cannot be fully represented by satang <= 0.25)
    assert.ok(breakdownTotal <= 29.9);
  });

  it("should accurately detect exact payment", () => {
    const result = calculateCashPayment(150, 150);
    assert.equal(result.isExact, true);
    assert.equal(result.isInsufficient, false);
    assert.equal(result.change, 0);
    assert.equal(result.shortfall, 0);
    assert.equal(result.denominations.length, 0);
  });

  it("should accurately detect insufficient payment and shortfall", () => {
    const result = calculateCashPayment(250, 200);
    assert.equal(result.isExact, false);
    assert.equal(result.isInsufficient, true);
    assert.equal(result.shortfall, 50);
    assert.equal(result.change, 0);
    assert.equal(result.denominations.length, 0);
  });
});

describe("Smart Tender Presets", () => {
  it("should handle 0 total amount", () => {
    assert.deepEqual(getSmartCashSuggestions(0), [0]);
  });

  it("should suggest exact and higher denominations for 145 THB", () => {
    const suggestions = getSmartCashSuggestions(145);
    assert.equal(suggestions[0], 145);
    assert.ok(suggestions.includes(150));
    assert.ok(suggestions.includes(200));
    assert.ok(suggestions.includes(500));
    // All presets must be >= totalAmount
    for (const val of suggestions) {
      assert.ok(val >= 145);
    }
  });

  it("should suggest higher round tiers for amounts exceeding 1,000 THB (e.g. 1350)", () => {
    const suggestions = getSmartCashSuggestions(1350);
    assert.equal(suggestions[0], 1350);
    assert.ok(suggestions.includes(1400));
    assert.ok(suggestions.includes(1500));
    assert.ok(suggestions.includes(2000));
    for (const val of suggestions) {
      assert.ok(val >= 1350);
    }
  });

  it("should handle small amounts under 50 THB", () => {
    const suggestions = getSmartCashSuggestions(35);
    assert.equal(suggestions[0], 35);
    assert.ok(suggestions.includes(40));
    assert.ok(suggestions.includes(50));
    assert.ok(suggestions.includes(100));
  });
});

describe("Cashier Safety & Sanitization", () => {
  it("should detect huge overpayment (>= 10x total)", () => {
    assert.equal(isHugeOverpayment(100, 1000), true);
    assert.equal(isHugeOverpayment(100, 10000), true);
    assert.equal(isHugeOverpayment(100, 500), false);
    assert.equal(isHugeOverpayment(0, 1000), false);
  });

  it("should sanitize cash input strings correctly", () => {
    assert.equal(sanitizeCashInput("1,000"), 1000);
    assert.equal(sanitizeCashInput(" 500.50 "), 500.5);
    assert.equal(sanitizeCashInput("-50"), 50);
    assert.equal(sanitizeCashInput("abc"), 0);
    assert.equal(sanitizeCashInput(250), 250);
    assert.equal(sanitizeCashInput(-10), 0);
  });
});

describe("Order Backend Cash Validation", () => {
  beforeEach(() => {
    try {
      getDb().prepare("UPDATE items SET item_amount = 50 WHERE item_id = 2").run();
    } catch {
      // ignore
    }
  });

  it("should throw InsufficientCashError when cash received is less than total price", () => {
    assert.throws(
      () => {
        createOrder(
          [{ item_id: 2, item_name: "โค้ก 325 มล.", item_price: 15, quantity: 1 }],
          { payment_method: "cash", amount_paid: 10 }
        );
      },
      (err: unknown) => {
        return err instanceof InsufficientCashError && err.code === "INSUFFICIENT_CASH";
      }
    );
  });

  it("should throw InvalidCashAmountError when cash received is negative or unreasonably huge", () => {
    assert.throws(
      () => {
        createOrder(
          [{ item_id: 2, item_name: "โค้ก 325 มล.", item_price: 15, quantity: 1 }],
          { payment_method: "cash", amount_paid: -50 }
        );
      },
      (err: unknown) => {
        return err instanceof InvalidCashAmountError && err.code === "INVALID_CASH_AMOUNT";
      }
    );

    assert.throws(
      () => {
        createOrder(
          [{ item_id: 2, item_name: "โค้ก 325 มล.", item_price: 15, quantity: 1 }],
          { payment_method: "cash", amount_paid: 99_999_999 }
        );
      },
      (err: unknown) => {
        return err instanceof InvalidCashAmountError && err.code === "INVALID_CASH_AMOUNT";
      }
    );
  });

  it("should accurately calculate change_amount for valid cash orders", () => {
    const order = createOrder(
      [{ item_id: 2, item_name: "โค้ก 325 มล.", item_price: 15, quantity: 1 }],
      { payment_method: "cash", amount_paid: 100 }
    );
    assert.equal(order.order_price, 15);
    assert.equal(order.amount_paid, 100);
    assert.equal(order.change_amount, 85);
  });
});
