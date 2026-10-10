"use client";

import { useEffect, useState, useCallback } from "react";
import { Receipt, Search, RefreshCw, Eye, Calendar, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
            รายการคำสั่งซื้อทั้งหมดและการออกใบเสร็จย้อนหลัง
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
              <TableHead className="w-24">เลขที่</TableHead>
              <TableHead>รหัสอ้างอิง</TableHead>
              <TableHead>วัน-เวลาทำรายการ</TableHead>
              <TableHead className="text-center">จำนวนชิ้น</TableHead>
              <TableHead className="text-right">ยอดรวม (฿)</TableHead>
              <TableHead className="text-center w-28">ใบเสร็จ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    กำลังโหลดข้อมูล...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {search ? "ไม่พบคำสั่งซื้อที่ตรงกับคำค้นหา" : "ยังไม่มีประวัติการขาย"}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.order_id} className="hover:bg-muted/30">
                  <TableCell className="font-mono font-medium text-xs text-muted-foreground">
                    #{order.order_id}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {order.order_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(order.created_at).toLocaleString("th-TH")}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      <Package className="h-3 w-3" />
                      {order.total_quantity} ชิ้น
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground">
                    ฿{order.order_price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewReceipt(order.order_id)}
                      disabled={fetchingDetail}
                      className="gap-1.5 h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      ดูใบเสร็จ
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        order={selectedOrder}
      />
    </div>
  );
}