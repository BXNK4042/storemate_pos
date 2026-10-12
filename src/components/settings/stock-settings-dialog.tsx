"use client";

import React, { useState, useEffect } from "react";
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
import { SlidersHorizontal, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface StockSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (newThreshold: number) => void;
}

export function StockSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: StockSettingsDialogProps) {
  const [threshold, setThreshold] = useState<string>("5");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleClose = () => {
    setErrorMessage("");
    setSuccessMessage("");
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/stock");
        const data = await res.json();
        if (!cancelled && data.success && typeof data.defaultThreshold === "number") {
          setThreshold(String(data.defaultThreshold));
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("ไม่สามารถโหลดการตั้งค่าเกณฑ์สต็อกได้");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const parsed = parseInt(threshold.trim(), 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
      setErrorMessage("กรุณาระบุจำนวนเต็มระหว่าง 1 ถึง 1,000 ชิ้น");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/stock", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultThreshold: parsed }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage("บันทึกเกณฑ์สต็อกเริ่มต้นสำเร็จ");
        onSaved?.(data.defaultThreshold);
        setTimeout(() => {
          handleClose();
        }, 800);
      } else {
        setErrorMessage(data.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  ตั้งค่าเกณฑ์สต็อกเริ่มต้น
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  กำหนดจำนวนสินค้าขั้นต่ำที่ระบบจะเริ่มแจ้งเตือน &quot;สต็อกใกล้หมด&quot;
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="stock_default_threshold" className="text-xs font-semibold">
                เกณฑ์แจ้งเตือนสต็อกขั้นต่ำเริ่มต้นของร้านค้า (ชิ้น) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stock_default_threshold"
                type="number"
                min="1"
                max="1000"
                step="1"
                disabled={isLoading || isSaving}
                placeholder="5"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                สินค้าที่ไม่ได้ระบุเกณฑ์แจ้งเตือนเฉพาะตัวจะใช้ค่านี้ในการตรวจจับสต็อกต่ำ (ค่าแนะนำ: 5 - 10 ชิ้น)
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="cursor-pointer"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isSaving}
              className="cursor-pointer bg-primary text-primary-foreground"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกการตั้งค่า"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
