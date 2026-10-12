"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Search,
  Package,
} from "lucide-react";
import type { Item } from "@/types/item";
import type { WasteReason, WasteRecord } from "@/types/waste";
import { WASTE_REASON_CONFIG } from "./waste-reason-badge";

interface WasteLogDialogProps {
  item?: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (result: { waste: WasteRecord; remainingStock: number }) => void;
}

export function WasteLogDialog({
  item: initialItem,
  open,
  onOpenChange,
  onSuccess,
}: WasteLogDialogProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(initialItem || null);
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<WasteReason>("damaged");
  const [unitCost, setUnitCost] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Sync initialItem when changed or dialog opens
  useEffect(() => {
    if (open) {
      setSelectedItem(initialItem || null);
      setQuantity("1");
      setReason("damaged");
      setNotes("");
      setErrorMessage("");
      if (initialItem) {
        setUnitCost(String(initialItem.item_price));
      } else {
        setUnitCost("");
        // Load items for selection
        setIsLoadingItems(true);
        fetch("/api/items")
          .then((res) => res.json())
          .then((data) => {
            if (data.success && Array.isArray(data.items)) {
              setItemsList(data.items);
            }
          })
          .catch((err) => console.error("Failed to load items list", err))
          .finally(() => setIsLoadingItems(false));
      }
    }
  }, [open, initialItem]);

  // When selectedItem changes, update unitCost default
  useEffect(() => {
    if (selectedItem) {
      setUnitCost(String(selectedItem.item_price));
    }
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return itemsList.slice(0, 8);
    const term = searchTerm.toLowerCase();
    return itemsList
      .filter(
        (i) =>
          i.item_name.toLowerCase().includes(term) ||
          i.item_barcode.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [itemsList, searchTerm]);

  const currentStock = selectedItem?.item_amount ?? 0;
  const parsedQty = parseInt(quantity, 10);
  const parsedCost = parseFloat(unitCost);

  const { isValid, validationError, totalLoss } = useMemo(() => {
    if (!selectedItem) {
      return { isValid: false, validationError: "กรุณาเลือกสินค้าที่จะบันทึกของเสีย", totalLoss: 0 };
    }

    if (currentStock <= 0) {
      return { isValid: false, validationError: "สินค้านี้หมดสต็อกแล้ว (คงเหลือ 0 ชิ้น)", totalLoss: 0 };
    }

    if (quantity === "" || isNaN(parsedQty) || parsedQty <= 0) {
      return { isValid: false, validationError: "จำนวนของเสียต้องมากกว่า 0", totalLoss: 0 };
    }

    if (parsedQty > currentStock) {
      return {
        isValid: false,
        validationError: `สต็อกคงเหลือไม่เพียงพอ (มี ${currentStock} ชิ้น, ต้องการตัดออก ${parsedQty} ชิ้น)`,
        totalLoss: 0,
      };
    }

    const costPerUnit = isNaN(parsedCost) || parsedCost < 0 ? selectedItem.item_price : parsedCost;
    const loss = parsedQty * costPerUnit;

    return { isValid: true, validationError: "", totalLoss: loss };
  }, [selectedItem, currentStock, quantity, parsedQty, unitCost, parsedCost]);

  const handleQuickAdd = (delta: number) => {
    const cur = parseInt(quantity, 10) || 0;
    const next = Math.max(1, Math.min(currentStock, cur + delta));
    setQuantity(String(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !selectedItem) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: selectedItem.item_id,
          quantity: parsedQty,
          reason,
          unit_cost: !isNaN(parsedCost) && parsedCost >= 0 ? parsedCost : selectedItem.item_price,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess?.(json.data);
        onOpenChange(false);
      } else {
        setErrorMessage(json.error || "ไม่สามารถบันทึกรายการของเสียได้");
      }
    } catch {
      setErrorMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <DialogHeader className="p-6 pb-4 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">บันทึกของเสีย (Log Waste)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  ตัดยอดสต็อกสินค้าชำรุด เน่าเสีย หรือหมดอายุ พร้อมบันทึกมูลค่าความเสียหาย
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Item Selection */}
            {!initialItem && !selectedItem ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700">
                  ค้นหาและเลือกสินค้า <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาด้วยชื่อสินค้า หรือ รหัสบาร์โค้ด..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                {isLoadingItems ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    กำลังโหลดสินค้า...
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto bg-white text-xs">
                    {filteredItems.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground">ไม่พบสินค้า</div>
                    ) : (
                      filteredItems.map((it) => (
                        <button
                          key={it.item_id}
                          type="button"
                          onClick={() => setSelectedItem(it)}
                          className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-gray-900 truncate">{it.item_name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              {it.item_barcode}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-muted-foreground block">คงเหลือ</span>
                            <span className="font-bold font-mono text-gray-800">
                              {it.item_amount} ชิ้น
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : selectedItem ? (
              <div className="p-3 rounded-xl bg-slate-50 border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-slate-500 shrink-0" />
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {selectedItem.item_name}
                    </p>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5 ml-5">
                    บาร์โค้ด: {selectedItem.item_barcode} | ราคาขาย: ฿{selectedItem.item_price}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                    สต็อกปัจจุบัน
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold bg-white border text-gray-800">
                    {selectedItem.item_amount} ชิ้น
                  </span>
                  {!initialItem && (
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="block text-[11px] text-blue-600 hover:underline mt-1 cursor-pointer"
                    >
                      เปลี่ยนสินค้า
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Waste Reason Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                สาเหตุของเสีย <span className="text-rose-500">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(WASTE_REASON_CONFIG) as WasteReason[]).map((r) => {
                  const cfg = WASTE_REASON_CONFIG[r];
                  const Icon = cfg.icon;
                  const isSelected = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? `${cfg.badgeClass} ring-1 ring-offset-1`
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Input with Steppers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="waste-qty" className="text-xs font-semibold text-gray-700">
                  จำนวนที่ตัดของเสีย (ชิ้น) <span className="text-rose-500">*</span>
                </Label>
                {selectedItem && (
                  <span className="text-[11px] text-muted-foreground">
                    สูงสุด {currentStock} ชิ้น
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="waste-qty"
                  type="number"
                  min="1"
                  max={currentStock || undefined}
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="font-mono text-base font-semibold"
                  required
                />
                <div className="flex items-center gap-1">
                  {[1, 5, 10].map((step) => (
                    <Button
                      key={step}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAdd(step)}
                      disabled={!selectedItem || currentStock <= 0}
                      className="h-9 px-2 text-xs font-medium cursor-pointer"
                    >
                      +{step}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(String(currentStock))}
                    disabled={!selectedItem || currentStock <= 0}
                    className="h-9 px-2 text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    ทั้งหมด
                  </Button>
                </div>
              </div>
            </div>

            {/* Unit Cost & Financial Loss Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="waste-cost" className="text-xs font-semibold text-gray-700">
                  ต้นทุนต่อหน่วย (บาท)
                </Label>
                <Input
                  id="waste-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={selectedItem ? String(selectedItem.item_price) : "0"}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  มูลค่าความเสียหายประเมิน
                </Label>
                <div className="h-9 rounded-md bg-rose-50/70 border border-rose-200 px-3 flex items-center justify-between text-xs">
                  <span className="text-rose-700 font-medium">รวมสูญเสีย</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    ฿{totalLoss.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="waste-notes" className="text-xs font-semibold text-gray-700">
                หมายเหตุ / รายละเอียดเหตุการณ์
              </Label>
              <textarea
                id="waste-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น หล่นแตกขณะจัดเรียงสินค้า, บรรจุภัณฑ์ฉีกขาด"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
            </div>

            {/* Inventory impact summary */}
            {selectedItem && (
              <div className="p-3 rounded-lg bg-slate-50 border text-xs flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-[11px]">คงเหลือปัจจุบัน</span>
                  <span className="font-semibold font-mono text-gray-900">{currentStock} ชิ้น</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="text-rose-600 font-bold">-{parsedQty || 0} ชิ้น</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-muted-foreground text-[11px]">คงเหลือหลังตัด</span>
                  <span className="font-bold font-mono text-emerald-700">
                    {Math.max(0, currentStock - (parsedQty || 0))} ชิ้น
                  </span>
                </div>
              </div>
            )}

            {/* Warning Banner */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">ข้อควรระวังในการตัดสต็อก</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  เมื่อกดยืนยัน ระบบจะตัดยอดสินค้าออกจากคลังทันที และบันทึกประวัติการปรับสต็อกโดยอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Error Message */}
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "ยืนยันการตัดของเสีย"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
