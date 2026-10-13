"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  Smartphone,
  CreditCard,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { type PaymentSettings } from "@/lib/settings";
import { type PromptPayIdType, validatePromptPayId } from "@/lib/promptpay";

interface PaymentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved?: (settings: PaymentSettings) => void;
}

export function PaymentSettingsDialog({
  open,
  onOpenChange,
  onSettingsSaved,
}: PaymentSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idType, setIdType] = useState<PromptPayIdType>("phone");
  const [id, setId] = useState("");
  const [merchantName, setMerchantName] = useState("StoreMate POS");

  // Preview state
  const [previewQr, setPreviewQr] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Fetch settings when opened
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/payment");
      const data = await res.json();
      if (data.success && data.settings) {
        setIdType(data.settings.idType || "phone");
        setId(data.settings.id || "");
        setMerchantName(data.settings.merchantName || "StoreMate POS");
      }
    } catch (err) {
      console.error("Failed to load payment settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, loadSettings]);

  // ID Validation
  const validation = validatePromptPayId(id, idType);
  const isIdValid = id.trim().length === 0 || validation.valid;

  // Generate live preview QR
  const updatePreview = useCallback(async () => {
    const trimmedId = id.trim();
    if (!trimmedId) {
      setPreviewQr(null);
      return;
    }

    const testVal = validatePromptPayId(trimmedId, idType);
    if (!testVal.valid) {
      setPreviewQr(null);
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/payment/promptpay/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewId: trimmedId,
          previewIdType: idType,
          previewMerchantName: merchantName,
          mode: "dynamic",
          amount: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.qrDataUrl) {
        setPreviewQr(data.qrDataUrl);
      } else {
        setPreviewQr(null);
      }
    } catch {
      setPreviewQr(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [id, idType, merchantName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (id.trim()) {
        updatePreview();
      } else {
        setPreviewQr(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [id, idType, merchantName, updatePreview]);

  const handleSave = async () => {
    if (id.trim().length > 0 && !validation.valid) {
      setNotification({
        type: "error",
        message: validation.error || "กรุณากรอกหมายเลขพร้อมเพย์ให้ถูกต้อง",
      });
      return;
    }

    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch("/api/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          idType,
          id: id.trim(),
          merchantName: merchantName.trim(),
          defaultMode: "dynamic",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: "success",
          message: "บันทึกการตั้งค่าพร้อมเพย์สำเร็จ",
        });
        if (onSettingsSaved && data.settings) {
          onSettingsSaved(data.settings);
        }
        setTimeout(() => {
          onOpenChange(false);
        }, 1200);
      } else {
        setNotification({
          type: "error",
          message: data.error || "ไม่สามารถบันทึกการตั้งค่าได้",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
      });
    } finally {
      setSaving(false);
    }
  };

  const idPlaceholder =
    idType === "phone"
      ? "เช่น 0812345678"
      : idType === "citizen_id"
      ? "เช่น 1234567890123"
      : "เช่น 140001234567890";

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setNotification(null);
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                ตั้งค่าระบบรับชำระเงินพร้อมเพย์ (PromptPay)
              </DialogTitle>
              <DialogDescription className="sr-only">
                ตั้งค่าระบบรับชำระเงินพร้อมเพย์
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {notification && (
          <div
            className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>กำลังโหลดการตั้งค่า...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Merchant Name */}
            <div className="space-y-1.5">
              <Label htmlFor="merchant-name" className="text-xs font-semibold">
                ชื่อร้านค้า / ชื่อบัญชีที่แสดง
              </Label>
              <Input
                id="merchant-name"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="เช่น ร้านสะดวกซื้อ StoreMate สาขา 1"
                className="text-sm"
              />
            </div>

            {/* PromptPay Identifier Type */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">ประเภทบัญชีพร้อมเพย์</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setIdType("phone")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                    idType === "phone"
                      ? "border-primary bg-primary/5 text-primary font-bold shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>เบอร์มือถือ</span>
                  <span className="text-[10px] text-muted-foreground font-normal">(10 หลัก)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIdType("citizen_id")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                    idType === "citizen_id"
                      ? "border-primary bg-primary/5 text-primary font-bold shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>บัตร ปชช. / Tax ID</span>
                  <span className="text-[10px] text-muted-foreground font-normal">(13 หลัก)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIdType("ewallet")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-1.5 transition-all cursor-pointer ${
                    idType === "ewallet"
                      ? "border-primary bg-primary/5 text-primary font-bold shadow-xs"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  <span>e-Wallet ID</span>
                  <span className="text-[10px] text-muted-foreground font-normal">(15 หลัก)</span>
                </button>
              </div>
            </div>

            {/* PromptPay ID Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="promptpay-id" className="text-xs font-semibold">
                  หมายเลขพร้อมเพย์ร้านค้า
                </Label>
                {id.trim().length > 0 && (
                  <span
                    className={`text-[11px] font-medium ${
                      validation.valid ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {validation.valid ? "รูปแบบถูกต้อง" : validation.error}
                  </span>
                )}
              </div>
              <Input
                id="promptpay-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={idPlaceholder}
                className={`text-sm font-mono tracking-wider ${
                  !isIdValid ? "border-rose-400 focus-visible:ring-rose-400" : ""
                }`}
              />
              <p className="text-[11px] text-muted-foreground">
                รองรับการกรอกทั้งแบบมีขีดคั่นหรือไม่มีขีด ระบบจะจัดรูปแบบ EMVCo อัตโนมัติ
              </p>
            </div>

            {/* Test QR Code */}
            {previewLoading ? (
              <div className="h-36 flex items-center justify-center rounded-xl border border-dashed">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : previewQr ? (
              <div className="flex items-center justify-center p-3 bg-white rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewQr}
                  alt="PromptPay QR Preview"
                  className="w-36 h-36 object-contain"
                />
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="flex-row gap-2 justify-end mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex-1"
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || (id.trim().length > 0 && !validation.valid)}
            className="flex-1 gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                บันทึกการตั้งค่า
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
