"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Storemate_Mascot from "../../public/storemate_mascot.png";
import ChartBarDefault from "../components/dashboard/chart-bar-default";
import { ChartLineLinear } from "../components/dashboard/chart-line-linear";
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend";
import TotalSaleCard from "../components/dashboard/total-sale-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardStats } from "@/lib/analytics";

interface DashboardViewProps {
  initialStats: DashboardStats;
}

export default function DashboardView({ initialStats }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            แดชบอร์ดภาพรวม
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            สรุปรายงานยอดขายและสถิติสินค้าแบบเรียลไทม์ของ StoreMate POS
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรชข้อมูล
        </Button>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalSaleCard
          amount={stats?.monthRevenue ?? stats?.totalRevenue ?? 0}
          loading={loading}
        />

        <Card className="w-full py-3.5 gap-2">
          <CardHeader className="flex flex-row items-center justify-between p-0 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ออเดอร์วันนี้
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0 px-4">
            {loading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
            ) : (
              <div className="text-4xl font-extrabold tracking-tight text-gray-900">
                {stats?.todayOrders ?? 0}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              ยอดขายวันนี้ ฿{(stats?.todayRevenue ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Link href="/items?filter=attention" className="block focus:outline-none">
          <Card className="w-full py-3.5 gap-2 hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between p-0 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                คลังสินค้า
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 px-4">
              {loading ? (
                <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
              ) : (
                <div className="text-4xl font-extrabold tracking-tight text-gray-900">
                  {stats?.totalProducts ?? 0}
                </div>
              )}
              <p className="mt-1 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  สต็อกวิกฤต {stats?.lowStockProducts ?? 0} รายการ
                </span>
                <span className="text-[10px] text-muted-foreground underline">ดูรายการ</span>
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Mascot Banner Card */}
        <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-amber-50 to-orange-50 py-0">
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-orange-200/50 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-amber-200/40 blur-xl" />
          <CardContent className="relative z-10 flex items-center justify-between p-4">
            <div className="z-10">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                <Sparkles className="h-4 w-4" />
                StoreMate
              </div>
              <p className="mt-1 text-xs font-medium text-orange-900">
                พร้อมให้บริการแคชเชียร์
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-medium text-orange-800 shadow-xs border border-orange-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                สถานะระบบ: ออนไลน์
              </span>
            </div>
            <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-white shadow-md ring-4 ring-orange-200/70 p-2.5 shrink-0 overflow-hidden group">
              <div className="relative h-full w-full">
                <Image
                  src={Storemate_Mascot}
                  alt="StoreMate mascot"
                  fill
                  className="object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ChartBarDefault data={stats?.salesBarChart} loading={loading} />
        </div>
        <div className="lg:col-span-3">
          <ChartPieLegend data={stats?.topItemsPieChart} loading={loading} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ChartLineLinear data={stats?.salesLineChart} loading={loading} />
      </div>
    </div>
  );
}

export { DashboardView };
