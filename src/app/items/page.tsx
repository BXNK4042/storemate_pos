import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import Database from "better-sqlite3"
import type { Item } from "../../../types/item"

const db = new Database("backend/app.db")

export default function ItemsPage() {
  const items = db.prepare("SELECT * FROM items").all() as Item[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
        <p className="text-sm text-muted-foreground">Manage and view registered store items.</p>
      </div>

      <Card className="p-0 overflow-hidden border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold text-right">Price</TableHead>
              <TableHead className="font-semibold text-right">Amount</TableHead>
              <TableHead className="font-semibold">Barcode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: Item) => (
                <TableRow key={item.item_id}>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell className="text-right font-mono">{item.item_price} ฿</TableCell>
                  <TableCell className="text-right font-mono">{item.item_amount}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{item.item_barcode}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
