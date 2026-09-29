"use client"

import { Pie, PieChart } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

export const description = "A pie chart with a legend"

const chartData = [
  { item: "classic_lays", sales: 275, fill: "var(--color-classic_lays)" },
  { item: "coca_cola", sales: 200, fill: "var(--color-coca_cola)" },
  { item: "kitkat_bar", sales: 187, fill: "var(--color-kitkat_bar)" },
  { item: "oishi_green_tea", sales: 173, fill: "var(--color-oishi_green_tea)" },
  { item: "other", sales: 90, fill: "var(--color-other)" },
]

const chartConfig = {
  sales: {
    label: "Sales",
  },
  classic_lays: {
    label: "Classic Lays",
    color: "var(--chart-1)",
  },
  coca_cola: {
    label: "Coca-Cola",
    color: "var(--chart-2)",
  },
  kitkat_bar: {
    label: "KitKat Bar",
    color: "var(--chart-3)",
  },
  oishi_green_tea: {
    label: "Oishi Green Tea",
    color: "var(--chart-4)",
  },
  other: {
    label: "Other",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig

export function ChartPieLegend() {
  return (
    <Card className="flex flex-col shadow-md">
      <CardHeader className="items-center pb-0">
        <CardTitle>สินค้าขายดี</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square"
        >
          <PieChart>
            <Pie data={chartData} dataKey="sales" />
            <ChartLegend
              content={<ChartLegendContent nameKey="item" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
