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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Item } from "../../../types/item"
import { Plus, X } from "lucide-react"

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    item_name: "",
    item_price: "",
    item_amount: "",
    item_barcode: "",
    item_images: "",
  })

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/items")
        const json = await res.json()
        if (Array.isArray(json)) setItems(json)
      } catch (err) {
        console.error(err)
      }
    }
    fetchItems()
  }, [])

  const reloadItems = async () => {
    try {
      const res = await fetch("/api/items")
      const json = await res.json()
      if (Array.isArray(json)) setItems(json)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: form.item_name,
          item_price: Number(form.item_price),
          item_amount: Number(form.item_amount),
          item_barcode: form.item_barcode,
          item_images: form.item_images || undefined,
        }),
      })

      if (res.ok) {
        setForm({ item_name: "", item_price: "", item_amount: "", item_barcode: "", item_images: "" })
        setShowForm(false)
        await reloadItems()
      } else {
        const data = await res.json()
        alert(data.error || "ไม่สามารถเพิ่มสินค้าได้")
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-sm text-muted-foreground">จัดการและตรวจสอบรายการสินค้าในร้านค้า</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2 self-start sm:self-auto">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showForm ? "ปิดแบบฟอร์ม" : "เพิ่มสินค้า"}</span>
        </Button>
      </div>

      {showForm && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">แบบฟอร์มเพิ่มสินค้าใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">ชื่อสินค้า *</label>
                <Input
                  required
                  placeholder="เช่น เป๊ปซี่ 325ml"
                  value={form.item_name}
                  onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">ราคา (บาท) *</label>
                <Input
                  required
                  type="number"
                  min="0"
                  placeholder="20"
                  value={form.item_price}
                  onChange={(e) => setForm({ ...form, item_price: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">จำนวนในคลัง *</label>
                <Input
                  required
                  type="number"
                  min="0"
                  placeholder="10"
                  value={form.item_amount}
                  onChange={(e) => setForm({ ...form, item_amount: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">รหัสบาร์โค้ด *</label>
                <Input
                  required
                  placeholder="เช่น pepsi325"
                  value={form.item_barcode}
                  onChange={(e) => setForm({ ...form, item_barcode: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">URL หรือ Path รูปภาพ (ไม่บังคับ)</label>
                <Input
                  placeholder="/uploads/items/coca_cola_325ml.jpg"
                  value={form.item_images}
                  onChange={(e) => setForm({ ...form, item_images: e.target.value })}
                />
              </div>

              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "กำลังบันทึก..." : "บันทึกสินค้า"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="p-0 overflow-hidden border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold text-right">Price</TableHead>
              <TableHead className="font-semibold text-right">Amount</TableHead>
              <TableHead className="font-semibold">Barcode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item: Item) => (
                <TableRow key={item.item_id}>
                  <TableCell>
                    {item.item_images ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.item_images}
                        alt={item.item_name}
                        className="h-10 w-10 object-contain rounded-md border p-0.5 bg-white"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                        -
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell className="text-right font-mono">{item.item_price} ฿</TableCell>
                  <TableCell className="text-right font-mono">{item.item_amount}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{item.item_barcode}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
