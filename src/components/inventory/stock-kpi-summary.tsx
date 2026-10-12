"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  PackageCheck,
} from "lucide-react";

interface StockKpiSummaryProps {
  metrics: {
    totalIn: number;
    totalOut: number;
    netChange: number;
    recordCount: number;
  };
}

export function StockKpiSummary({ metrics }: StockKpiSummaryProps) {
  const isNetPositive = metrics.netChange >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Adjustment Transactions */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">รายการบันทึกทั้งหมด</p>
            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mt-1 font-mono">
              {metrics.recordCount.toLocaleString()}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">บันทึกการปรับยอดสต็อก</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Total Inflow (Units Added) */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">รับเข้าสต็อกทั้งหมด</p>
            <h3 className="text-2xl font-bold tracking-tight text-emerald-600 mt-1 font-mono">
              +{metrics.totalIn.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ชิ้น</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">ยอดรับเข้า / คืนสินค้า / สต็อกแรกเริ่ม</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Total Outflow (Units Deducted) */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">ตัดสต็อก / ขายออก</p>
            <h3 className="text-2xl font-bold tracking-tight text-rose-600 mt-1 font-mono">
              -{metrics.totalOut.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ชิ้น</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">ยอดขาย / ชำรุด / หมดอายุ / สูญหาย</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Net Delta */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">ยอดการเปลี่ยนแปลงสุทธิ</p>
            <h3
              className={`text-2xl font-bold tracking-tight mt-1 font-mono ${
                isNetPositive ? "text-indigo-600" : "text-amber-600"
              }`}
            >
              {isNetPositive ? `+${metrics.netChange.toLocaleString()}` : metrics.netChange.toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">ชิ้น</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">ส่วนต่างสต็อกรวมทั้งหมด</p>
          </div>
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              isNetPositive
                ? "bg-indigo-50 text-indigo-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <PackageCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
