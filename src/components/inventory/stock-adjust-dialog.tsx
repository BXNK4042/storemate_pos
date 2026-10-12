"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Minus,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  ArrowRight,
  Package,
} from "lucide-react";
import type { Item } from "@/types/item";
import type { StockAdjustmentMode, StockAdjustmentReason } from "@/types/stock";
import { STOCK_REASON_CONFIG } from "./stock-reason-badge";

interface StockAdjustDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedItem: Item) => void;
}

const REASONS_BY_MODE: Record<StockAdjustmentMode, StockAdjustmentReason[]> = {
  add: ["restock", "other"],
  remove: ["damage", "expired", "loss", "other"],
  set: ["inventory_count", "correction", "other"],
};

interface StockAdjustFormProps {
  item: Item;
  onClose: () => void;
  onSuccess: (updatedItem: Item) => void;
}

function StockAdjustForm({ item, onClose, onSuccess }: StockAdjustFormProps) {
  const [mode, setMode] = useState<StockAdjustmentMode>("add");
  const [quantity, setQuantity] = useState<string>("1");
  const [reason, setReason] = useState<StockAdjustmentReason>("restock");
  const [referenceId, setReferenceId] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const prevQty = item.item_amount;
  const parsedQty = parseFloat(quantity) || 0;

  // Sync default reason when mode changes
  const handleModeChange = (newMode: StockAdjustmentMode) => {
    setMode(newMode);
    setErrorMessage("");
    const available = REASONS_BY_MODE[newMode];
    if (!available.includes(reason)) {
      setReason(available[0]);
    }
    if (newMode === "set") {
      setQuantity(String(item.item_amount));
    } else if (mode === "set") {
      setQuantity("1");
    }
  };

  const { delta, newQty, isValid, validationError } = useMemo(() => {
    if (quantity === "" || isNaN(parsedQty)) {
      return {
        delta: 0,
        newQty: prevQty,
        isValid: false,
        validationError: "กรุณาระบุจำนวนสินค้า",
      };
    }

    if (mode === "add") {
      if (parsedQty <= 0) {
        return {
          delta: 0,
          newQty: prevQty,
          isValid: false,
          validationError: "จำนวนที่เพิ่มต้องมากกว่า 0",
        };
      }
      return {
        delta: Math.floor(parsedQty),
        newQty: prevQty + Math.floor(parsedQty),
        isValid: true,
        validationError: "",
      };
    }

    if (mode === "remove") {
      if (parsedQty <= 0) {
        return {
          delta: 0,
          newQty: prevQty,
          isValid: false,
          validationError: "จำนวนที่ตัดออกต้องมากกว่า 0",
        };
      }
      if (prevQty - Math.floor(parsedQty) < 0) {
        return {
          delta: -Math.floor(parsedQty),
          newQty: prevQty - Math.floor(parsedQty),
          isValid: false,
          validationError: `สต็อกไม่เพียงพอ (มีเพียง ${prevQty} ชิ้น ไม่สามารถตัดออก ${Math.floor(parsedQty)} ชิ้น)`,
        };
      }
      return {
        delta: -Math.floor(parsedQty),
        newQty: prevQty - Math.floor(parsedQty),
        isValid: true,
        validationError: "",
      };
    }

    if (mode === "set") {
      if (parsedQty < 0) {
        return {
          delta: 0,
          newQty: prevQty,
          isValid: false,
          validationError: "จำนวนสต็อกใหม่ต้องไม่ติดลบ",
        };
      }
      const target = Math.floor(parsedQty);
      return {
        delta: target - prevQty,
        newQty: target,
        isValid: true,
        validationError: "",
      };
    }

    return { delta: 0, newQty: prevQty, isValid: false, validationError: "" };
  }, [mode, quantity, parsedQty, prevQty]);

  const handleQuickAdd = (amount: number) => {
    if (mode === "set") {
      setQuantity((prev) => String(Math.max(0, (parseInt(prev, 10) || 0) + amount)));
    } else {
      setQuantity((prev) => String(Math.max(1, (parseInt(prev, 10) || 0) + amount)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.item_id,
          mode,
          quantity: mode === "set" ? newQty : Math.abs(delta),
          reason,
          reference_id: referenceId.trim() || null,
          note: note.trim() || null,
        }),
      });

      const result = await res.json();
      if (result.success && result.item) {
        onSuccess({
          ...item,
          item_amount: result.item.item_amount,
        });
        onClose();
      } else {
        setErrorMessage(result.error || "เกิดข้อผิดพลาดในการปรับปรุงสต็อก");
      }
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <DialogHeader className="p-6 pb-4 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">ปรับยอดสต็อกสินค้า</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                บันทึกการเพิ่ม ลด หรือตรวจนับสินค้าพร้อมเหตุผลเข้าสู่สมุดประวัติ
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Item overview banner */}
        <div className="mt-4 p-3 rounded-xl bg-white border shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{item.item_name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              บาร์โค้ด: {item.item_barcode}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-muted-foreground block uppercase font-medium">
              สต็อกปัจจุบัน
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold bg-muted text-gray-800">
              {prevQty} ชิ้น
            </span>
          </div>
        </div>
      </DialogHeader>

      {/* Form Body */}
      <div className="p-6 space-y-5">
        {/* Mode selection buttons */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700">รูปแบบการปรับยอด</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("add")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                mode === "add"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
              <span>เพิ่มสต็อก (+)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("remove")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                mode === "remove"
                  ? "bg-rose-50 text-rose-800 border-rose-400 shadow-xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Minus className="h-3.5 w-3.5 text-rose-600" />
              <span>ตัดสต็อก (-)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("set")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                mode === "set"
                  ? "bg-blue-50 text-blue-800 border-blue-400 shadow-xs"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Package className="h-3.5 w-3.5 text-blue-600" />
              <span>ปรับยอดตรวจนับ (=)</span>
            </button>
          </div>
        </div>

        {/* Quantity Input with quick buttons */}
        <div className="space-y-2">
          <Label htmlFor="qty-input" className="text-xs font-semibold text-gray-700">
            {mode === "set" ? "ยอดสต็อกใหม่ที่นับได้ (ชิ้น)" : "จำนวนที่ต้องการปรับ (ชิ้น)"}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="qty-input"
              type="number"
              min={mode === "set" ? "0" : "1"}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="font-mono text-base font-semibold"
              required
            />
            <div className="flex items-center gap-1">
              {[1, 5, 10, 50].map((step) => (
                <Button
                  key={step}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAdd(step)}
                  className="h-9 px-2 text-xs font-medium cursor-pointer"
                >
                  +{step}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Reason selector & Reference ID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="reason-select" className="text-xs font-semibold text-gray-700">
              เหตุผลในการปรับสต็อก <span className="text-red-500">*</span>
            </Label>
            <select
              id="reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value as StockAdjustmentReason)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              {REASONS_BY_MODE[mode].map((r) => (
                <option key={r} value={r}>
                  {STOCK_REASON_CONFIG[r]?.label || r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ref-input" className="text-xs font-semibold text-gray-700">
              เลขอ้างอิง (PO / ใบรับของ)
            </Label>
            <Input
              id="ref-input"
              placeholder="เช่น PO-2026-101"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Note Input */}
        <div className="space-y-1.5">
          <Label htmlFor="note-input" className="text-xs font-semibold text-gray-700">
            หมายเหตุเพิ่มเติม
          </Label>
          <Input
            id="note-input"
            placeholder="เช่น สินค้าแตกเสียหายขณะขนส่ง, ตรวจนับประจำเดือน"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* Live calculation preview card */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            สรุปการเปลี่ยนแปลงยอดคงเหลือ
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">คงเหลือเดิม</span>
              <span className="font-semibold text-gray-900 font-mono">{prevQty} ชิ้น</span>
            </div>

            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span
                className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                  delta > 0
                    ? "bg-emerald-100 text-emerald-800"
                    : delta < 0
                    ? "bg-rose-100 text-rose-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} ชิ้น
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center flex-col items-end">
              <span className="text-xs text-muted-foreground">คงเหลือใหม่</span>
              <span
                className={`font-mono font-bold text-base ${
                  newQty < 0 ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {newQty} ชิ้น
              </span>
            </div>
          </div>
        </div>

        {/* Validation or Error Message */}
        {(validationError || errorMessage) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{validationError || errorMessage}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <DialogFooter className="p-4 bg-muted/20 border-t gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          ยกเลิก
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            "ยืนยันการปรับสต็อก"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StockAdjustDialog({
  item,
  open,
  onOpenChange,
  onSuccess,
}: StockAdjustDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {open && (
          <StockAdjustForm
            key={`${item.item_id}-${open}`}
            item={item}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
