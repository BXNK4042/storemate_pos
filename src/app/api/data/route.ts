import { getActiveBarcode, enqueueBarcode, popActiveBarcode, clearActiveBarcode } from "@/lib/barcode";
import { getDb } from "@/lib/db";
import { verifySessionToken } from "@/lib/token";
import { commitStockIntake } from "@/lib/stock";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const DEFAULT_SCANNER_KEY = "pos-scan-key-3849fbc281e047da";

interface SessionAuthResult {
  authorized: boolean;
  user?: { userId: number; username: string; role: string };
}

async function checkAuth(req?: Request): Promise<SessionAuthResult> {
  if (!req) return { authorized: false };

  const apiKey = req.headers.get("x-api-key");
  const validApiKey = process.env.SCANNER_API_KEY || DEFAULT_SCANNER_KEY;
  if (apiKey === validApiKey) {
    return { authorized: true };
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
      return {
        authorized: true,
        user: { userId: session.userId, username: session.username, role: session.role },
      };
    }
  }

  return { authorized: false };
}

interface CartItemRow {
  item_id: number;
  name: string;
  price: number;
  barcode: string;
  quantity: number;
  current_quantity: number;
  subtotal: number;
  updated_at: string;
}

function getSessionCart(mode: string): {
  total: number;
  total_items: number;
  total_quantity: number;
  item_count: number;
  items: CartItemRow[];
} {
  const db = getDb();
  const summaryRow = db
    .prepare(
      `SELECT 
        COALESCE(SUM(ac.quantity * i.item_price), 0) AS total, 
        COALESCE(SUM(ac.quantity), 0) AS total_items, 
        COUNT(ac.item_id) AS item_count 
      FROM active_cart ac 
      JOIN items i ON ac.item_id = i.item_id 
      WHERE ac.mode = ?`
    )
    .get(mode) as { total: number; total_items: number; item_count: number };

  const rawRows = db
    .prepare(
      `SELECT 
        ac.item_id, 
        i.item_name AS name, 
        i.item_price AS price, 
        i.item_barcode AS barcode, 
        i.item_amount AS current_quantity,
        ac.quantity, 
        (ac.quantity * i.item_price) AS subtotal,
        ac.updated_at
      FROM active_cart ac 
      JOIN items i ON ac.item_id = i.item_id 
      WHERE ac.mode = ? 
      ORDER BY ac.updated_at ASC, ac.item_id ASC`
    )
    .all(mode) as any[];

  const cartItems: CartItemRow[] = rawRows.map((row) => ({
    item_id: Number(row.item_id),
    name: String(row.name),
    price: Number(row.price),
    barcode: String(row.barcode),
    quantity: Number(row.quantity),
    current_quantity: Number(row.current_quantity ?? 0),
    subtotal: Number(row.subtotal),
    updated_at: String(row.updated_at),
  }));

  const total = Number(summaryRow?.total || 0);
  const totalItems = Number(summaryRow?.total_items || 0);
  const itemCount = Number(summaryRow?.item_count || 0);

  return {
    total,
    total_items: totalItems,
    total_quantity: totalItems,
    item_count: itemCount,
    items: cartItems,
  };
}

export async function POST(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authorized) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" && body.action.trim() ? body.action.trim() : "scan";
    const mode = typeof body?.mode === "string" && body.mode.trim() ? body.mode.trim() : "sale";
    const rawBarcode = typeof body?.barcode === "string" ? body.barcode : typeof body?.text === "string" ? body.text : "";
    const barcode = rawBarcode.trim();
    const qty = typeof body?.quantity === "number" && !isNaN(body.quantity) ? Math.floor(body.quantity) : 1;

    const db = getDb();

    // 1. Action: scan
    if (action === "scan") {
      if (!barcode) {
        return Response.json(
          { success: false, error: "Invalid text" },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }

      const item = db
        .prepare("SELECT item_id, item_name, item_price, item_barcode, item_amount FROM items WHERE item_barcode = ?")
        .get(barcode) as { item_id: number; item_name: string; item_price: number; item_barcode: string; item_amount: number } | undefined;

      if (!item) {
        const sessionCart = getSessionCart(mode);
        return Response.json(
          {
            success: false,
            error: "Item not found",
            barcode: barcode,
            total: sessionCart.total,
            total_quantity: sessionCart.total_quantity,
            items: sessionCart.items,
          },
          { status: 404, headers: NO_CACHE_HEADERS }
        );
      }

      if (mode === "sale") {
        const cartRow = db
          .prepare("SELECT quantity FROM active_cart WHERE item_id = ? AND mode = 'sale'")
          .get(item.item_id) as { quantity: number } | undefined;
        const existingCartQuantity = cartRow ? Number(cartRow.quantity) : 0;
        const itemAmount = Number(item.item_amount ?? 0);

        if (existingCartQuantity + 1 > itemAmount) {
          const sessionCart = getSessionCart(mode);
          return Response.json(
            {
              success: false,
              error: "Insufficient stock",
              name: item.item_name,
              barcode: item.item_barcode,
              current_quantity: itemAmount,
              cart_quantity: existingCartQuantity,
              total: sessionCart.total,
              total_quantity: sessionCart.total_quantity,
              items: sessionCart.items,
            },
            { status: 400, headers: NO_CACHE_HEADERS }
          );
        }
      }

      enqueueBarcode(barcode);

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO active_cart (item_id, mode, quantity, updated_at) 
        VALUES (?, ?, 1, ?) 
        ON CONFLICT(item_id, mode) 
        DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at
      `).run(item.item_id, mode, now);

      const sessionCart = getSessionCart(mode);

      return Response.json(
        {
          success: true,
          name: item.item_name,
          price: item.item_price,
          barcode: item.item_barcode,
          current_quantity: Number(item.item_amount ?? 0),
          total: sessionCart.total,
          total_items: sessionCart.total_items,
          total_quantity: sessionCart.total_quantity,
          item_count: sessionCart.item_count,
          items: sessionCart.items,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Action: update_qty
    if (action === "update_qty") {
      let targetRow: { item_id: number; quantity: number } | undefined;

      if (barcode) {
        targetRow = db
          .prepare(`
            SELECT ac.item_id, ac.quantity 
            FROM active_cart ac 
            JOIN items i ON ac.item_id = i.item_id 
            WHERE ac.mode = ? AND i.item_barcode = ?
          `)
          .get(mode, barcode) as { item_id: number; quantity: number } | undefined;
      } else {
        targetRow = db
          .prepare(`
            SELECT item_id, quantity 
            FROM active_cart 
            WHERE mode = ? 
            ORDER BY updated_at DESC, item_id DESC 
            LIMIT 1
          `)
          .get(mode) as { item_id: number; quantity: number } | undefined;
      }

      if (targetRow) {
        if (mode === "sale" && qty > 0) {
          const itemRow = db
            .prepare("SELECT item_amount FROM items WHERE item_id = ?")
            .get(targetRow.item_id) as { item_amount: number } | undefined;
          const itemAmount = Number(itemRow?.item_amount ?? 0);
          if (targetRow.quantity + qty > itemAmount) {
            const sessionCart = getSessionCart(mode);
            return Response.json(
              {
                success: false,
                error: "Insufficient stock",
                current_quantity: itemAmount,
                cart_quantity: targetRow.quantity,
                ...sessionCart,
              },
              { status: 400, headers: NO_CACHE_HEADERS }
            );
          }
        }

        const now = new Date().toISOString();
        const newQty = targetRow.quantity + qty;
        if (newQty <= 0) {
          db.prepare("DELETE FROM active_cart WHERE item_id = ? AND mode = ?").run(targetRow.item_id, mode);
        } else {
          db.prepare("UPDATE active_cart SET quantity = ?, updated_at = ? WHERE item_id = ? AND mode = ?").run(
            newQty,
            now,
            targetRow.item_id,
            mode
          );
        }
      }

      const sessionCart = getSessionCart(mode);
      return Response.json(
        {
          success: true,
          total: sessionCart.total,
          total_items: sessionCart.total_items,
          total_quantity: sessionCart.total_quantity,
          item_count: sessionCart.item_count,
          items: sessionCart.items,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Action: delete
    if (action === "delete") {
      let targetRow: { item_id: number; quantity: number } | undefined;

      if (barcode) {
        targetRow = db
          .prepare(`
            SELECT ac.item_id, ac.quantity 
            FROM active_cart ac 
            JOIN items i ON ac.item_id = i.item_id 
            WHERE ac.mode = ? AND i.item_barcode = ?
          `)
          .get(mode, barcode) as { item_id: number; quantity: number } | undefined;
      } else {
        targetRow = db
          .prepare(`
            SELECT item_id, quantity 
            FROM active_cart 
            WHERE mode = ? 
            ORDER BY updated_at DESC, item_id DESC 
            LIMIT 1
          `)
          .get(mode) as { item_id: number; quantity: number } | undefined;
      }

      if (targetRow) {
        const deleteQty = qty > 0 ? qty : 1;
        const newQty = targetRow.quantity - deleteQty;
        if (newQty <= 0) {
          db.prepare("DELETE FROM active_cart WHERE item_id = ? AND mode = ?").run(targetRow.item_id, mode);
        } else {
          const now = new Date().toISOString();
          db.prepare("UPDATE active_cart SET quantity = ?, updated_at = ? WHERE item_id = ? AND mode = ?").run(
            newQty,
            now,
            targetRow.item_id,
            mode
          );
        }
      }

      const sessionCart = getSessionCart(mode);
      return Response.json(
        {
          success: true,
          total: sessionCart.total,
          total_items: sessionCart.total_items,
          total_quantity: sessionCart.total_quantity,
          item_count: sessionCart.item_count,
          items: sessionCart.items,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    // 4. Action: commit_stock_in
    if (action === "commit_stock_in") {
      try {
        const result = commitStockIntake(db, auth.user);
        return Response.json(
          {
            success: true,
            mode: "stock",
            message: "Stock intake committed successfully",
            count: result.count,
            total_quantity: result.totalQuantity,
            items: result.items,
          },
          { headers: NO_CACHE_HEADERS }
        );
      } catch (err: any) {
        if (err?.code === "EMPTY_STOCK_CART" || err?.message === "Cart is empty") {
          return Response.json(
            { success: false, error: "Cart is empty" },
            { status: 400, headers: NO_CACHE_HEADERS }
          );
        }
        throw err;
      }
    }

    // 5. Action: total_sales
    if (action === "total_sales") {
      const row = db
        .prepare(`
          SELECT COALESCE(SUM(order_price), 0) AS total_sales 
          FROM orders 
          WHERE date(created_at, 'localtime') = date('now', 'localtime') 
            AND COALESCE(status, 'completed') != 'refunded'
        `)
        .get() as { total_sales: number } | undefined;

      const salesAmount = Number(row?.total_sales || 0);

      return Response.json(
        {
          success: true,
          total_sales: salesAmount,
          total: salesAmount,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return Response.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function GET(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authorized) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const url = new URL(req.url);
  const peek = url.searchParams.get("peek") === "true";
  const mode = url.searchParams.get("mode") || "sale";
  const barcode = peek ? getActiveBarcode() : popActiveBarcode();

  const sessionCart = getSessionCart(mode);

  return Response.json(
    {
      text: barcode,
      total: sessionCart.total,
      total_items: sessionCart.total_items,
      total_quantity: sessionCart.total_quantity,
      item_count: sessionCart.item_count,
      items: sessionCart.items,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function PUT(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authorized) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await req.json();
    const mode = typeof body?.mode === "string" && body.mode.trim() ? body.mode.trim() : "sale";
    const rawList = Array.isArray(body.cart)
      ? body.cart
      : Array.isArray(body.items)
      ? body.items
      : [];

    const db = getDb();
    const now = new Date().toISOString();
    const syncTx = db.transaction(() => {
      db.prepare("DELETE FROM active_cart WHERE mode = ?").run(mode);
      const insertStmt = db.prepare(
        "INSERT INTO active_cart (item_id, mode, quantity, updated_at) VALUES (?, ?, ?, ?)"
      );
      for (const item of rawList) {
        const id = Number(item.item_id);
        const qty = Number(item.quantity);
        if (!isNaN(id) && id > 0 && !isNaN(qty) && qty > 0) {
          insertStmt.run(id, mode, qty, now);
        }
      }
    });
    syncTx();

    const sessionCart = getSessionCart(mode);

    return Response.json(
      {
        success: true,
        total: sessionCart.total,
        total_items: sessionCart.total_items,
        total_quantity: sessionCart.total_quantity,
        item_count: sessionCart.item_count,
        items: sessionCart.items,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await checkAuth(req);
  if (!auth.authorized) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const db = getDb();
    const url = new URL(req.url);
    const clearCart = url.searchParams.get("clear_cart") === "true";
    const mode = url.searchParams.get("mode");
    if (clearCart) {
      if (mode) {
        db.prepare("DELETE FROM active_cart WHERE mode = ?").run(mode);
      } else {
        db.prepare("DELETE FROM active_cart").run();
      }
    }
    clearActiveBarcode();
    return Response.json({ success: true, text: "" }, { headers: NO_CACHE_HEADERS });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

