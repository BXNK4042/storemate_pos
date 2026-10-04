"use client";

import { Pie, PieChart, Cell } from "recharts";
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
    label: "จำนวนชิ้น",
  },
} satisfies ChartConfig;

interface ChartPieLegendProps {
  data?: { name: string; value: number; fill: string }[];
  loading?: boolean;
}

export function ChartPieLegend({
  data = [],
  loading = false,
}: ChartPieLegendProps) {
  const chartData = data.length > 0 ? data : [
    { name: "ยังไม่มีข้อมูล", value: 1, fill: "var(--muted, #e5e7eb)" },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-2">
        <CardTitle>5 สินค้าขายดีที่สุด</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {loading ? (
          <div className="h-[220px] w-full bg-muted/40 animate-pulse rounded-lg" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto h-[220px] w-full pb-0"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={4}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 pt-2 text-xs">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {chartData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.fill }}
              />
              <span className="text-muted-foreground truncate max-w-[100px]">
                {item.name}: {item.value} ชิ้น
              </span>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
