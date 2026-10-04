import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface TotalSaleCardProps {
  amount?: number;
  loading?: boolean;
}

export default function TotalSaleCard({ amount = 0, loading = false }: TotalSaleCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-28 bg-muted animate-pulse rounded-md mt-1" />
        ) : (
          <div className="text-4xl font-extrabold tracking-tight text-gray-900">
            {amount.toLocaleString()} ฿
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">ประจำเดือนนี้</p>
      </CardContent>
    </Card>
  )
}
