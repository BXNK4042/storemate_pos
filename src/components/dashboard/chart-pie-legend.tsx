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

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

interface ChartPieLegendProps {
  data?: Array<{ item: string; sales: number; fill?: string }>
}

export function ChartPieLegend({ data }: ChartPieLegendProps) {
  const chartData = (data && data.length > 0
    ? data
    : [{ item: "ไม่มีข้อมูล", sales: 1 }]
  ).map((d, idx) => ({
    ...d,
    fill: d.fill || COLORS[idx % COLORS.length],
  }))

  const chartConfig = {
    sales: {
      label: "ยอดขาย",
    },
    ...chartData.reduce((acc, curr) => {
      acc[curr.item] = {
        label: curr.item,
        color: curr.fill,
      }
      return acc
    }, {} as Record<string, { label: string; color: string }>),
  } satisfies ChartConfig

  return (
    <Card className="flex flex-col shadow-md">
      <CardHeader className="items-center pb-0">
        <CardTitle>สินค้าขายดีตามจำนวนชิ้น</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <Pie data={chartData} dataKey="sales" nameKey="item" />
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
