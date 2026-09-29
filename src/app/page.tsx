"use client"

import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartLineLinear } from "../components/dashboard/chart-line-linear"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"
import ProfitCard from "../components/dashboard/profit-card"

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมยอดขายและผลการดำเนินงานของร้านค้า</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TotalSaleCard />
        <ProfitCard />
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
