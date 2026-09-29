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

const date = "30 ก.ย."

const chartData = [
  { time: "08", customer: 186 },
  { time: "10", customer: 305 },
  { time: "12", customer: 237 },
  { time: "14", customer: 73 },
  { time: "16", customer: 209 },
  { time: "18", customer: 214 },
]

const chartConfig = {
  customer: {
    label: "customer",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartLineLinear() {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>จำนวนลูกค้าวันที่ {date}</CardTitle>
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
              tickFormatter={(value) => value.slice(0, 3)}
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
          จำนวนลูกค้าในแต่ละช่วงเวลา
        </div>
      </CardFooter>
    </Card>
  )
}
