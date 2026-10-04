"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
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
    color: "var(--chart-1, #3b82f6)",
  },
} satisfies ChartConfig;

interface ChartBarDefaultProps {
  data?: { label: string; sales: number; orders: number }[];
  loading?: boolean;
}

export default function ChartBarDefault({
  data = [],
  loading = false,
}: ChartBarDefaultProps) {
  const chartData = data.length > 0 ? data : [
    { label: "ไม่มีข้อมูล", sales: 0, orders: 0 },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>ยอดขาย 7 วันล่าสุด</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[220px] w-full bg-muted/40 animate-pulse rounded-lg" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="sales" fill="var(--color-sales, #3b82f6)" radius={8} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          รายงานยอดขายรายวันแบบเรียลไทม์จากระบบ
        </div>
      </CardFooter>
    </Card>
  );
}
