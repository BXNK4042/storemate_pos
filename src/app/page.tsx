"use client"

import { useState, useEffect } from "react"
import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartLineLinear } from "../components/dashboard/chart-line-linear"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"
import ProfitCard from "../components/dashboard/profit-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingBag, TrendingUp } from "lucide-react"

interface AnalyticsData {
  topProducts: Array<{ item_name: string; total_quantity: number }>
  dailySales: Array<{ day: string; sale: number }>
  hourlyTraffic: Array<{ time: string; customer: number }>
  totalOrders: number
  totalRevenue: number
  avgOrderValue: number
}

export default function Home() {
  const [stats, setStats] = useState({ totalSales: 0, totalProfit: 0 })
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.totalSales !== undefined) {
          setStats({ totalSales: data.totalSales, totalProfit: data.totalProfit })
        }
      })
      .catch((err) => console.error(err))

    fetch("/api/analytics")
      .then((res) => res.json())
      .then((data: AnalyticsData) => {
        setAnalytics(data)
      })
      .catch((err) => console.error(err))
  }, [])

  const pieData = analytics?.topProducts?.map((p) => ({
    item: p.item_name,
    sales: p.total_quantity,
  }))

  const barData = analytics?.dailySales?.map((d) => ({
    month: d.day,
    sale: d.sale,
  }))

  const lineData = analytics?.hourlyTraffic?.map((h) => ({
    time: h.time,
    customer: h.customer,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมยอดขายและผลการดำเนินงานของร้านค้า</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalSaleCard totalSale={stats.totalSales.toLocaleString()} />
        <ProfitCard totalProfit={stats.totalProfit.toLocaleString()} />
        <Card className="w-full shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">จำนวนออเดอร์ทั้งหมด</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(analytics?.totalOrders ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="w-full shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายเฉลี่ยต่อบิล</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(analytics?.avgOrderValue ?? 0).toLocaleString()} ฿</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartBarDefault data={barData} />
        <ChartLineLinear data={lineData} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartPieLegend data={pieData} />
      </div>
    </div>
  )
}
