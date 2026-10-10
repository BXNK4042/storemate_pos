"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
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
  { month: "Sunday", sale: 0 },
  { month: "Monday", sale: 0 },
  { month: "Tuesday", sale: 0 },
  { month: "Wednesday", sale: 0 },
  { month: "Thursday", sale: 0 },
  { month: "Friday", sale: 0 },
  { month: "Saturday", sale: 0 },
]

const chartConfig = {
  sale: {
    label: "ยอดขาย (บาท)",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface ChartBarDefaultProps {
  data?: Array<{ month: string; sale: number }>
}

export default function ChartBarDefault({ data }: ChartBarDefaultProps) {
  const chartData = data && data.length > 0 ? data : defaultData

  return (
    <Card className="w-full shadow-md">
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
            <Bar dataKey="sale" fill="var(--color-sale)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          แนวโน้มยอดขายตามรอบวันของสัปดาห์
        </div>
      </CardFooter>
    </Card>
  )
}
