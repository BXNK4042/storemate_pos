"use client";

import React from "react";
import type { WasteReason } from "@/types/waste";
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  Trash2,
  HelpCircle,
  LucideIcon,
} from "lucide-react";

export interface WasteReasonConfig {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
}

export const WASTE_REASON_CONFIG: Record<WasteReason, WasteReasonConfig> = {
  damaged: {
    label: "ชำรุด / แตกหัก",
    icon: AlertTriangle,
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
  spoiled: {
    label: "เน่าเสีย / บูด",
    icon: AlertOctagon,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  expired: {
    label: "หมดอายุ",
    icon: Clock,
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    dotClass: "bg-purple-500",
  },
  discarded: {
    label: "คัดทิ้ง / เสียรูป",
    icon: Trash2,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    dotClass: "bg-slate-500",
  },
  other: {
    label: "อื่นๆ",
    icon: HelpCircle,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    dotClass: "bg-gray-400",
  },
};

export function WasteReasonBadge({
  reason,
  showIcon = true,
  className = "",
}: {
  reason: WasteReason | string;
  showIcon?: boolean;
  className?: string;
}) {
  const config =
    WASTE_REASON_CONFIG[reason as WasteReason] || WASTE_REASON_CONFIG.other;
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
