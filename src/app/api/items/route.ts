import Database from "better-sqlite3"
import type { Item } from "../../../../types/item"

const db = new Database("backend/app.db")

export async function GET() {
  const items = db.prepare("SELECT * FROM items").all() as Item[]
  return Response.json(items)
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    item_name?: string
    item_price?: number | string
    item_amount?: number | string
    item_barcode?: string
    item_images?: string
  }

  const { item_name, item_price, item_amount, item_barcode, item_images } = body

  if (!item_name || item_price === undefined || item_amount === undefined || !item_barcode) {
    return Response.json({ error: "กรุณากรอกข้อมูลสินค้าให้ครบถ้วน" }, { status: 400 })
  }

  const stmt = db.prepare(`
    INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_images)
    VALUES (?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    item_name.trim(),
    Number(item_price),
    Number(item_amount),
    item_barcode.trim(),
    item_images?.trim() || null
  )

  return Response.json({ success: true, item_id: result.lastInsertRowid })
}
