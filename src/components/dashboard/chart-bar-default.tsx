"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartData = [
  { month: "Sunday", sale: 186 },
  { month: "Monday", sale: 305 },
  { month: "Tuesday", sale: 237 },
  { month: "Wednesday", sale: 73 },
  { month: "Thursday", sale: 209 },
  { month: "Friday", sale: 214 },
  { month: "Saturday", sale: 150}
]

const chartConfig = {
  sale: {
    label: "sale",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export default function ChartBarDefault() {
  return (
    <div className="my-5">
      <Card>
        <CardHeader>
          <CardTitle>ยอดขายรายวัน</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="sale" fill="var(--color-sale)" radius={8} />
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <div className="leading-none text-muted-foreground">
            ยอดขายรายวันตั้งแต่วันที่ 27 ก.ย.-3 ต.ค.
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
