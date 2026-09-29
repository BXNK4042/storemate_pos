"use client"

import Image from "next/image"
import Storemate_Mascot from "../../public/storemate_mascot.png"
import ChartBarDefault from "../components/dashboard/chart-bar-default"
import { ChartPieLegend } from "../components/dashboard/chart-pie-legend"
import TotalSaleCard from "../components/dashboard/total-sale-card"

export default function Home() {
  return (
    <div>
      <ChartBarDefault />
      <ChartPieLegend />
      <TotalSaleCard />
      <Image
        src={Storemate_Mascot}
        alt="Storemate Mascot"
        width={300}
        height={412}
      />
    </div>
  )
}
