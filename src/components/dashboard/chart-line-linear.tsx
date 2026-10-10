"use client"

import { CartesianGrid, Line, LineChart, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const defaultData = [
  { time: "08:00", customer: 0 },
  { time: "12:00", customer: 0 },
  { time: "16:00", customer: 0 },
  { time: "20:00", customer: 0 },
]

const chartConfig = {
  customer: {
    label: "จำนวนออเดอร์",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface ChartLineLinearProps {
  data?: Array<{ time: string; customer: number }>
}

export function ChartLineLinear({ data }: ChartLineLinearProps) {
  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>ความหนาแน่นคำสั่งซื้อตามช่วงเวลา</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="customer"
              type="linear"
              stroke="var(--color-customer)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          จำนวนคำสั่งซื้อเฉลี่ยแบ่งตามชั่วโมง
        </div>
      </CardFooter>
    </Card>
  )
}
