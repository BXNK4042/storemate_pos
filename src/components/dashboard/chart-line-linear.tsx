"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  sales: {
    label: "ยอดขาย (฿)",
    color: "var(--chart-2, #10b981)",
  },
} satisfies ChartConfig;

interface ChartLineLinearProps {
  data?: { label: string; sales: number }[];
  loading?: boolean;
}

export function ChartLineLinear({
  data = [],
  loading = false,
}: ChartLineLinearProps) {
  const chartData = data.length > 0 ? data : [
    { label: "10:00", sales: 0 },
    { label: "12:00", sales: 0 },
    { label: "14:00", sales: 0 },
    { label: "16:00", sales: 0 },
    { label: "18:00", sales: 0 },
    { label: "20:00", sales: 0 },
    { label: "22:00", sales: 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>แนวโน้มยอดขายวันนี้ (ตามช่วงเวลา)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[220px] w-full bg-muted/40 animate-pulse rounded-lg" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Line
                dataKey="sales"
                type="linear"
                stroke="var(--color-sales, #10b981)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--color-sales, #10b981)" }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          แสดงสถิติยอดจำหน่ายตามช่วงเวลาในรอบวัน
        </div>
      </CardFooter>
    </Card>
  );
}
