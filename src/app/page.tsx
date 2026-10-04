"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Storemate_Mascot from "../../public/storemate_mascot.png";
import ChartBarDefault from "../components/dashboard/chart-bar-default";
import { ChartLineLinear } from "../components/dashboard/chart-line-linear";
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend";
import TotalSaleCard from "../components/dashboard/total-sale-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, AlertTriangle, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  salesBarChart: { label: string; sales: number; orders: number }[];
  salesLineChart: { label: string; sales: number }[];
  topItemsPieChart: { name: string; value: number; fill: string }[];
}

export default function Home() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchStats();
  }, []);

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

        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ออเดอร์วันนี้
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
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

        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              คลังสินค้า
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
            ) : (
              <div className="text-4xl font-extrabold tracking-tight text-gray-900">
                {stats?.totalProducts ?? 0}
              </div>
            )}
            <p className="mt-1 text-xs flex items-center gap-1 text-amber-600 font-medium">
              <AlertTriangle className="h-3 w-3" />
              ใกล้หมด {stats?.lowStockProducts ?? 0} รายการ
            </p>
          </CardContent>
        </Card>

        {/* Mascot Banner Card */}
        <Card className="relative overflow-hidden border-orange-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="z-10">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                <Sparkles className="h-4 w-4" />
                StoreMate
              </div>
              <p className="mt-1 text-xs font-medium text-orange-900">
                พร้อมให้บริการแคชเชียร์
              </p>
              <span className="mt-2 inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-medium text-orange-800">
                สถานะระบบ: ออนไลน์
              </span>
            </div>
            <div className="relative -my-3 -mr-2 h-24 w-24 shrink-0">
              <Image
                src={Storemate_Mascot}
                alt="StoreMate mascot"
                fill
                className="object-contain"
                priority
              />
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
