"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banknote, QrCode, AlertCircle, Check, Loader2 } from "lucide-react";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (paymentInfo: {
    method: "cash" | "promptpay";
    amountPaid: number;
    change: number;
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

  // Sync cashReceived with totalAmount when dialog opens
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashReceived(totalAmount);
    }
  }, [open, totalAmount]);

  const change = Math.max(0, cashReceived - totalAmount);
  const isCashInsufficient = method === "cash" && cashReceived < totalAmount;

  const handleQuickCash = (amount: number) => {
    setCashReceived(amount);
  };

  const handleAddCash = (increment: number) => {
    setCashReceived((prev) => prev + increment);
  };

  const handleConfirm = async () => {
    if (isCashInsufficient || isSubmitting) return;

    await onConfirm({
      method,
      amountPaid: method === "cash" ? cashReceived : totalAmount,
      change: method === "cash" ? change : 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
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

        {/* Content based on method */}
        {method === "cash" ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                รับเงินมา (฿)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={cashReceived === 0 ? "" : cashReceived}
                  onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                  className="text-lg font-mono font-bold pr-10"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ฿
                </span>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickCash(totalAmount)}
                className="text-xs"
              >
                พอดี
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickCash(100)}
                className="text-xs font-mono"
              >
                100
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickCash(500)}
                className="text-xs font-mono"
              >
                500
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickCash(1000)}
                className="text-xs font-mono"
              >
                1,000
              </Button>
            </div>

            {/* Change or Shortfall Display */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-sm ${
                isCashInsufficient
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              {isCashInsufficient ? (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>เงินยังไม่พอ (ขาดอีก {(totalAmount - cashReceived).toLocaleString()} ฿)</span>
                </div>
              ) : (
                <>
                  <span className="font-medium text-emerald-800">เงินทอน</span>
                  <span className="text-xl font-bold font-mono text-emerald-700">
                    {change.toLocaleString()} ฿
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-2xl border border-dashed border-border space-y-3">
            <div className="w-44 h-44 bg-white p-3 rounded-xl border shadow-xs flex flex-col items-center justify-center relative">
              <div className="absolute top-2 left-2 right-2 text-[10px] font-bold text-center text-blue-900 bg-blue-50 py-0.5 rounded">
                THAI QR PAYMENT
              </div>
              {/* Standard SVG QR Representation */}
              <div className="mt-4 p-2 bg-black rounded-sm flex items-center justify-center">
                <QrCode className="h-28 w-28 text-white" />
              </div>
              <div className="text-[11px] font-mono font-bold mt-1 text-gray-800">
                ฿{totalAmount.toLocaleString()}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              สแกน QR ผ่าน Mobile Banking เพื่อชำระเงิน
            </p>
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
            disabled={isCashInsufficient || isSubmitting}
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
  );
}
