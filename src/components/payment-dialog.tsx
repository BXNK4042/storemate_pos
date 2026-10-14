/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Banknote,
  QrCode,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Copy,
  CheckCheck,
  Calculator,
  Delete,
  X,
  Coins,
} from "lucide-react";
import { PaymentSettingsDialog } from "@/components/settings/payment-settings-dialog";
import { type PromptPayMode } from "@/lib/promptpay";
import {
  calculateCashPayment,
  isHugeOverpayment,
  ADDITIVE_BILLS,
} from "@/lib/cash";

interface QrPaymentData {
  payload: string;
  qrDataUrl: string;
  qrSvg: string;
  referenceNo: string;
  amount?: number;
  mode: PromptPayMode;
  merchantInfo: {
    name: string;
    rawId: string;
    maskedId: string;
    idType: string;
  };
  configured: boolean;
  enabled: boolean;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (paymentInfo: {
    method: "cash" | "promptpay";
    amountPaid: number;
    change: number;
    promptpayType?: PromptPayMode;
    promptpayRef?: string;
    promptpayPayload?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function PaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isSubmitting,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<"cash" | "promptpay">("cash");
  const [cashReceived, setCashReceived] = useState<number>(totalAmount);
  const [rawCashInput, setRawCashInput] = useState<string>(String(totalAmount));
  const [showNumpad, setShowNumpad] = useState<boolean>(false);

  // PromptPay QR States
  const [qrMode, setQrMode] = useState<PromptPayMode>("dynamic");
  const [qrData, setQrData] = useState<QrPaymentData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Reset or initialize values when dialog opens
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashReceived(totalAmount);
      setRawCashInput(totalAmount > 0 ? String(totalAmount) : "");
      setShowNumpad(false);
      setQrError(null);
      setCopiedPayload(false);
    }
  }, [open, totalAmount]);

  // Generate PromptPay QR
  const fetchPromptPayQr = useCallback(
    async (modeToUse: PromptPayMode) => {
      setQrLoading(true);
      setQrError(null);
      try {
        const res = await fetch("/api/payment/promptpay/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAmount,
            mode: modeToUse,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setQrData(data);
          setGeneratedAt(new Date());
          setQrError(null);
        } else {
          setQrData(null);
          setQrError(data.error || "ไม่สามารถสร้าง PromptPay QR ได้");
        }
      } catch {
        setQrData(null);
        setQrError("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อสร้าง PromptPay QR");
      } finally {
        setQrLoading(false);
      }
    },
    [totalAmount]
  );

  // Fetch QR when method switches to promptpay or mode changes
  useEffect(() => {
    if (open && method === "promptpay") {
      fetchPromptPayQr(qrMode);
    }
  }, [open, method, qrMode, fetchPromptPayQr]);

  // Cash Engine Calculations
  const cashCalc = calculateCashPayment(totalAmount, cashReceived);
  const isCashInsufficient = method === "cash" && cashCalc.isInsufficient;
  const hugeOverpayment = method === "cash" && isHugeOverpayment(totalAmount, cashReceived);

  // Cash Action Handlers
  const handleAddBill = (bill: number) => {
    const next = Math.round((cashReceived + bill) * 100) / 100;
    setCashReceived(next);
    setRawCashInput(String(next));
  };

  const handleClear = () => {
    setCashReceived(0);
    setRawCashInput("");
  };

  const handleInputChange = (val: string) => {
    setRawCashInput(val);
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed < 0) {
      setCashReceived(0);
    } else {
      setCashReceived(Math.round(parsed * 100) / 100);
    }
  };

  const handleNumpadPress = (key: string) => {
    let current = rawCashInput;
    if (key === "backspace") {
      const next = current.slice(0, -1);
      setRawCashInput(next);
      const parsed = parseFloat(next);
      setCashReceived(isNaN(parsed) ? 0 : parsed);
      return;
    }
    if (key === "00") {
      if (!current || current === "0") return;
      const next = current + "00";
      if (Number(next) > 10_000_000) return;
      setRawCashInput(next);
      setCashReceived(Number(next) || 0);
      return;
    }
    if (key === ".") {
      if (current.includes(".")) return;
      const next = current ? current + "." : "0.";
      setRawCashInput(next);
      return;
    }
    if (current === "0" && key !== ".") {
      current = "";
    }
    const next = current + key;
    if (Number(next) > 10_000_000) return;
    setRawCashInput(next);
    setCashReceived(Number(next) || 0);
  };

  const handleSwitchMode = (mode: PromptPayMode) => {
    setQrMode(mode);
  };

  const handleCopyPayload = () => {
    if (!qrData?.payload) return;
    navigator.clipboard.writeText(qrData.payload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleConfirm = async () => {
    if (isCashInsufficient || isSubmitting) return;

    if (method === "promptpay") {
      await onConfirm({
        method: "promptpay",
        amountPaid: totalAmount,
        change: 0,
        promptpayType: qrMode,
        promptpayRef: qrData?.referenceNo,
        promptpayPayload: qrData?.payload,
      });
    } else {
      await onConfirm({
        method: "cash",
        amountPaid: cashCalc.cashReceived,
        change: cashCalc.change,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">เลือกวิธีชำระเงิน</DialogTitle>
            <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">ยอดชำระทั้งสิ้น</span>
              <span className="text-2xl font-extrabold text-primary font-mono">
                {totalAmount.toLocaleString()} ฿
              </span>
            </div>
          </DialogHeader>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMethod("cash")}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-all cursor-pointer ${
                method === "cash"
                  ? "border-primary bg-primary/5 text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Banknote className="h-4 w-4" />
              เงินสด (Cash)
            </button>

            <button
              type="button"
              onClick={() => setMethod("promptpay")}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-medium text-sm transition-all cursor-pointer ${
                method === "promptpay"
                  ? "border-primary bg-primary/5 text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <QrCode className="h-4 w-4" />
              พร้อมเพย์ (QR)
            </button>
          </div>

          {/* Cash Payment Method */}
          {method === "cash" ? (
            <div className="space-y-4 pt-2">
              {/* Tender Input & Quick Actions */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    รับเงินมา (฿)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNumpad(!showNumpad)}
                      className={`h-6 px-2 text-[11px] gap-1 ${
                        showNumpad ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      <Calculator className="h-3 w-3" />
                      แป้นตัวเลข
                    </Button>
                    {cashReceived > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-rose-600 gap-1"
                        title="ล้างจำนวนเงิน"
                      >
                        <X className="h-3 w-3" />
                        ล้าง
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={rawCashInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="0"
                    className="text-2xl font-mono font-black pr-14 h-12 tracking-tight"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-sm font-semibold text-muted-foreground">
                      ฿
                    </span>
                  </div>
                </div>
              </div>

              {/* Additive Bill Accumulator Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    รวมธนบัตร (Bill Accumulator)
                  </span>
                  {cashReceived > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      สะสม: ฿{cashReceived.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {ADDITIVE_BILLS.map((bill) => (
                    <Button
                      key={bill}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddBill(bill)}
                      className="h-9 px-1 text-xs font-bold font-mono transition-transform active:scale-95 hover:border-primary/50"
                    >
                      +{bill}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Touchscreen Numeric Keypad (Collapsible) */}
              {showNumpad && (
                <div className="p-2.5 bg-muted/40 rounded-xl border border-border/80 space-y-1.5 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-3 gap-1.5">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"].map((key) => (
                      <Button
                        key={key}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleNumpadPress(key)}
                        className="h-10 text-base font-bold font-mono cursor-pointer active:scale-95"
                      >
                        {key}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleNumpadPress("backspace")}
                      className="h-10 text-muted-foreground hover:text-rose-600 cursor-pointer active:scale-95"
                      title="ลบตัวเลข"
                    >
                      <Delete className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Change or Shortfall Display */}
              {isCashInsufficient ? (
                <div className="p-3.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-900 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">เงินยังไม่พอ</p>
                      <p className="text-xs text-rose-700">ขาดอีก ฿{cashCalc.shortfall.toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold font-mono text-rose-600">
                    -฿{cashCalc.shortfall.toLocaleString()}
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-emerald-800">เงินทอน (Change Due)</span>
                        {cashCalc.isExact && (
                          <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded-md font-semibold">
                            ยอดพอดี
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        {cashCalc.isExact ? "ไม่ต้องทอนเงิน" : "ทอนให้ลูกค้าตามรายการด้านล่าง"}
                      </p>
                    </div>
                    <span className="text-2xl font-extrabold font-mono text-emerald-700">
                      ฿{cashCalc.change.toLocaleString()}
                    </span>
                  </div>

                  {/* Denomination Dispensing Guide */}
                  {cashCalc.denominations.length > 0 && (
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5 text-primary" />
                          รายการเงินทอนที่ต้องจัด (Dispense Guide)
                        </span>
                        <span className="font-mono text-[10px]">
                          รวม {cashCalc.denominations.reduce((acc, d) => acc + d.count, 0)} ชิ้น
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cashCalc.denominations.map((denom) => (
                          <div
                            key={denom.value}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium font-mono ${
                              denom.type === "banknote"
                                ? "bg-blue-50 border-blue-200 text-blue-900"
                                : "bg-amber-50 border-amber-200 text-amber-900"
                            }`}
                          >
                            <span>{denom.label}</span>
                            <span className="font-bold text-foreground">× {denom.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Accidental Typo Warning Banner */}
              {hugeOverpayment && (
                <div className="p-2.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">โปรดตรวจสอบจำนวนเงิน</p>
                    <p className="text-amber-700 text-[11px]">
                      ยอดเงินที่รับมา (฿{cashReceived.toLocaleString()}) สูงกว่ายอดชำระเกิน 10 เท่า
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* PromptPay QR Payment Method */
            <div className="space-y-3 pt-2">
              {/* Dynamic vs Static Mode Toggle */}
              <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchMode("dynamic")}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-center ${
                    qrMode === "dynamic"
                      ? "bg-white text-primary font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dynamic (ยอดตรง ฿{totalAmount.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("static")}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer text-center ${
                    qrMode === "static"
                      ? "bg-white text-primary font-bold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Static (ใส่ยอดเอง)
                </button>
              </div>

              {/* Loading State */}
              {qrLoading ? (
                <div className="h-64 flex flex-col items-center justify-center p-6 bg-muted/20 rounded-2xl border border-dashed text-muted-foreground gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs">กำลังสร้าง Thai QR Payment...</span>
                </div>
              ) : qrError ? (
                /* Unconfigured or Error State */
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-center">
                  <div className="flex flex-col items-center gap-1.5 text-rose-800">
                    <AlertCircle className="h-6 w-6 text-rose-600" />
                    <span className="text-sm font-bold">ไม่สามารถสร้าง QR Code ได้</span>
                    <p className="text-xs text-rose-700">{qrError}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSettingsDialogOpen(true)}
                    className="border-rose-300 text-rose-800 hover:bg-rose-100 gap-1.5 text-xs mx-auto"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    ตั้งค่าพร้อมเพย์ร้านค้า
                  </Button>
                </div>
              ) : qrData ? (
                /* Real PromptPay QR Card */
                <div className="flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-blue-50/50 to-muted/20 rounded-2xl border border-border space-y-2.5">
                  {/* Official Thai QR Payment Box */}
                  <div className="w-52 bg-white p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center relative">
                    {/* Thai QR Top Banner */}
                    <div className="w-full bg-[#003B71] text-white py-1 px-2 rounded-t-lg text-center flex flex-col items-center mb-1">
                      <span className="text-[10px] font-extrabold tracking-wider">
                        THAI QR PAYMENT
                      </span>
                      <span className="text-[8px] opacity-80 leading-none">
                        พร้อมเพย์ (PromptPay)
                      </span>
                    </div>

                    {/* High-Resolution QR Code */}
                    <div className="p-1 bg-white flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrData.qrDataUrl}
                        alt="PromptPay QR Code"
                        className="w-40 h-40 object-contain rounded"
                      />
                    </div>

                    {/* Amount locked indicator or manual input notice */}
                    <div className="w-full mt-1 pt-1 border-t border-dashed border-gray-200 text-center">
                      {qrMode === "dynamic" ? (
                        <div className="text-sm font-mono font-black text-gray-900 tracking-tight">
                          ฿{totalAmount.toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-[11px] font-semibold text-blue-700 bg-blue-50 py-0.5 rounded px-2">
                          ให้ลูกค้าใส่ยอด ฿{totalAmount.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Merchant & Account Info */}
                  <div className="w-full bg-white p-2.5 rounded-xl border text-xs space-y-1">
                    <div className="flex justify-between items-center text-foreground font-semibold">
                      <span className="truncate">{qrData.merchantInfo.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                        {qrData.merchantInfo.maskedId}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5 border-t border-dashed">
                      <span>เลขที่อ้างอิง:</span>
                      <span className="font-mono font-bold text-foreground">
                        {qrData.referenceNo}
                      </span>
                    </div>
                  </div>

                  {/* Freshness & Quick Controls */}
                  <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground px-1">
                    <div className="flex items-center gap-1">
                      {generatedAt && (
                        <span>สร้างเมื่อ {generatedAt.toLocaleTimeString("th-TH")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyPayload}
                        className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title="คัดลอก EMVCo Payload"
                      >
                        {copiedPayload ? (
                          <>
                            <CheckCheck className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>คัดลอกโค้ด</span>
                          </>
                        )}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => fetchPromptPayQr(qrMode)}
                        disabled={qrLoading}
                        className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>สร้างใหม่</span>
                      </button>
                    </div>
                  </div>

                  {/* Cashier Safety Tip */}
                  <div className="w-full p-2 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      ตรวจสอบสลิปโอนเงินของลูกค้าและยอดเงิน <strong>฿{totalAmount.toLocaleString()}</strong> ก่อนกดยืนยันชำระเงิน
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex-row gap-2 justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={
                isCashInsufficient ||
                isSubmitting ||
                (method === "promptpay" && (!qrData || qrLoading))
              }
              className="flex-1 gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  ยืนยันชำระเงิน
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onSettingsSaved={() => {
          if (method === "promptpay") {
            fetchPromptPayQr(qrMode);
          }
        }}
      />
    </>
  );
}
