import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Item } from "../../../types/item"

interface ItemCardProps {
  item?: Item
}

export function ItemCard({ item }: ItemCardProps) {
  const imageSrc = item?.item_images || "/uploads/items/classic_lays.jpg"
  const name = item?.item_name || "เลย์รสคลาสสิก"
  const price = item?.item_price ?? 20

  return (
    <Card className="relative mx-auto w-full max-w-sm pt-0 overflow-hidden">
      <div className="relative aspect-video w-full bg-white flex items-center justify-center p-2 border-b">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>
          <span className="text-3xl font-bold text-foreground">{price} ฿</span>
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button className="w-full">เพิ่มรายการ</Button>
      </CardFooter>
    </Card>
  )
}
