import { getActiveBarcode, setActiveBarcode, clearActiveBarcode } from "@/lib/barcode";
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
    setActiveBarcode(body.text);
    return Response.json({ success: true, text: body.text });
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
  return Response.json({ text: barcode });
}

export async function DELETE(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
