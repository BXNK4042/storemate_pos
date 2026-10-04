"use client";

import { useRef } from "react";
import { Printer, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export interface ReceiptItem {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
}

export interface ReceiptOrder {
  order_id: number;
  order_name: string;
  order_price: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  created_at: string;
  items: ReceiptItem[];
}

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ReceiptOrder | null;
}

export function ReceiptModal({ open, onOpenChange, order }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isPromptPay = order.payment_method === "promptpay";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 overflow-hidden">
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            ใบเสร็จรับเงิน
          </DialogTitle>
          <p className="text-xs text-muted-foreground text-center">
            StoreMate POS System
          </p>
        </DialogHeader>

        {/* Printable Receipt Section */}
        <div
          ref={receiptRef}
          className="print-receipt bg-muted/40 p-4 rounded-xl border border-border/80 text-xs font-mono space-y-3"
        >
          <div className="text-center border-b border-dashed border-border/80 pb-2">
            <p className="font-bold text-sm text-foreground">ร้านค้า StoreMate</p>
            <p className="text-muted-foreground">เลขที่: {order.order_name}</p>
            <p className="text-muted-foreground">
              วันที่: {new Date(order.created_at).toLocaleString("th-TH")}
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between font-bold text-muted-foreground text-[11px] pb-1 border-b border-border/40">
              <span className="w-1/2">รายการ</span>
              <span className="w-1/4 text-center">จำนวน</span>
              <span className="w-1/4 text-right">รวม (฿)</span>
            </div>

            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-foreground">
                <span className="w-1/2 truncate font-sans text-xs">
                  {item.item_name}
                </span>
                <span className="w-1/4 text-center">x{item.quantity}</span>
                <span className="w-1/4 text-right font-medium">
                  {item.subtotal.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ยอดรวมก่อนภาษี</span>
              <span>{(order.order_price * 0.93).toFixed(2)} ฿</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ภาษีมูลค่าเพิ่ม (7%)</span>
              <span>{(order.order_price * 0.07).toFixed(2)} ฿</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
              <span>ยอดสุทธิ</span>
              <span className="text-emerald-600 font-sans font-bold text-base">
                {order.order_price.toLocaleString()} ฿
              </span>
            </div>

            <div className="pt-2 border-t border-dashed border-border/80 space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>วิธีชำระ</span>
                <span className="font-semibold text-foreground">
                  {isPromptPay ? "พร้อมเพย์ QR" : "เงินสด"}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{isPromptPay ? "ยอดโอนชำระ" : "รับเงินมา"}</span>
                <span>
                  {(order.amount_paid ?? order.order_price).toLocaleString()} ฿
                </span>
              </div>
              {!isPromptPay && (
                <div className="flex justify-between font-bold text-foreground">
                  <span>เงินทอน</span>
                  <span>{(order.change_amount ?? 0).toLocaleString()} ฿</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-center pt-2 text-[10px] text-muted-foreground border-t border-dashed border-border/80">
            <p>ขอบคุณที่ใช้บริการ</p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 justify-end mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            ปิด
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="flex-1 gap-1.5"
          >
            <Printer className="h-4 w-4" />
            พิมพ์ใบเสร็จ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
