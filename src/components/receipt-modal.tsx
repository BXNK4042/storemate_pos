"use client";

import { useRef, useState, useMemo } from "react";
import {
  Printer,
  CheckCircle2,
  RotateCcw,
  Copy,
  Check,
  Download,
  FileDown,
  FileText,
  LayoutTemplate,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTextReceipt, generateEscPosReceipt } from "@/lib/receipt";
import { formatThaiDateTime } from "@/lib/date-utils";

export interface ReceiptItem {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  final_price?: number;
}

export interface ReceiptOrder {
  order_id: number;
  order_name: string;
  order_price: number;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  promptpay_type?: "dynamic" | "static" | null;
  promptpay_ref?: string | null;
  promptpay_payload?: string | null;
  status?: string;
  refund_reason?: string | null;
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
  const [previewMode, setPreviewMode] = useState<"visual" | "txt">("visual");
  const [txtWidth, setTxtWidth] = useState<32 | 42>(32);
  const [copied, setCopied] = useState(false);

  const txtReceipt = useMemo(() => {
    if (!order) return "";
    return formatTextReceipt(order, { width: txtWidth });
  }, [order, txtWidth]);

  if (!order) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyTxt = async () => {
    if (!txtReceipt) return;
    try {
      await navigator.clipboard.writeText(txtReceipt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy receipt text:", err);
    }
  };

  const handleDownloadTxt = () => {
    if (!order) return;
    const blob = new Blob([txtReceipt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${order.order_name}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadEscPos = () => {
    if (!order) return;
    const escposBytes = generateEscPosReceipt(order, { width: txtWidth });
    const blob = new Blob([escposBytes as unknown as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${order.order_name}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isPromptPay = order.payment_method === "promptpay";
  const isRefunded = order.status === "refunded";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="text-center shrink-0">
          <div
            className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full mb-2 ${
              isRefunded
                ? "bg-rose-100 text-rose-600"
                : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isRefunded ? (
              <RotateCcw className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            ใบเสร็จรับเงิน
          </DialogTitle>
          {isRefunded && (
            <div className="mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                คืนเงินแล้ว
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            StoreMate POS System
          </p>
        </DialogHeader>

        {/* View Switcher Controls */}
        <div className="flex items-center justify-between gap-2 border-b pb-2 pt-1 shrink-0">
          <div className="inline-flex rounded-lg bg-muted p-1 text-muted-foreground text-xs font-medium">
            <button
              type="button"
              onClick={() => setPreviewMode("visual")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                previewMode === "visual"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground"
              }`}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              ใบเสร็จทั่วไป
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("txt")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                previewMode === "txt"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              ดูข้อความ (TXT)
            </button>
          </div>

          {previewMode === "txt" && (
            <div className="inline-flex items-center rounded-lg bg-muted p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTxtWidth(32)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  txtWidth === 32
                    ? "bg-background font-bold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setTxtWidth(42)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  txtWidth === 42
                    ? "bg-background font-bold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                80mm
              </button>
            </div>
          )}
        </div>

        {/* Receipt Content Area */}
        <div className="overflow-y-auto flex-1 my-2 pr-0.5 space-y-3">
          {previewMode === "visual" ? (
            /* Printable Visual Receipt Section */
            <div
              ref={receiptRef}
              className="print-receipt bg-muted/40 p-4 rounded-xl border border-border/80 text-xs font-mono space-y-3"
            >
              {/* Prominent Refund Notice */}
              {isRefunded && (
                <div className="bg-rose-50 border-2 border-dashed border-rose-400 rounded-lg p-2.5 text-center text-rose-900">
                  <div className="text-rose-700 font-bold text-sm tracking-wider">
                    *** ยกเลิก / คืนเงินแล้ว ***
                  </div>
                  {order.refund_reason && (
                    <div className="text-xs text-rose-600 mt-1 font-sans font-medium">
                      เหตุผล: {order.refund_reason}
                    </div>
                  )}
                </div>
              )}

              <div className="text-center border-b border-dashed border-border/80 pb-2">
                <p className="font-bold text-sm text-foreground">ร้านค้า StoreMate</p>
                <p className="text-muted-foreground">เลขที่: {order.order_name}</p>
                <p className="text-muted-foreground">
                  วันที่: {formatThaiDateTime(order.created_at)}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between font-bold text-muted-foreground text-[11px] pb-1 border-b border-border/40">
                  <span className="w-1/2">รายการ</span>
                  <span className="w-1/4 text-center">จำนวน</span>
                  <span className="w-1/4 text-right">รวม (฿)</span>
                </div>

                {order.items.map((item, idx) => {
                  const itemTotal =
                    item.final_price !== undefined ? item.final_price : item.subtotal;
                  const hasItemDiscount = (item.discount_amount ?? 0) > 0;

                  return (
                    <div key={idx} className="text-foreground">
                      <div className="flex justify-between">
                        <span className="w-1/2 truncate font-sans text-xs">
                          {item.item_name}
                        </span>
                        <span className="w-1/4 text-center">x{item.quantity}</span>
                        <span className="w-1/4 text-right font-medium">
                          {itemTotal.toLocaleString()}
                        </span>
                      </div>
                      {hasItemDiscount && (
                        <div className="flex justify-between text-[10px] text-rose-600 pl-2">
                          <span>
                            ↳ ส่วนลด
                            {item.discount_type === "percentage"
                              ? ` (${item.discount_value}%)`
                              : ""}
                            :
                          </span>
                          <span>-{item.discount_amount?.toLocaleString()} ฿</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-1 pt-1">
                {/* Raw items subtotal before order-level discount */}
                {order.subtotal !== undefined && order.subtotal !== order.order_price && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>ยอดรวมสินค้า</span>
                    <span>{order.subtotal.toLocaleString()} ฿</span>
                  </div>
                )}

                {/* Order-level discount */}
                {(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-rose-600 font-medium">
                    <span>
                      ส่วนลดท้ายบิล
                      {order.discount_type === "percentage"
                        ? ` (${order.discount_value}%)`
                        : ""}
                    </span>
                    <span>-{order.discount_amount?.toLocaleString()} ฿</span>
                  </div>
                )}

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
                  <span
                    className={`font-sans font-bold text-base ${
                      isRefunded ? "text-rose-600 line-through" : "text-emerald-600"
                    }`}
                  >
                    {order.order_price.toLocaleString()} ฿
                  </span>
                </div>

                <div className="pt-2 border-t border-dashed border-border/80 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>สถานะ</span>
                    <span
                      className={`font-semibold ${
                        isRefunded ? "text-rose-600 font-bold" : "text-emerald-600"
                      }`}
                    >
                      {isRefunded ? "คืนเงินแล้ว" : "ชำระเงินสำเร็จ"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>วิธีชำระ</span>
                    <span className="font-semibold text-foreground">
                      {isPromptPay ? "พร้อมเพย์ (PromptPay QR)" : "เงินสด"}
                    </span>
                  </div>
                  {isPromptPay && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>รูปแบบ QR</span>
                        <span className="font-medium text-foreground">
                          {order.promptpay_type === "static"
                            ? "Static QR (ใส่ยอดเอง)"
                            : "Dynamic QR (ยอดตรง)"}
                        </span>
                      </div>
                      {order.promptpay_ref && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>รหัสอ้างอิง QR</span>
                          <span className="font-mono font-bold text-foreground">
                            {order.promptpay_ref}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{isPromptPay ? "ยอดโอนชำระ" : "รับเงินสด"}</span>
                    <span>
                      {(order.amount_paid ?? order.order_price).toLocaleString()} ฿
                    </span>
                  </div>
                  {!isPromptPay && (
                    <div className="flex justify-between font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>เงินทอน</span>
                        {(order.change_amount === 0 ||
                          (order.amount_paid ?? order.order_price) ===
                            order.order_price) && (
                          <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                            ยอดพอดี
                          </span>
                        )}
                      </div>
                      <span className="font-mono">
                        {(order.change_amount ?? 0).toLocaleString()} ฿
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-muted-foreground border-t border-dashed border-border/80">
                <p>ขอบคุณที่ใช้บริการ</p>
              </div>
            </div>
          ) : (
            /* Monospace Plain TXT Preview Section */
            <div className="space-y-2">
              <pre className="bg-zinc-950 text-zinc-100 dark:bg-zinc-900 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed select-all border border-border">
                {txtReceipt}
              </pre>
            </div>
          )}
        </div>

        {/* Quick Export Controls */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1 border-t shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyTxt}
            className="gap-1.5 h-8 text-xs flex-1 min-w-[105px]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "คัดลอกแล้ว!" : "คัดลอก TXT"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTxt}
            className="gap-1.5 h-8 text-xs flex-1 min-w-[115px]"
          >
            <Download className="h-3.5 w-3.5" />
            ดาวน์โหลด TXT
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadEscPos}
            className="gap-1.5 h-8 text-xs flex-1 min-w-[135px]"
          >
            <FileDown className="h-3.5 w-3.5" />
            ดาวน์โหลด ESC/POS
          </Button>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="flex-row gap-2 justify-end mt-1 shrink-0">
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
