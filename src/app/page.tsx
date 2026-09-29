"use client"

import Image from "next/image"
import Storemate_Mascot from "../../public/storemate_mascot.png"
import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartLineLinear } from "../components/dashboard/chart-line-linear"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"
import { Card } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of store sales and performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <TotalSaleCard />
        <Card className="flex items-center justify-between p-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Store Status</div>
            <div className="text-2xl font-bold">Online</div>
          </div>
          <span className="h-3 w-3 bg-emerald-500 rounded-full shadow-green-500 animate-pulse"/>
        </Card>
        <Card className="flex items-center justify-center p-6">
          <Image
            src={Storemate_Mascot}
            alt="Storemate Mascot"
            width={60}
            height={52}
            className="object-contain"
          />
        </Card>
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
