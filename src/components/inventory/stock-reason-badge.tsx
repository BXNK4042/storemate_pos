"use client";

import React from "react";
import type { StockAdjustmentReason } from "@/types/stock";
import {
  PackagePlus,
  AlertTriangle,
  ClipboardCheck,
  HelpCircle,
  LucideIcon,
} from "lucide-react";

export interface ReasonConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  defaultMode: "add" | "remove" | "set";
}

export type PrimaryStockReason = "restock" | "damage" | "inventory_count";

export const STOCK_REASON_CONFIG: Record<PrimaryStockReason, ReasonConfig> &
  Record<string, ReasonConfig | undefined> = {
  restock: {
    label: "รับเข้าสินค้า",
    icon: PackagePlus,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    defaultMode: "add",
  },
  damage: {
    label: "สินค้าเสียหาย / ตัดสต็อก",
    icon: AlertTriangle,
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
    defaultMode: "remove",
  },
  inventory_count: {
    label: "ตรวจนับ / ปรับยอด",
    icon: ClipboardCheck,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    defaultMode: "set",
  },
};

export const LEGACY_REASON_MAP: Record<string, PrimaryStockReason> = {
  expired: "damage",
  loss: "damage",
  sale: "damage",
  correction: "inventory_count",
  other: "inventory_count",
  refund: "restock",
  initial: "restock",
};

export const FALLBACK_REASON_CONFIG: ReasonConfig = {
  label: "อื่นๆ",
  icon: HelpCircle,
  badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
  dotClass: "bg-gray-400",
  defaultMode: "set",
};

export function getStockReasonLabel(reason: StockAdjustmentReason | string): string {
  if (reason in STOCK_REASON_CONFIG && STOCK_REASON_CONFIG[reason]) {
    return STOCK_REASON_CONFIG[reason]!.label;
  }
  const mapped = LEGACY_REASON_MAP[reason];
  if (mapped && STOCK_REASON_CONFIG[mapped]) {
    return STOCK_REASON_CONFIG[mapped]!.label;
  }
  return reason || "อื่นๆ";
}

export function StockReasonBadge({
  reason,
  showIcon = true,
  className = "",
}: {
  reason: StockAdjustmentReason | string;
  showIcon?: boolean;
  className?: string;
}) {
  const mappedReason = (
    reason && reason in STOCK_REASON_CONFIG
      ? reason
      : reason ? LEGACY_REASON_MAP[reason] : undefined
  ) as PrimaryStockReason | undefined;

  const config =
    (mappedReason && STOCK_REASON_CONFIG[mappedReason]) || FALLBACK_REASON_CONFIG;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.badgeClass} ${className}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}
