"use client";

import React from "react";
import type { StockAdjustmentReason } from "@/types/stock";
import {
  PackagePlus,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  AlertOctagon,
  FileEdit,
  ShoppingCart,
  RotateCcw,
  Sparkles,
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

export const STOCK_REASON_CONFIG: Record<StockAdjustmentReason, ReasonConfig> = {
  restock: {
    label: "รับสินค้าเข้าคลัง",
    icon: PackagePlus,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    defaultMode: "add",
  },
  damage: {
    label: "สินค้าชำรุด / เสียหาย",
    icon: AlertTriangle,
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
    defaultMode: "remove",
  },
  expired: {
    label: "สินค้าหมดอายุ (ตัดทิ้ง)",
    icon: Clock,
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    dotClass: "bg-orange-500",
    defaultMode: "remove",
  },
  inventory_count: {
    label: "ปรับยอดจากการตรวจนับ",
    icon: ClipboardCheck,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    defaultMode: "set",
  },
  loss: {
    label: "สินค้าสูญหาย / ถูกขโมย",
    icon: AlertOctagon,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-500",
    defaultMode: "remove",
  },
  correction: {
    label: "แก้ไขข้อมูลสต็อก",
    icon: FileEdit,
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    dotClass: "bg-purple-500",
    defaultMode: "set",
  },
  sale: {
    label: "ขายสินค้า (POS)",
    icon: ShoppingCart,
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dotClass: "bg-cyan-500",
    defaultMode: "remove",
  },
  refund: {
    label: "คืนสินค้า / ยกเลิกบิล",
    icon: RotateCcw,
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    dotClass: "bg-teal-500",
    defaultMode: "add",
  },
  initial: {
    label: "สต็อกเริ่มต้นสินค้า",
    icon: Sparkles,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    dotClass: "bg-slate-500",
    defaultMode: "add",
  },
  other: {
    label: "อื่นๆ",
    icon: HelpCircle,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    dotClass: "bg-gray-400",
    defaultMode: "set",
  },
};

export function StockReasonBadge({
  reason,
  showIcon = true,
  className = "",
}: {
  reason: StockAdjustmentReason | string;
  showIcon?: boolean;
  className?: string;
}) {
  const config =
    STOCK_REASON_CONFIG[reason as StockAdjustmentReason] || STOCK_REASON_CONFIG.other;
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
