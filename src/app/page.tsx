"use client"

import Image from "next/image"
import Storemate_Mascot from "../../public/storemate_mascot.png"
import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartLineLinear } from "../components/dashboard/chart-line-linear"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">แดชบอร์ดภาพรวม</h1>
        <p className="text-sm text-muted-foreground">
          สรุปรายงานยอดขายและสถิติประจำวันของ StoreMate POS
        </p>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalSaleCard />

        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ออเดอร์วันนี้
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold tracking-tight text-gray-900">142</div>
            <p className="mt-1 text-xs text-muted-foreground">+8.2% จากเมื่อวาน</p>
          </CardContent>
        </Card>

        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ลูกค้าที่เข้าใช้บริการ
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold tracking-tight text-gray-900">1,224</div>
            <p className="mt-1 text-xs text-muted-foreground">ชั่วโมงเร่งด่วน: 10:00 - 12:00</p>
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
                สถานะระบบ: ปกติ
              </span>
            </div>
            <div className="relative -my-3 -mr-2 h-24 w-24 shrink-0">
              <Image
                src={Storemate_Mascot}
                alt="Storemate Mascot"
                fill
                className="object-contain drop-shadow"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Section - 3 Compact Columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartBarDefault />
        <ChartLineLinear />
        <ChartPieLegend />
      </div>
    </div>
  )
}
