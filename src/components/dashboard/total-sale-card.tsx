import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

export default function TotalSaleCard() {
  const totalSale = "12,345"

  return (
    <div>
      <Card className="w-full max-w-sm my-5">
        <CardHeader>
          <CardTitle>ยอดขายรวม</CardTitle>
        </CardHeader>
        <CardContent>
          <h1 className="text-3xl font-bold">{totalSale} ฿</h1>
        </CardContent>
      </Card>
    </div>
  )
}
