"use client";

import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  History,
  Loader2,
  Calendar,
  User,
  ArrowRight,
  RefreshCw,
  Hash,
  MessageSquare,
} from "lucide-react";
import type { Item } from "@/types/item";
import type { StockAdjustmentRecord } from "@/types/stock";
import { StockReasonBadge } from "./stock-reason-badge";
import { parseDbDate } from "@/lib/date-utils";

interface ItemStockHistorySheetProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemStockHistorySheet({
  item,
  open,
  onOpenChange,
}: ItemStockHistorySheetProps) {
  const [history, setHistory] = useState<StockAdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.item_id}/adjustments?limit=50`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setHistory(data.data);
      } else {
        setError(data.error || "ไม่สามารถโหลดประวัติสต็อกได้");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!open || !item) return;
      try {
        const res = await fetch(`/api/items/${item.item_id}/adjustments?limit=50`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && Array.isArray(data.data)) {
            setHistory(data.data);
          } else {
            setError(data.error || "ไม่สามารถโหลดประวัติสต็อกได้");
          }
        }
      } catch {
        if (!ignore) {
          setError("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (open && item) {
      void load();
    }
    return () => {
      ignore = true;
    };
  }, [open, item]);

  const formatDate = (dateStr: string) => {
    try {
      const d = parseDbDate(dateStr);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col h-full bg-white overflow-hidden"
      >
        <SheetHeader className="p-6 pb-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <History className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">ประวัติการเคลื่อนไหวสต็อก</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  บันทึกรายการปรับยอดสต็อกย้อนหลัง
                </SheetDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHistory}
              disabled={loading}
              className="h-8 w-8 p-0 cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {item && (
            <div className="mt-3 p-3 rounded-xl bg-white border shadow-xs flex items-center justify-between gap-2">
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold bg-muted text-gray-800 font-mono">
                  {item.item_amount} ชิ้น
                </span>
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">กำลังโหลดประวัติสต็อก...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 text-xs">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistory}
                className="mt-3 text-xs cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </Button>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm font-medium">ยังไม่มีประวัติการปรับสต็อก</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                การเปลี่ยนแปลงสต็อกทั้งหมดจะถูกบันทึกอัตโนมัติที่นี่
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-muted">
              {history.map((record) => {
                const isPositive = record.change_qty > 0;
                const isZero = record.change_qty === 0;

                return (
                  <div key={record.adjustment_id} className="relative group">
                    {/* Bullet marker */}
                    <div
                      className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${
                        isPositive
                          ? "bg-emerald-500 ring-emerald-200"
                          : isZero
                          ? "bg-gray-400 ring-gray-200"
                          : "bg-rose-500 ring-rose-200"
                      }`}
                    />

                    <div className="p-3.5 rounded-xl border bg-card hover:bg-muted/10 transition-colors shadow-xs space-y-2">
                      {/* Top row: Reason badge and delta */}
                      <div className="flex items-center justify-between gap-2">
                        <StockReasonBadge reason={record.reason} />
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                            isPositive
                              ? "bg-emerald-100 text-emerald-800"
                              : isZero
                              ? "bg-gray-100 text-gray-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isPositive ? `+${record.change_qty}` : record.change_qty} ชิ้น
                        </span>
                      </div>

                      {/* Stock transition indicator */}
                      <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
                        <span>ก่อนหน้า: {record.previous_qty}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-semibold text-foreground">
                          คงเหลือ: {record.new_qty}
                        </span>
                      </div>

                      {/* Note if present */}
                      {record.note && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-700 bg-amber-50/60 border border-amber-200/60 p-2 rounded-md">
                          <MessageSquare className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="italic">{record.note}</span>
                        </div>
                      )}

                      {/* Footer metadata: Author, Ref, Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {record.user_name && (
                            <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                              <User className="h-3 w-3" />
                              {record.user_name}
                            </span>
                          )}
                          {record.reference_id && (
                            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-gray-600">
                              <Hash className="h-2.5 w-2.5" />
                              {record.reference_id}
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 text-[10px]">
                          <Calendar className="h-3 w-3" />
                          {formatDate(record.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
