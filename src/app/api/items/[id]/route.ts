import { updateItem, deleteItem } from "@/lib/items";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return Response.json(
        { success: false, error: "รหัสสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      item_name,
      item_price,
      item_amount,
      item_barcode,
      item_image,
      expiry_date,
      low_stock_threshold,
      reason,
      note,
    } = body;

    if (!item_name || typeof item_name !== "string" || !item_name.trim()) {
      return Response.json(
        { success: false, error: "กรุณากรอกชื่อสินค้า" },
        { status: 400 }
      );
    }

    const price = Number(item_price);
    if (isNaN(price) || price < 0) {
      return Response.json(
        { success: false, error: "ราคาสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const amount = Number(item_amount);
    if (isNaN(amount) || amount < 0) {
      return Response.json(
        { success: false, error: "จำนวนสต็อกไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!item_barcode || typeof item_barcode !== "string" || !item_barcode.trim()) {
      return Response.json(
        { success: false, error: "กรุณาระบุรหัสบาร์โค้ด" },
        { status: 400 }
      );
    }

    const { data, error } = updateItem(itemId, {
      item_name,
      item_price: price,
      item_amount: amount,
      item_barcode,
      item_image,
      expiry_date:
        expiry_date !== undefined
          ? expiry_date ? String(expiry_date).trim() : null
          : undefined,
      low_stock_threshold:
        low_stock_threshold !== undefined
          ? low_stock_threshold !== null && low_stock_threshold !== ""
            ? Number(low_stock_threshold)
            : null
          : undefined,
      reason,
      note,
      user_id: session?.userId || null,
      user_name: session?.username || null,
    });

    if (error) {
      return Response.json({ success: false, error }, { status: 400 });
    }

    return Response.json({ success: true, item: data });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return Response.json(
        { success: false, error: "รหัสสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { error } = deleteItem(itemId);

    if (error) {
      return Response.json({ success: false, error }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
