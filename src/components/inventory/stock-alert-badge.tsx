"use client";

import React from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { getEffectiveThreshold, evaluateStockStatus } from "@/lib/stock-alerts-eval";

export interface StockAlertBadgeProps {
  amount: number;
  threshold?: number | null;
  defaultThreshold?: number;
  showThresholdHint?: boolean;
  className?: string;
}

export function StockAlertBadge({
  amount,
  threshold,
  defaultThreshold = 5,
  showThresholdHint = false,
  className = "",
}: StockAlertBadgeProps) {
  const isCustomThreshold =
    threshold !== null &&
    threshold !== undefined &&
    typeof threshold === "number" &&
    threshold > 0;
  const effective = getEffectiveThreshold(threshold, defaultThreshold);
  const alertInfo = evaluateStockStatus(amount, effective, isCustomThreshold);

  if (alertInfo.status === "out_of_stock") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>หมด (0)</span>
      </span>
    );
  }

  if (alertInfo.status === "low_stock") {
    return (
      <div className={`inline-flex flex-col items-end gap-0.5 ${className}`}>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>สต็อกใกล้หมด ({amount})</span>
        </span>
        {showThresholdHint && (
          <span className="text-[10px] text-amber-700/80 font-mono">
            {isCustomThreshold ? `เกณฑ์เฉพาะ: ${effective}` : `เกณฑ์ร้าน: ${effective}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
    >
      <span>{amount} ชิ้น</span>
    </span>
  );
}
