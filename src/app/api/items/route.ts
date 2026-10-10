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

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    item_id?: number | string
    item_name?: string
    item_price?: number | string
    item_amount?: number | string
    item_barcode?: string
    item_images?: string
  }

  const { item_id, item_name, item_price, item_amount, item_barcode, item_images } = body

  if (!item_id || !item_name || item_price === undefined || item_amount === undefined || !item_barcode) {
    return Response.json({ error: "กรุณากรอกข้อมูลสินค้าให้ครบถ้วน" }, { status: 400 })
  }

  const stmt = db.prepare(`
    UPDATE items
    SET item_name = ?, item_price = ?, item_amount = ?, item_barcode = ?, item_images = ?
    WHERE item_id = ?
  `)

  const result = stmt.run(
    item_name.trim(),
    Number(item_price),
    Number(item_amount),
    item_barcode.trim(),
    item_images?.trim() || null,
    Number(item_id)
  )

  if (result.changes === 0) {
    return Response.json({ error: "ไม่พบสินค้าที่ต้องการแก้ไข" }, { status: 404 })
  }

  return Response.json({ success: true })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id) {
    return Response.json({ error: "Missing item id" }, { status: 400 })
  }

  try {
    const stmt = db.prepare("DELETE FROM items WHERE item_id = ?")
    const result = stmt.run(Number(id))
    if (result.changes === 0) {
      return Response.json({ error: "ไม่พบสินค้าที่ต้องการลบ" }, { status: 404 })
    }
    return Response.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete item"
    return Response.json({ error: `ไม่สามารถลบสินค้านี้ได้: ${msg}` }, { status: 400 })
  }
}

