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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Item } from "../../../types/item"
import { Plus, X, Search, Pencil, Trash2, Package, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    item_name: "",
    item_price: "",
    item_amount: "",
    item_barcode: "",
    item_images: "",
  })

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/items")
      const json = await res.json()
      if (Array.isArray(json)) setItems(json)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetch("/api/items")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json)) setItems(json)
      })
      .catch((err) => console.error(err))
  }, [])

  const resetForm = () => {
    setForm({
      item_name: "",
      item_price: "",
      item_amount: "",
      item_barcode: "",
      item_images: "",
    })
    setEditingItemId(null)
    setShowForm(false)
  }

  const handleStartEdit = (item: Item) => {
    setEditingItemId(item.item_id)
    setForm({
      item_name: item.item_name,
      item_price: String(item.item_price),
      item_amount: String(item.item_amount),
      item_barcode: item.item_barcode,
      item_images: item.item_images || "",
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (itemId: number, itemName: string) => {
    if (!confirm(`คุณต้องการลบสินค้า "${itemName}" ใช่หรือไม่?`)) return

    try {
      const res = await fetch(`/api/items?id=${itemId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok && data.success) {
        await fetchItems()
      } else {
        alert(data.error || "เกิดข้อผิดพลาดในการลบสินค้า")
      }
    } catch {
      alert("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const isEditing = editingItemId !== null
      const endpoint = "/api/items"
      const method = isEditing ? "PUT" : "POST"
      const payload = {
        ...(isEditing ? { item_id: editingItemId } : {}),
        item_name: form.item_name,
        item_price: Number(form.item_price),
        item_amount: Number(form.item_amount),
        item_barcode: form.item_barcode,
        item_images: form.item_images || undefined,
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        resetForm()
        await fetchItems()
      } else {
        const data = await res.json()
        alert(data.error || "ไม่สามารถบันทึกสินค้าได้")
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(
    (i) =>
      i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      i.item_barcode.toLowerCase().includes(search.toLowerCase())
  )

  const totalSKUs = items.length
  const totalUnits = items.reduce((sum, i) => sum + i.item_amount, 0)
  const lowStockCount = items.filter((i) => i.item_amount <= 5).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Items</h1>
          <p className="text-sm text-muted-foreground">จัดการและตรวจสอบรายการสินค้าในคลัง</p>
        </div>
        <Button
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              resetForm()
              setShowForm(true)
            }
          }}
          className="gap-2 self-start sm:self-auto"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{showForm ? "ปิดแบบฟอร์ม" : "เพิ่มสินค้า"}</span>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">รายการสินค้าทั้งหมด</span>
            <div className="text-2xl font-bold font-mono">{totalSKUs}</div>
          </div>
          <Package className="h-8 w-8 text-muted-foreground/60" />
        </Card>
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">จำนวนสินค้าในสต็อก</span>
            <div className="text-2xl font-bold font-mono">{totalUnits} ชิ้น</div>
          </div>
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/60" />
        </Card>
        <Card className="p-4 border flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground font-medium">สินค้าสต็อกต่ำ (≤ 5)</span>
            <div className="text-2xl font-bold font-mono text-amber-600">{lowStockCount}</div>
          </div>
          <AlertTriangle className="h-8 w-8 text-amber-500/80" />
        </Card>
      </div>

      {showForm && (
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {editingItemId !== null ? "แก้ไขรายการสินค้า" : "แบบฟอร์มเพิ่มสินค้าใหม่"}
            </CardTitle>
            <CardDescription>
              {editingItemId !== null
                ? `กำลังแก้ไขรหัสสินค้า #${editingItemId}`
                : "กรอกข้อมูลสินค้าเพื่อบันทึกลงในระบบคลัง"}
            </CardDescription>
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
                  {loading ? "กำลังบันทึก..." : editingItemId !== null ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}
                </Button>
                {editingItemId !== null && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    ยกเลิก
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาสินค้าจากชื่อ หรือ รหัสบาร์โค้ด..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="p-0 overflow-hidden border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Image</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Barcode</TableHead>
              <TableHead className="font-semibold text-right">Price</TableHead>
              <TableHead className="font-semibold text-right">Stock</TableHead>
              <TableHead className="font-semibold text-center">Status</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  ไม่พบรายการสินค้า
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item: Item) => (
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
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.item_barcode}</TableCell>
                  <TableCell className="text-right font-mono">{item.item_price} ฿</TableCell>
                  <TableCell className="text-right font-mono font-medium">{item.item_amount}</TableCell>
                  <TableCell className="text-center">
                    {item.item_amount === 0 ? (
                      <Badge variant="destructive">หมด</Badge>
                    ) : item.item_amount <= 5 ? (
                      <Badge variant="secondary" className="border-amber-300 text-amber-700 bg-amber-50">
                        ใกล้หมด
                      </Badge>
                    ) : (
                      <Badge variant="outline">พร้อมขาย</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleStartEdit(item)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="แก้ไขสินค้า"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleDelete(item.item_id, item.item_name)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        title="ลบสินค้า"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
