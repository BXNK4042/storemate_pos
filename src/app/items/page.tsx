import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import Database from "better-sqlite3";
import type { Item } from '../../../types/item.ts';

const db = new Database('backend/app.db')

export default function Item() {
  const items = db.prepare('SELECT * FROM items').all() as Item[];

  return (
    <div className="my-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Barcode</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>

          {items.map((item: Item) => (
            <TableRow key={item.item_id}>
              <TableCell>{item.item_name}</TableCell>
              <TableCell>{item.item_price}</TableCell>
              <TableCell>{item.item_amount}</TableCell>
              <TableCell>{item.item_barcode}</TableCell>
            </TableRow>
          ))}

        </TableBody>
      </Table>
    </div>
  );
}
