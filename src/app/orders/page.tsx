'use client'

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Order } from "../../../types/order"
import { Search, Receipt, Printer, ShoppingBag, DollarSign, Download } from "lucide-react"
import Link from "next/link"

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const fetchOrders = () => {
    setLoading(true)
    fetch("/api/orders?limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.orders)) {
          setOrders(data.orders)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch("/api/orders?limit=50")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.orders)) {
          setOrders(data.orders)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filteredOrders = orders.filter((order) => {
    const term = search.toLowerCase()
    const matchesId = String(order.order_id).includes(term)
    const matchesName = order.order_name.toLowerCase().includes(term)
    const matchesDate = (order.created_at || "").toLowerCase().includes(term)
    return matchesId || matchesName || matchesDate
  })

  const totalRevenue = orders.reduce((sum, o) => sum + o.order_price, 0)
  const totalItemsSold = orders.reduce(
    (sum, o) => sum + (o.items ? o.items.reduce((iSum, item) => iSum + item.quantity, 0) : 0),
    0
  )

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (orders.length === 0) return
    const headers = ["Order ID", "Date", "Items", "Total (THB)"]
    const rows = orders.map((o) => {
      const itemsStr = (o.items || [])
        .map((i) => `${i.item_name} (x${i.quantity})`)
        .join("; ")
      return [
        o.order_id,
        o.created_at || "",
        `"${itemsStr.replace(/"/g, '""')}"`,
        o.order_price,
      ].join(",")
    })
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `orders_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order History</h1>
          <p className="text-sm text-muted-foreground">ประวัติรายการคำสั่งซื้อและการขายสินค้าทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchOrders} disabled={loading} className="gap-2">
            <span>รีเฟรชข้อมูล</span>
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={orders.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            <span>ส่งออก CSV</span>
          </Button>
          <Button render={<Link href="/cashier" />} className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span>ไปที่แคชเชียร์</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">คำสั่งซื้อทั้งหมด</span>
            <div className="text-2xl font-bold font-mono">{orders.length}</div>
          </div>
          <Receipt className="h-8 w-8 text-muted-foreground/60" />
        </Card>
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">ยอดขายรวม (50 รายการล่าสุด)</span>
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {totalRevenue.toLocaleString()} ฿
            </div>
          </div>
          <DollarSign className="h-8 w-8 text-emerald-500/80" />
        </Card>
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">จำนวนชิ้นที่ขายได้</span>
            <div className="text-2xl font-bold font-mono">{totalItemsSold} ชิ้น</div>
          </div>
          <ShoppingBag className="h-8 w-8 text-muted-foreground/60" />
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาจากเลขที่คำสั่งซื้อ หรือ วันที่..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold w-24">Order ID</TableHead>
              <TableHead className="font-semibold">Order Title</TableHead>
              <TableHead className="font-semibold">Date & Time</TableHead>
              <TableHead className="font-semibold text-center">Items Count</TableHead>
              <TableHead className="font-semibold text-right">Total Price</TableHead>
              <TableHead className="font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  กำลังโหลดข้อมูลคำสั่งซื้อ...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ไม่พบรายการคำสั่งซื้อ
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const totalQty = (order.items || []).reduce((s, it) => s + it.quantity, 0)
                return (
                  <TableRow key={order.order_id}>
                    <TableCell className="font-mono font-semibold">#{order.order_id}</TableCell>
                    <TableCell className="font-medium">{order.order_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {order.created_at ? new Date(order.created_at).toLocaleString("th-TH") : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{totalQty} ชิ้น</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-sm">
                      {order.order_price.toLocaleString()} ฿
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setSelectedOrder(order)}
                        className="gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>ดูใบเสร็จ</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Receipt Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">ใบเสร็จรับเงิน (Receipt)</h3>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSelectedOrder(null)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            {/* Printable Receipt Paper */}
            <div id="receipt-paper" className="p-6 font-mono text-xs space-y-4 bg-card">
              <div className="text-center space-y-1">
                <div className="font-bold text-base tracking-wider uppercase font-sans">StoreMate POS</div>
                <div className="text-muted-foreground text-[11px]">ร้านสะดวกซื้อและสินค้าคุณภาพ</div>
                <div className="text-muted-foreground text-[10px]">Tax ID: 0105559012345</div>
              </div>

              <div className="border-t border-dashed my-3" />

              <div className="flex justify-between">
                <span>ใบเสร็จเลขที่:</span>
                <span className="font-bold">#{selectedOrder.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span>วันที่-เวลา:</span>
                <span>
                  {selectedOrder.created_at
                    ? new Date(selectedOrder.created_at).toLocaleString("th-TH")
                    : "-"}
                </span>
              </div>

              <div className="border-t border-dashed my-3" />

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex justify-between font-semibold text-muted-foreground pb-1 border-b">
                  <span>รายการ</span>
                  <span className="w-12 text-center">จำนวน</span>
                  <span className="w-16 text-right">รวม (฿)</span>
                </div>
                {(selectedOrder.items || []).map((item) => (
                  <div key={item.item_id} className="flex justify-between items-center py-0.5">
                    <div className="flex-1 truncate pr-2">
                      <div>{item.item_name}</div>
                      <div className="text-[10px] text-muted-foreground">@{item.item_price}฿</div>
                    </div>
                    <div className="w-12 text-center">{item.quantity}</div>
                    <div className="w-16 text-right font-semibold">
                      {(item.item_price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed my-3" />

              <div className="flex justify-between text-sm font-bold">
                <span>ยอดสุทธิ (Total):</span>
                <span>{selectedOrder.order_price.toLocaleString()} ฿</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-[10px]">
                <span>ราคารวมภาษีมูลค่าเพิ่ม 7% แล้ว</span>
                <span>{Math.round(selectedOrder.order_price * 0.07).toLocaleString()} ฿</span>
              </div>

              <div className="border-t border-dashed my-3" />

              <div className="text-center text-[10px] text-muted-foreground pt-1">
                ขอบคุณที่ใช้บริการ StoreMate
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t bg-muted/20 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                ปิดหน้าต่าง
              </Button>
              <Button onClick={handlePrintReceipt} className="gap-2">
                <Printer className="h-4 w-4" />
                <span>พิมพ์ใบเสร็จ</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
