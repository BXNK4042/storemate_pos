import { NextRequest, NextResponse } from "next/server";
import { getPaymentSettings, updatePaymentSettings, PaymentSettings } from "@/lib/settings";
import { validatePromptPayId, PromptPayIdType } from "@/lib/promptpay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getPaymentSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err) {
    console.error("Failed to load payment settings:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const role = req.headers.get("x-user-role");
    if (role && role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบเท่านั้น)",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { enabled, idType, id, merchantName, defaultMode } = body;

    const validatedIdType: PromptPayIdType =
      idType === "citizen_id" || idType === "ewallet" ? idType : "phone";

    // Validate ID if enabled and ID is not empty
    if (enabled && typeof id === "string" && id.trim().length > 0) {
      const validation = validatePromptPayId(id, validatedIdType);
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error || "ข้อมูลหมายเลขพร้อมเพย์ไม่ถูกต้อง",
          },
          { status: 400 }
        );
      }
    }

    const updates: Partial<PaymentSettings> = {};
    if (typeof enabled === "boolean") {
      updates.enabled = enabled;
    }
    if (idType) {
      updates.idType = validatedIdType;
    }
    if (typeof id === "string") {
      updates.id = id.trim();
    }
    if (typeof merchantName === "string") {
      updates.merchantName = merchantName.trim();
    }
    if (defaultMode === "dynamic" || defaultMode === "static") {
      updates.defaultMode = defaultMode;
    }

    const updated = updatePaymentSettings(updates);

    return NextResponse.json({
      success: true,
      message: "บันทึกการตั้งค่าพร้อมเพย์สำเร็จ",
      settings: updated,
    });
  } catch (err) {
    console.error("Failed to update payment settings:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
