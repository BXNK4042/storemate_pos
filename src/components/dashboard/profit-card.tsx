import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

interface ProfitCardProps {
  totalProfit?: number | string
}

export default function ProfitCard({ totalProfit = "0" }: ProfitCardProps) {

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">กำไรสุทธิ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-green-600">+ {totalProfit} ฿</div>
      </CardContent>
    </Card>
  )
}
