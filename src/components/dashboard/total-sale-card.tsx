import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

export default function TotalSaleCard() {
  const totalSale = "12,345"

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{totalSale} ฿</div>
      </CardContent>
    </Card>
  )
}
