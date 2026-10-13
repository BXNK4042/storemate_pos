import { getActiveBarcode, setActiveBarcode, clearActiveBarcode } from "@/lib/barcode";
import { getDb } from "@/lib/db";
import { verifySessionToken } from "@/lib/token";

async function isAuthorized(req?: Request): Promise<boolean> {
  if (!req) return false;

  const apiKey = req.headers.get("x-api-key");
  if (process.env.SCANNER_API_KEY && apiKey === process.env.SCANNER_API_KEY) {
    return true;
  }

  let token: string | undefined;
  if ("cookies" in req && typeof (req as any).cookies?.get === "function") {
    token = (req as any).cookies.get("storemate_session")?.value;
  }
  if (!token) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)storemate_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      return true;
    }
  }

  return false;
}

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (typeof body.text !== "string") {
      return Response.json({ success: false, error: "Invalid text" }, { status: 400 });
    }

    const db = getDb();
    const item = db
      .prepare("SELECT item_id, item_name, item_price, item_barcode FROM items WHERE item_barcode = ?")
      .get(body.text) as { item_id: number; item_name: string; item_price: number; item_barcode: string } | undefined;

    if (!item) {
      return Response.json({ success: false, error: "Item not found" }, { status: 404 });
    }

    db.prepare(
      "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
    ).run(item.item_id);

    const summaryRow = db
      .prepare(
        "SELECT COALESCE(SUM(ac.quantity * i.item_price), 0) AS total, COALESCE(SUM(ac.quantity), 0) AS total_items, COUNT(ac.item_id) AS item_count FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
      )
      .get() as { total: number; total_items: number; item_count: number };

    const cartItems = db
      .prepare(
        "SELECT ac.item_id, i.item_name AS name, i.item_price AS price, ac.quantity, (ac.quantity * i.item_price) AS subtotal FROM active_cart ac JOIN items i ON ac.item_id = i.item_id ORDER BY ac.item_id ASC"
      )
      .all() as { item_id: number; name: string; price: number; quantity: number; subtotal: number }[];

    setActiveBarcode(body.text);

    return Response.json({
      success: true,
      name: item.item_name,
      price: item.item_price,
      barcode: item.item_barcode,
      total: Number(summaryRow.total || 0),
      total_items: Number(summaryRow.total_items || 0),
      total_quantity: Number(summaryRow.total_items || 0),
      item_count: Number(summaryRow.item_count || 0),
      items: cartItems,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barcode = getActiveBarcode();
  const db = getDb();
  const summaryRow = db
    .prepare(
      "SELECT COALESCE(SUM(ac.quantity * i.item_price), 0) AS total, COALESCE(SUM(ac.quantity), 0) AS total_items, COUNT(ac.item_id) AS item_count FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
    )
    .get() as { total: number; total_items: number; item_count: number };

  const cartItems = db
    .prepare(
      "SELECT ac.item_id, i.item_name AS name, i.item_price AS price, ac.quantity, (ac.quantity * i.item_price) AS subtotal FROM active_cart ac JOIN items i ON ac.item_id = i.item_id ORDER BY ac.item_id ASC"
    )
    .all() as { item_id: number; name: string; price: number; quantity: number; subtotal: number }[];

  return Response.json({
    text: barcode,
    total: Number(summaryRow.total || 0),
    total_items: Number(summaryRow.total_items || 0),
    total_quantity: Number(summaryRow.total_items || 0),
    item_count: Number(summaryRow.item_count || 0),
    items: cartItems,
  });
}

export async function PUT(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rawList = Array.isArray(body.cart)
      ? body.cart
      : Array.isArray(body.items)
      ? body.items
      : [];

    const db = getDb();
    const syncTx = db.transaction(() => {
      db.prepare("DELETE FROM active_cart").run();
      const insertStmt = db.prepare(
        "INSERT INTO active_cart (item_id, quantity) VALUES (?, ?)"
      );
      for (const item of rawList) {
        const id = Number(item.item_id);
        const qty = Number(item.quantity);
        if (!isNaN(id) && id > 0 && !isNaN(qty) && qty > 0) {
          insertStmt.run(id, qty);
        }
      }
    });
    syncTx();

    const summaryRow = db
      .prepare(
        "SELECT COALESCE(SUM(ac.quantity * i.item_price), 0) AS total, COALESCE(SUM(ac.quantity), 0) AS total_items, COUNT(ac.item_id) AS item_count FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
      )
      .get() as { total: number; total_items: number; item_count: number };

    const cartItems = db
      .prepare(
        "SELECT ac.item_id, i.item_name AS name, i.item_price AS price, ac.quantity, (ac.quantity * i.item_price) AS subtotal FROM active_cart ac JOIN items i ON ac.item_id = i.item_id ORDER BY ac.item_id ASC"
      )
      .all() as { item_id: number; name: string; price: number; quantity: number; subtotal: number }[];

    return Response.json({
      success: true,
      total: Number(summaryRow.total || 0),
      total_items: Number(summaryRow.total_items || 0),
      total_quantity: Number(summaryRow.total_items || 0),
      item_count: Number(summaryRow.item_count || 0),
      items: cartItems,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const url = new URL(req.url);
    const clearCart = url.searchParams.get("clear_cart") === "true";
    if (clearCart) {
      db.prepare("DELETE FROM active_cart").run();
    }
    clearActiveBarcode();
    return Response.json({ success: true, text: "" });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
