export type ThaiDenominationType = "banknote" | "coin";

export interface ThaiDenomination {
  value: number;
  label: string;
  type: ThaiDenominationType;
}

export interface DenominationBreakdown {
  value: number;
  label: string;
  type: ThaiDenominationType;
  count: number;
  total: number;
}

export interface CashCalculationResult {
  totalAmount: number;
  cashReceived: number;
  change: number;
  isExact: boolean;
  isInsufficient: boolean;
  shortfall: number;
  denominations: DenominationBreakdown[];
}

export interface SmartCashOptions {
  exact: number;
  presets: number[];
}

export const THAI_DENOMINATIONS: readonly ThaiDenomination[] = [
  { value: 1000, label: "ธนบัตร 1,000฿", type: "banknote" },
  { value: 500, label: "ธนบัตร 500฿", type: "banknote" },
  { value: 100, label: "ธนบัตร 100฿", type: "banknote" },
  { value: 50, label: "ธนบัตร 50฿", type: "banknote" },
  { value: 20, label: "ธนบัตร 20฿", type: "banknote" },
  { value: 10, label: "เหรียญ 10฿", type: "coin" },
  { value: 5, label: "เหรียญ 5฿", type: "coin" },
  { value: 2, label: "เหรียญ 2฿", type: "coin" },
  { value: 1, label: "เหรียญ 1฿", type: "coin" },
  { value: 0.5, label: "เหรียญ 50 สตางค์", type: "coin" },
  { value: 0.25, label: "เหรียญ 25 สตางค์", type: "coin" },
] as const;

export const ADDITIVE_BILLS = [20, 50, 100, 500, 1000] as const;

/**
 * Greedily calculate optimal breakdown of Thai banknotes and coins for change.
 * Scales to integer satang to avoid floating point inaccuracies.
 */
export function calculateDenominations(changeAmount: number): DenominationBreakdown[] {
  if (changeAmount <= 0) return [];

  let remainingInSatang = Math.round(changeAmount * 100);
  const result: DenominationBreakdown[] = [];

  for (const denom of THAI_DENOMINATIONS) {
    const denomInSatang = Math.round(denom.value * 100);
    if (remainingInSatang >= denomInSatang) {
      const count = Math.floor(remainingInSatang / denomInSatang);
      remainingInSatang %= denomInSatang;
      result.push({
        value: denom.value,
        label: denom.label,
        type: denom.type,
        count,
        total: Math.round(count * denomInSatang) / 100,
      });
    }
  }

  return result;
}

/**
 * Pure calculation for cash payment, shortfall, change, and denomination breakdown.
 */
export function calculateCashPayment(
  totalAmount: number,
  cashReceived: number
): CashCalculationResult {
  const totalSatang = Math.max(0, Math.round(totalAmount * 100));
  const receivedSatang = Math.max(0, Math.round(cashReceived * 100));

  const isExact = totalSatang === receivedSatang;
  const isInsufficient = receivedSatang < totalSatang;
  const changeSatang = !isInsufficient ? receivedSatang - totalSatang : 0;
  const shortfallSatang = isInsufficient ? totalSatang - receivedSatang : 0;

  const change = Math.round(changeSatang) / 100;
  const shortfall = Math.round(shortfallSatang) / 100;
  const denominations = calculateDenominations(change);

  return {
    totalAmount: totalSatang / 100,
    cashReceived: receivedSatang / 100,
    change,
    isExact,
    isInsufficient,
    shortfall,
    denominations,
  };
}

/**
 * Helper to compute the strictly next multiple of a step above amount.
 */
function nextStepAbove(amount: number, step: number): number {
  const rem = amount % step;
  if (rem === 0) {
    return amount + step;
  }
  return Math.ceil(amount / step) * step;
}

/**
 * Generates smart cash payment shortcut suggestions for cashiers.
 * Always includes the exact amount, followed by reasonable tender amounts.
 */
export function getSmartCashSuggestions(totalAmount: number): number[] {
  if (totalAmount <= 0) {
    return [0];
  }

  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const suggestionsSet = new Set<number>();
  suggestionsSet.add(roundedTotal);

  if (roundedTotal < 50) {
    // Under 50: suggest next 20, 50, 100, 500
    if (roundedTotal < 20) suggestionsSet.add(20);
    suggestionsSet.add(nextStepAbove(roundedTotal, 20));
    suggestionsSet.add(50);
    suggestionsSet.add(100);
    suggestionsSet.add(500);
  } else if (roundedTotal < 100) {
    // 50 to 99: next 50 (if applicable), next 100, 500, 1000
    suggestionsSet.add(nextStepAbove(roundedTotal, 50));
    suggestionsSet.add(100);
    suggestionsSet.add(500);
    suggestionsSet.add(1000);
  } else if (roundedTotal < 500) {
    // 100 to 499: next 50, next 100, 500, 1000
    const next50 = nextStepAbove(roundedTotal, 50);
    if (next50 < 500) suggestionsSet.add(next50);
    const next100 = nextStepAbove(roundedTotal, 100);
    if (next100 <= 500) suggestionsSet.add(next100);
    suggestionsSet.add(500);
    suggestionsSet.add(1000);
  } else if (roundedTotal < 1000) {
    // 500 to 999: next 100, next 500 (1000), 1000, 1500
    suggestionsSet.add(nextStepAbove(roundedTotal, 100));
    suggestionsSet.add(1000);
    suggestionsSet.add(1500);
  } else {
    // 1000+: next 100, next 500, next 1000
    suggestionsSet.add(nextStepAbove(roundedTotal, 100));
    suggestionsSet.add(nextStepAbove(roundedTotal, 500));
    suggestionsSet.add(nextStepAbove(roundedTotal, 1000));
  }

  // Filter out any candidates <= roundedTotal and sort ascending
  const sortedOthers = Array.from(suggestionsSet)
    .filter((amt) => amt > roundedTotal)
    .sort((a, b) => a - b);

  // Return exact plus up to 4 other practical presets (total up to 5)
  return [roundedTotal, ...sortedOthers.slice(0, 4)];
}

/**
 * Returns exact amount and preset suggestions.
 */
export function getSmartCashOptions(totalAmount: number): SmartCashOptions {
  const suggestions = getSmartCashSuggestions(totalAmount);
  return {
    exact: Math.max(0, Math.round(totalAmount * 100) / 100),
    presets: suggestions.filter((s) => s > totalAmount),
  };
}

/**
 * Checks whether the cash received is unnaturally large (> 10x order total),
 * which may indicate a cashier typo (e.g. typing 100000 instead of 1000).
 */
export function isHugeOverpayment(totalAmount: number, cashReceived: number): boolean {
  if (totalAmount <= 0) return false;
  return cashReceived >= totalAmount * 10;
}

/**
 * Sanitize cash input string or number to a safe non-negative float with 2 decimal places.
 */
export function sanitizeCashInput(input: string | number): number {
  if (typeof input === "number") {
    if (isNaN(input) || input < 0) return 0;
    return Math.round(input * 100) / 100;
  }

  const cleaned = input.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}
