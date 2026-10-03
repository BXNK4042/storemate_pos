import { getActiveBarcode, setActiveBarcode, clearActiveBarcode } from "@/lib/barcode";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (typeof body.text !== "string") {
      return Response.json({ success: false, error: "Invalid text" }, { status: 400 });
    }
    setActiveBarcode(body.text);
    return Response.json({ success: true, text: body.text });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const barcode = getActiveBarcode();
  return Response.json({ text: barcode });
}

export async function DELETE() {
  try {
    clearActiveBarcode();
    return Response.json({ success: true, text: "" });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
