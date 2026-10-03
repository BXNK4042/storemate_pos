import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function TotalSaleCard() {
  const totalSale = "12,345"

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-extrabold tracking-tight text-gray-900">{totalSale} ฿</div>
        <p className="text-xs text-muted-foreground mt-1">ประจำเดือนนี้</p>
      </CardContent>
    </Card>
  )
}
