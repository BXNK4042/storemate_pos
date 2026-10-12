"use client";

import React from "react";
import { AlertTriangle, AlertCircle, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StockAlertBannerProps {
  outOfStockCount: number;
  lowStockCount: number;
  onFilterClick?: () => void;
  onOpenSettings?: () => void;
  isFiltered?: boolean;
  className?: string;
}

export function StockAlertBanner({
  outOfStockCount,
  lowStockCount,
  onFilterClick,
  onOpenSettings,
  isFiltered = false,
  className = "",
}: StockAlertBannerProps) {
  const attentionCount = outOfStockCount + lowStockCount;
  if (attentionCount === 0) return null;

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 shadow-xs ${className}`}
    >
      <div className="flex items-start md:items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5 md:mt-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-amber-950">
              การแจ้งเตือนระดับสต็อกสินค้า (ต้องตรวจสอบ {attentionCount} รายการ)
            </h4>
          </div>
          <p className="text-xs text-amber-800 flex flex-wrap items-center gap-1.5">
            {outOfStockCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                <AlertCircle className="h-3 w-3" />
                สินค้าหมด {outOfStockCount} รายการ
              </span>
            )}
            {outOfStockCount > 0 && lowStockCount > 0 && (
              <span className="text-amber-500 font-bold">•</span>
            )}
            {lowStockCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-300">
                <AlertTriangle className="h-3 w-3" />
                สต็อกใกล้หมด {lowStockCount} รายการ
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-start md:self-auto pt-1 md:pt-0">
        {onOpenSettings && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="h-8 text-xs gap-1.5 border-amber-300 bg-white/80 hover:bg-white text-amber-900 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-700" />
            <span>ตั้งค่าเกณฑ์สต็อก</span>
          </Button>
        )}
        {onFilterClick && (
          <Button
            size="sm"
            onClick={onFilterClick}
            className="h-8 text-xs gap-1.5 bg-amber-700 hover:bg-amber-800 text-white cursor-pointer shadow-xs"
          >
            <span>{isFiltered ? "แสดงสินค้าทั้งหมด" : "ดูสินค้าสต็อกวิกฤต"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
