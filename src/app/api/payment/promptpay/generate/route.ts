import { NextRequest, NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/settings";
import {
  generatePromptPayPayload,
  generateQrDataUrl,
  generateQrSvg,
  generatePromptPayReference,
  maskPromptPayId,
  PromptPayMode,
  PromptPayIdType,
} from "@/lib/promptpay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = getPaymentSettings();

    const targetId = body.previewId || settings.id;
    const targetType: PromptPayIdType = body.previewIdType || settings.idType;
    const merchantName = body.previewMerchantName || settings.merchantName;

    // Check if store PromptPay is configured (unless preview mode is used)
    if (!targetId || targetId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ยังไม่ได้ตั้งค่าหมายเลขพร้อมเพย์ของร้านค้า กรุณาตั้งค่าในเมนูการตั้งค่า",
          configured: false,
        },
        { status: 400 }
      );
    }

    if (!body.previewId && !settings.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: "ระบบชำระเงินพร้อมเพย์ถูกปิดการใช้งานในการตั้งค่าร้านค้า",
          configured: true,
          enabled: false,
        },
        { status: 400 }
      );
    }

    const requestedMode: PromptPayMode =
      body.mode === "static" || body.mode === "dynamic"
        ? body.mode
        : settings.defaultMode;

    const amountNum = typeof body.amount === "number" ? body.amount : Number(body.amount) || undefined;
    const effectiveAmount = requestedMode === "dynamic" && amountNum && amountNum > 0 ? amountNum : undefined;

    const payload = generatePromptPayPayload({
      id: targetId,
      type: targetType,
      amount: effectiveAmount,
      mode: requestedMode,
    });

    const [qrSvg, qrDataUrl] = await Promise.all([
      generateQrSvg(payload, { width: 300, margin: 2 }),
      generateQrDataUrl(payload, { width: 300, margin: 2 }),
    ]);

    const referenceNo = body.referenceNo || generatePromptPayReference();

    return NextResponse.json({
      success: true,
      payload,
      qrSvg,
      qrDataUrl,
      merchantInfo: {
        name: merchantName,
        rawId: targetId,
        maskedId: maskPromptPayId(targetId, targetType),
        idType: targetType,
      },
      amount: effectiveAmount,
      mode: requestedMode,
      referenceNo,
      configured: true,
      enabled: settings.enabled,
    });
  } catch (err) {
    console.error("Failed to generate PromptPay QR:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "ไม่สามารถสร้าง QR Code พร้อมเพย์ได้",
      },
      { status: 400 }
    );
  }
}
