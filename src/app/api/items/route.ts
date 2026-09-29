import Database from "better-sqlite3"
import type { Item } from "../../../../types/item"

const db = new Database("backend/app.db")

export async function GET() {
  const items = db.prepare("SELECT * FROM items").all() as Item[]
  return Response.json(items)
}
