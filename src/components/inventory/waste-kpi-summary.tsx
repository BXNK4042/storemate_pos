"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileSpreadsheet,
  PackageX,
  Banknote,
  AlertCircle,
} from "lucide-react";
import type { WasteSummaryMetrics, WasteReason } from "@/types/waste";
import { WASTE_REASON_CONFIG } from "./waste-reason-badge";

interface WasteKpiSummaryProps {
  metrics: WasteSummaryMetrics;
}

export function WasteKpiSummary({ metrics }: WasteKpiSummaryProps) {
  const primaryReasonInfo = useMemo(() => {
    let topReason: WasteReason = "damaged";
    let maxVal = -1;

    const reasons = Object.keys(metrics.byReason) as WasteReason[];
    for (const r of reasons) {
      const data = metrics.byReason[r];
      const val = data?.lossAmount || 0;
      if (val > maxVal) {
        maxVal = val;
        topReason = r;
      }
    }

    if (maxVal <= 0) {
      // Fallback by quantity
      for (const r of reasons) {
        const data = metrics.byReason[r];
        const qty = data?.quantity || 0;
        if (qty > maxVal) {
          maxVal = qty;
          topReason = r;
        }
      }
    }

    const config = WASTE_REASON_CONFIG[topReason] || WASTE_REASON_CONFIG.other;
    const topData = metrics.byReason[topReason];
    const percentage =
      metrics.totalLossAmount > 0
        ? Math.round(((topData?.lossAmount || 0) / metrics.totalLossAmount) * 100)
        : metrics.totalQuantity > 0
        ? Math.round(((topData?.quantity || 0) / metrics.totalQuantity) * 100)
        : 0;

    return {
      label: config.label,
      percentage,
      amount: topData?.lossAmount || 0,
      quantity: topData?.quantity || 0,
      hasData: maxVal > 0,
    };
  }, [metrics]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Incidents */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">จำนวนครั้งที่บันทึก</p>
            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mt-1 font-mono">
              {metrics.totalIncidents.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">การลงบันทึกสินค้าสูญเสีย</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Total Units Lost */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">จำนวนสินค้าที่สูญเสีย</p>
            <h3 className="text-2xl font-bold tracking-tight text-amber-600 mt-1 font-mono">
              {metrics.totalQuantity.toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">ชิ้น</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">ยอดรวมของเสียทุกประเภท</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <PackageX className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Total Loss Value */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">มูลค่าความเสียหายรวม</p>
            <h3 className="text-2xl font-bold tracking-tight text-rose-600 mt-1 font-mono">
              ฿{metrics.totalLossAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">คำนวณจากต้นทุนต่อชิ้น</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Primary Reason */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-medium text-muted-foreground">สาเหตุหลัก</p>
            <h3 className="text-lg font-bold tracking-tight text-purple-700 mt-1 truncate">
              {primaryReasonInfo.hasData ? primaryReasonInfo.label : "-"}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {primaryReasonInfo.hasData
                ? `${primaryReasonInfo.percentage}% ของมูลค่าความเสียหาย`
                : "ยังไม่มีข้อมูลบันทึก"}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
