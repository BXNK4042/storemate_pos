'use client'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { SummaryCardItem, SummaryCardProp } from "../../../types/summary"
import { ScanBarcode, X, Minus, Plus } from "lucide-react"

export type { SummaryCardItem, SummaryCardProp }

export function SummaryCard({
  items = [],
  orderNumber,
  barcode,
  onClearBarcode,
  onIncrease,
  onDecrease,
  onConfirm,
  onClear,
}: SummaryCardProp) {
  const summary = items
  const total = summary.reduce((sum, item) => sum + item.item_price * item.quantity, 0)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>สรุปรายการ</CardTitle>
        <CardDescription suppressHydrationWarning>
          {orderNumber ? `Order #${orderNumber}` : "Order"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {barcode && (
          <div className="border bg-muted/40 p-2 px-3 flex items-center justify-between text-xs font-mono rounded-lg">
            <div className="flex items-center gap-2 overflow-hidden">
              <ScanBarcode className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold truncate">{barcode}</span>
            </div>
            {onClearBarcode && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onClearBarcode}
                className="h-5 w-5 ml-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        {summary.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีรายการสินค้า
          </div>
        ) : (
          summary.map((item) => (
            <div key={item.item_id} className="border p-3 flex justify-between items-center rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium text-sm">{item.item_name}</span>
                <span className="text-xs text-muted-foreground">{item.item_price} ฿</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => onDecrease?.(item.item_id)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="font-mono text-sm min-w-5 text-center">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon-xs"
                  onClick={() => onIncrease?.(item.item_id)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
        {summary.length > 0 && (
          <div className="pt-2 flex justify-between items-center border-t text-sm font-semibold">
            <span>รวมทั้งสิ้น</span>
            <span className="font-mono text-base">{total} ฿</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          type="button"
          className="w-full"
          onClick={() => summary.length > 0 && onConfirm?.()}
          aria-disabled={summary.length === 0}
        >
          ยืนยันรายการ
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => summary.length > 0 && onClear?.()}
          aria-disabled={summary.length === 0}
        >
          ยกเลิกรายการ
        </Button>
      </CardFooter>
    </Card>
  )
}
