import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Item } from "../../../types/item"

interface ItemCardProps {
  item?: Item
  onAdd?: (item: Item) => void
}

export function ItemCard({ item, onAdd }: ItemCardProps) {
  const imageSrc = item?.item_images || ""
  const name = item?.item_name || ""
  const price = item?.item_price ?? 0
  const stock = item?.item_amount ?? 0
  const isOutOfStock = stock <= 0

  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0 overflow-hidden flex flex-col justify-between">
      <div>
        <div className="relative aspect-video w-full bg-white flex items-center justify-center p-2 border-b">
          {imageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageSrc}
              alt={name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-xs text-muted-foreground">ไม่มีรูปภาพ</div>
          )}
          <div className="absolute top-2 right-2">
            {isOutOfStock ? (
              <Badge variant="destructive">หมด</Badge>
            ) : stock <= 5 ? (
              <Badge variant="secondary" className="border-amber-300 text-amber-700 bg-amber-50">
                เหลือ {stock}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-background/80 backdrop-blur-xs">
                เหลือ {stock}
              </Badge>
            )}
          </div>
        </div>
        <CardHeader>
          <CardTitle className="line-clamp-1">{name}</CardTitle>
          <CardDescription className="flex items-center justify-between pt-1">
            <span className="text-2xl font-bold text-foreground font-mono">{price} ฿</span>
            <span className="text-xs font-mono text-muted-foreground">{item?.item_barcode}</span>
          </CardDescription>
        </CardHeader>
      </div>
      <CardFooter>
        <Button
          className="w-full"
          disabled={isOutOfStock}
          onClick={() => item && onAdd?.(item)}
        >
          {isOutOfStock ? "สินค้าหมด" : "เพิ่มรายการ"}
        </Button>
      </CardFooter>
    </Card>
  )
}
