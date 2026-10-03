import { getItems, createItem } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = getItems();
  if (error) {
    return Response.json({ success: false, error }, { status: 500 });
  }
  return Response.json({ success: true, items: data });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { item_name, item_price, item_amount, item_barcode } = body;

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

    const { data, error } = createItem({
      item_name,
      item_price: price,
      item_amount: amount,
      item_barcode,
    });

    if (error) {
      return Response.json({ success: false, error }, { status: 500 });
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
