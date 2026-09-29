"use client"

import { useState, useEffect } from "react"
import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartLineLinear } from "../components/dashboard/chart-line-linear"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"
import ProfitCard from "../components/dashboard/profit-card"

export default function Home() {
  const [stats, setStats] = useState({ totalSales: 0, totalProfit: 0 })

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.totalSales !== undefined) {
          setStats({ totalSales: data.totalSales, totalProfit: data.totalProfit })
        }
      })
      .catch((err) => console.error(err))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมยอดขายและผลการดำเนินงานของร้านค้า</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TotalSaleCard totalSale={stats.totalSales.toLocaleString()} />
        <ProfitCard totalProfit={stats.totalProfit.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartBarDefault />
        <ChartLineLinear />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartPieLegend />
      </div>
    </div>
  )
}
