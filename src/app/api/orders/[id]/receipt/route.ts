import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { getReceiptSettings } from "@/lib/settings";
import { formatTextReceipt, generateEscPosReceipt } from "@/lib/receipt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: "รหัสคำสั่งซื้อไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "txt").toLowerCase();
    const download = searchParams.get("download") === "true";

    if (format !== "txt" && format !== "escpos") {
      return NextResponse.json(
        { success: false, error: "รูปแบบไม่ถูกต้อง (รองรับเฉพาะ 'txt' และ 'escpos')" },
        { status: 400 }
      );
    }

    const order = getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: "ไม่พบคำสั่งซื้อ" },
        { status: 404 }
      );
    }

    const settings = getReceiptSettings();
    const widthParam = searchParams.get("width");
    const width = widthParam ? parseInt(widthParam, 10) : settings.paperWidth;
    const effectiveWidth = !isNaN(width) && width >= 24 ? width : 32;

    const receiptOptions = {
      width: effectiveWidth,
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storeTaxId: settings.storeTaxId,
      storePhone: settings.storePhone,
      footerMessage: settings.footerMessage,
    };

    const filename = `receipt-${order.order_name}.${format === "escpos" ? "bin" : "txt"}`;

    if (format === "escpos") {
      const buffer = generateEscPosReceipt(order, receiptOptions);
      const headers = new Headers();
      headers.set("Content-Type", "application/octet-stream");
      if (download) {
        headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      }
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers,
      });
    }

    // Default: format === "txt"
    const textReceipt = formatTextReceipt(order, receiptOptions);
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }
    return new NextResponse(textReceipt, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Failed to generate receipt:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
