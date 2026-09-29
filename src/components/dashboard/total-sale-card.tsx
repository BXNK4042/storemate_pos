import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

interface TotalSaleCardProps {
  totalSale?: number | string
}

export default function TotalSaleCard({ totalSale = "0" }: TotalSaleCardProps) {

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{totalSale} ฿</div>
      </CardContent>
    </Card>
  )
}
