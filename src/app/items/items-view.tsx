"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2, AlertCircle, Loader2, ImageIcon, Pencil, Trash2 } from "lucide-react";
import type { Item } from "@/types/item";

export default function ItemsView({ initialItems = [] }: { initialItems?: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    item_name: "",
    item_price: "",
    item_amount: "",
    item_barcode: "",
  });

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/items");
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenDialog = () => {
    setEditingItem(null);
    setFormData({
      item_name: "",
      item_price: "",
      item_amount: "",
      item_barcode: "",
    });
    setFormError("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormError("");
  };

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      item_price: String(item.item_price),
      item_amount: String(item.item_amount),
      item_barcode: item.item_barcode,
    });
    setFormError("");
    setIsDialogOpen(true);
  };

  const handleDeleteClick = async (item: Item) => {
    if (!window.confirm("ยืนยันการลบสินค้าหรือไม่?")) {
      return;
    }

    try {
      const res = await fetch(`/api/items/${item.item_id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
        setNotification({
          type: "success",
          message: `ลบสินค้า "${item.item_name}" สำเร็จแล้ว`,
        });
        setTimeout(() => setNotification(null), 3500);
      } else {
        setNotification({
          type: "error",
          message: result.error || "เกิดข้อผิดพลาดในการลบสินค้า",
        });
        setTimeout(() => setNotification(null), 3500);
      }
    } catch {
      setNotification({
        type: "error",
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
      });
      setTimeout(() => setNotification(null), 3500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.item_name.trim()) {
      setFormError("กรุณากรอกชื่อสินค้า");
      return;
    }
    const price = Number(formData.item_price);
    if (isNaN(price) || price < 0 || formData.item_price === "") {
      setFormError("กรุณากรอกราคาที่ถูกต้อง");
      return;
    }
    const amount = Number(formData.item_amount);
    if (isNaN(amount) || amount < 0 || formData.item_amount === "") {
      setFormError("กรุณากรอกจำนวนสต็อกที่ถูกต้อง");
      return;
    }
    if (!formData.item_barcode.trim()) {
      setFormError("กรุณากรอกรหัสบาร์โค้ด");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        const res = await fetch(`/api/items/${editingItem.item_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_name: formData.item_name.trim(),
            item_price: price,
            item_amount: amount,
            item_barcode: formData.item_barcode.trim(),
          }),
        });

        const result = await res.json();
        if (result.success && result.item) {
          setItems((prev) =>
            prev.map((i) => (i.item_id === editingItem.item_id ? result.item : i))
          );
          setIsDialogOpen(false);
          setEditingItem(null);
          setNotification({
            type: "success",
            message: `แก้ไขสินค้า "${result.item.item_name}" สำเร็จแล้ว`,
          });
          setTimeout(() => setNotification(null), 3500);
        } else {
          setFormError(result.error || "เกิดข้อผิดพลาดในการบันทึก");
        }
      } else {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_name: formData.item_name.trim(),
            item_price: price,
            item_amount: amount,
            item_barcode: formData.item_barcode.trim(),
          }),
        });

        const result = await res.json();
        if (result.success && result.item) {
          setItems((prev) => [result.item, ...prev]);
          setIsDialogOpen(false);
          setNotification({
            type: "success",
            message: `เพิ่มสินค้า "${result.item.item_name}" สำเร็จแล้ว`,
          });
          setTimeout(() => setNotification(null), 3500);
        } else {
          setFormError(result.error || "เกิดข้อผิดพลาดในการบันทึก");
        }
      }
    } catch {
      setFormError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            คลังสินค้า
          </h1>
          <p className="text-sm text-muted-foreground">
            จัดการและตรวจสอบสต็อกสินค้าทั้งหมด ({items.length} รายการ)
          </p>
        </div>

        <Button
          onClick={handleOpenDialog}
          className="gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มสินค้า</span>
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
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
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

      {/* Table Card */}
      <Card className="overflow-hidden p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[64px]">รูปสินค้า</TableHead>
                <TableHead className="w-[80px]">รหัส</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead className="w-[180px]">รหัสบาร์โค้ด</TableHead>
                <TableHead className="text-right w-[120px]">ราคา (฿)</TableHead>
                <TableHead className="text-right w-[140px]">
                  จำนวนคงเหลือ
                </TableHead>
                <TableHead className="text-center w-[100px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    กำลังโหลดข้อมูลสินค้า...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    ไม่มีข้อมูลสินค้าในคลัง
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: Item) => (
                  <TableRow key={item.item_id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="h-10 w-10 rounded-md border border-gray-100 bg-white overflow-hidden flex items-center justify-center">
                        {item.item_image ? (
                          <img
                            src={item.item_image}
                            alt={item.item_name}
                            className="h-full w-full object-contain p-0.5"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{item.item_id}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {item.item_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.item_barcode}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      {item.item_price.toLocaleString()} ฿
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.item_amount <= 5
                            ? "bg-rose-100 text-rose-800"
                            : item.item_amount <= 15
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.item_amount} ชิ้น
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="แก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(item)}
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Item Dialog Modal */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
          } else {
            setIsDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingItem ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {editingItem
                  ? "แก้ไขรายละเอียดของสินค้าในระบบคลัง"
                  : "กรอกข้อมูลรายละเอียดของสินค้าเพื่อเพิ่มเข้าสู่ระบบคลัง"}
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="item_name" className="text-xs font-semibold">
                  ชื่อสินค้า <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="item_name"
                  placeholder="เช่น Pepsi Max 325ml"
                  value={formData.item_name}
                  onChange={(e) =>
                    setFormData({ ...formData, item_name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="item_price" className="text-xs font-semibold">
                    ราคา (บาท) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_price"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="20"
                    value={formData.item_price}
                    onChange={(e) =>
                      setFormData({ ...formData, item_price: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="item_amount" className="text-xs font-semibold">
                    จำนวนสต็อก <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="item_amount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="50"
                    value={formData.item_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, item_amount: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="item_barcode" className="text-xs font-semibold">
                  รหัสบาร์โค้ด <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="item_barcode"
                  placeholder="เช่น 885002900121"
                  value={formData.item_barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, item_barcode: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : editingItem ? (
                  "บันทึกการแก้ไข"
                ) : (
                  "บันทึกสินค้า"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}