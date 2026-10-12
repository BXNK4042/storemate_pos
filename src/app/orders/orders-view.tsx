"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  RefreshCw,
  Eye,
  Calendar,
  Package,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Banknote,
  FileText,
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReceiptModal, ReceiptOrder } from "@/components/receipt-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface OrderSummary {
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
  total_quantity: number;
}

export default function OrdersView({ initialOrders = [] }: { initialOrders?: OrderSummary[] }) {
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [fetchingDetail, setFetchingDetail] = useState(false);

  // Refund dialog state
  const [refundTarget, setRefundTarget] = useState<OrderSummary | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewReceipt = async (orderId: number) => {
    setFetchingDetail(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success && data.order) {
        setSelectedOrder(data.order);
        setReceiptOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch order detail:", err);
    } finally {
      setFetchingDetail(false);
    }
  };

  const handleDownloadTxt = (orderId: number, orderName: string) => {
    const a = document.createElement("a");
    a.href = `/api/orders/${orderId}/receipt?format=txt&download=true`;
    a.download = `receipt-${orderName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadEscPos = (orderId: number, orderName: string) => {
    const a = document.createElement("a");
    a.href = `/api/orders/${orderId}/receipt?format=escpos&download=true`;
    a.download = `receipt-${orderName}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenRefund = (order: OrderSummary) => {
    setRefundTarget(order);
    setRefundReason("");
    setRefundDialogOpen(true);
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const res = await fetch(`/api/orders/${refundTarget.order_id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({
          type: "success",
          message: `คืนเงินคำสั่งซื้อ #${refundTarget.order_id} สำเร็จ และคืนสต็อกสินค้าเรียบร้อยแล้ว`,
        });
        setRefundDialogOpen(false);
        setRefundTarget(null);
        setRefundReason("");
        await fetchOrders();
      } else {
        setNotification({
          type: "error",
          message: data.error || "ไม่สามารถทำรายการคืนเงินได้",
        });
      }
    } catch (err) {
      console.error("Failed to refund order:", err);
      setNotification({
        type: "error",
        message: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setRefunding(false);
    }
  };

  const filteredOrders = orders.filter((o) =>
    o.order_name.toLowerCase().includes(search.toLowerCase()) ||
    String(o.order_id).includes(search)
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            ประวัติการขาย
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            รายการคำสั่งซื้อทั้งหมด การจัดการการคืนเงิน และการออกใบเสร็จย้อนหลัง
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรช
        </Button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาเลขที่คำสั่งซื้อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-primary" />
            <span>คำสั่งซื้อ: <strong className="text-foreground">{orders.length}</strong> รายการ</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-20">เลขที่</TableHead>
              <TableHead>รหัสอ้างอิง</TableHead>
              <TableHead>วัน-เวลาทำรายการ</TableHead>
              <TableHead className="text-center w-28">สถานะ</TableHead>
              <TableHead className="text-center">จำนวนชิ้น</TableHead>
              <TableHead className="text-right">ยอดรวม (฿)</TableHead>
              <TableHead className="text-center min-w-[260px]">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    กำลังโหลดข้อมูล...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {search ? "ไม่พบคำสั่งซื้อที่ตรงกับคำค้นหา" : "ยังไม่มีประวัติการขาย"}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const isRefunded = order.status === "refunded";
                return (
                  <TableRow key={order.order_id} className="hover:bg-muted/30">
                    <TableCell className="font-mono font-medium text-xs text-muted-foreground">
                      #{order.order_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">
                          {order.order_name}
                        </span>
                        {order.payment_method === "promptpay" ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              <QrCode className="h-3 w-3 shrink-0" />
                              PromptPay {order.promptpay_type === "static" ? "Static" : "Dynamic"}
                            </span>
                            {order.promptpay_ref && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {order.promptpay_ref}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <Banknote className="h-3 w-3 shrink-0 text-emerald-600" />
                              <span>รับ ฿{(order.amount_paid ?? order.order_price).toLocaleString()}</span>
                              <span className="text-emerald-400">|</span>
                              <span>ทอน ฿{(order.change_amount ?? 0).toLocaleString()}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(order.created_at).toLocaleString("th-TH")}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isRefunded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          คืนเงินแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          สำเร็จ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        <Package className="h-3 w-3" />
                        {order.total_quantity} ชิ้น
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      <div className="flex flex-col items-end">
                        <span className={isRefunded ? "text-muted-foreground line-through" : ""}>
                          ฿{order.order_price.toLocaleString()}
                        </span>
                        {(order.discount_amount ?? 0) > 0 && (
                          <span className="text-[10px] font-normal text-rose-600">
                            ลด ฿{order.discount_amount?.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReceipt(order.order_id)}
                          disabled={fetchingDetail}
                          className="gap-1 h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                          title="ดูใบเสร็จ"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          ใบเสร็จ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadTxt(order.order_id, order.order_name)}
                          className="gap-1 h-8 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="ดาวน์โหลด TXT (Raw Text Receipt)"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600" />
                          TXT
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadEscPos(order.order_id, order.order_name)}
                          className="gap-1 h-8 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="ดาวน์โหลด ESC/POS (.bin)"
                        >
                          <FileDown className="h-3.5 w-3.5 text-amber-600" />
                          BIN
                        </Button>
                        {isRefunded ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="gap-1 h-8 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            คืนเงินแล้ว
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenRefund(order)}
                            className="gap-1 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            คืนเงิน
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog for Refund */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              ยืนยันการคืนเงิน
            </DialogTitle>
            <DialogDescription>
              คุณต้องการทำรายการคืนเงินสำหรับคำสั่งซื้อนี้ใช่หรือไม่? ระบบจะเปลี่ยนสถานะเป็น &quot;คืนเงินแล้ว&quot; และคืนสต็อกสินค้าทั้งหมดกลับเข้าสู่ระบบโดยอัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          {refundTarget && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-muted/50 p-3.5 rounded-lg border border-border/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เลขที่คำสั่งซื้อ:</span>
                  <span className="font-semibold text-foreground">
                    #{refundTarget.order_id} ({refundTarget.order_name})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">จำนวนสินค้า:</span>
                  <span className="font-medium text-foreground">
                    {refundTarget.total_quantity} ชิ้น
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดเงินที่ต้องคืน:</span>
                  <span className="font-bold text-rose-600">
                    ฿{refundTarget.order_price.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-reason">เหตุผลการคืนเงิน (ระบุหรือไม่ก็ได้)</Label>
                <Input
                  id="refund-reason"
                  placeholder="เช่น ลูกค้าขอคืนสินค้า, สินค้ามีตำหนิ, คิดเงินผิด"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={refunding}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={refunding}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRefund}
              disabled={refunding}
              className="gap-1.5"
            >
              {refunding ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  ยืนยันการคืนเงิน
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        order={selectedOrder}
      />
    </div>
  );
}