import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SummaryCard() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>สรุปรายการ</CardTitle>
        <CardDescription>
          Order #DEG183
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border p-3 flex justify-between rounded-lg">
          <h3>Classic Lays</h3>
          <h3>x5</h3>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button type="submit" className="w-full">
          ยืนยันรายการ
        </Button>
        <Button variant="outline" className="w-full">
          ยกเลิกรายการ
        </Button>
      </CardFooter>
    </Card>
  )
}
