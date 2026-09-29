import Database from "better-sqlite3"

let barcode = "No data"
const db = new Database("backend/app.db")
const FRIEND_API_URL = "http://10.101.162.95:3000/api/item"

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; barcode?: string; data?: string }
  const rawBarcode = (body.text || body.barcode || body.data || "").trim()
  barcode = rawBarcode

  const item = db
    .prepare("SELECT item_name FROM items WHERE item_barcode = ? COLLATE NOCASE")
    .get(rawBarcode) as { item_name: string } | undefined

  const payload = {
    name: item ? item.item_name : rawBarcode,
  }

  // Send item name to friend immediately
  try {
    fetch(FRIEND_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch((err) => console.error("Friend webhook error:", err.message))
  } catch (err) {
    console.error("Failed to send to friend:", err)
  }

  return Response.json(payload)
}

export async function GET() {
  return Response.json({ text: barcode })
}

export async function DELETE() {
  barcode = ""
  return Response.json({ success: true })
}
