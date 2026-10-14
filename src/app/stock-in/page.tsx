'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Item } from '@/types/item';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PackagePlus,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  History,
  Package,
  Check,
  ImageIcon,
} from 'lucide-react';

interface StockCartItem {
  item_id: number;
  name: string;
  price: number;
  barcode: string;
  quantity: number;
  subtotal: number;
  updated_at: string;
}

export default function StockInPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stockCart, setStockCart] = useState<StockCartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [lastCommittedInfo, setLastCommittedInfo] = useState<{
    count: number;
    totalQuantity: number;
  } | null>(null);

  // Fetch catalog items to resolve current stock and item images
  const loadCatalogItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load items catalog:', err);
    }
  }, []);

  useEffect(() => {
    loadCatalogItems();
  }, [loadCatalogItems]);

  // Create a map from item_id and barcode for quick lookups
  const itemsById = useMemo(() => {
    const map = new Map<number, Item>();
    for (const it of items) {
      map.set(it.item_id, it);
    }
    return map;
  }, [items]);

  const itemsByBarcode = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of items) {
      if (it.item_barcode) {
        map.set(it.item_barcode.toLowerCase().trim(), it);
      }
    }
    return map;
  }, [items]);

  // Polling GET /api/data?mode=stock every 500ms
  const pollStockCart = useCallback(async () => {
    try {
      const res = await fetch('/api/data?mode=stock', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      if (Array.isArray(data.items)) {
        setStockCart(data.items);
      }

      // Check if a new barcode was scanned via hardware scanner
      const scannedCode = (data.text || '').trim();
      if (scannedCode && scannedCode !== 'No data') {
        const matched = itemsByBarcode.get(scannedCode.toLowerCase());
        if (matched) {
          setNotification({
            type: 'success',
            message: `สแกนบาร์โค้ดสำเร็จ: เพิ่ม "${matched.item_name}" ในรายการรับเข้าแล้ว`,
          });
        } else {
          setNotification({
            type: 'warning',
            message: `สแกนบาร์โค้ด: ${scannedCode} (ยังไม่มีสินค้าในระบบ)`,
          });
        }
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err) {
      console.error('Error polling stock cart:', err);
    }
  }, [itemsByBarcode]);

  useEffect(() => {
    const interval = setInterval(pollStockCart, 500);
    return () => clearInterval(interval);
  }, [pollStockCart]);

  // Total summary calculations
  const totalItemCount = stockCart.length;
  const totalUnitCount = useMemo(
    () => stockCart.reduce((sum, ci) => sum + ci.quantity, 0),
    [stockCart]
  );
  const totalValue = useMemo(
    () => stockCart.reduce((sum, ci) => sum + (ci.price || 0) * ci.quantity, 0),
    [stockCart]
  );

  // Adjust item quantity in stock mode
  const handleUpdateQty = async (barcode: string, delta: number) => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: delta < 0 ? 'delete' : 'update_qty',
          mode: 'stock',
          barcode: barcode,
          quantity: Math.abs(delta),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.items)) {
        setStockCart(data.items);
      }
    } catch (err) {
      console.error('Failed to update qty:', err);
    }
  };

  // Remove whole row from stock mode
  const handleRemoveRow = async (barcode: string, currentQty: number) => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          mode: 'stock',
          barcode: barcode,
          quantity: currentQty,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.items)) {
        setStockCart(data.items);
      }
    } catch (err) {
      console.error('Failed to remove item row:', err);
    }
  };

  // Clear stock cart
  const handleClear = async () => {
    try {
      const res = await fetch('/api/data?clear_cart=true&mode=stock', {
        method: 'DELETE',
      });
      if (res.ok) {
        setStockCart([]);
        setNotification({
          type: 'warning',
          message: 'ล้างรายการรับเข้าสต็อกทั้งหมดแล้ว',
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'ไม่สามารถล้างรายการได้',
      });
    }
  };

  // Commit stock intake
  const handleConfirmRestock = async () => {
    if (stockCart.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stock-in/commit', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStockCart([]);
        setLastCommittedInfo({
          count: data.count,
          totalQuantity: data.totalQuantity,
        });
        setNotification({
          type: 'success',
          message: `รับเข้าสต็อกสำเร็จ! เพิ่มสต็อก ${data.count} รายการ (${data.totalQuantity} ชิ้น)`,
        });
        // Reload fresh stock balances
        loadCatalogItems();
      } else {
        setNotification({
          type: 'error',
          message: data.error || 'เกิดข้อผิดพลาดในการบันทึกรับเข้าสต็อก',
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อบันทึกได้',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <span>รับเข้าสต็อก</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            สแกนบาร์โค้ดเพื่อรับสินค้าเข้าคลังและปรับปรุงจำนวนสต็อกอัตโนมัติ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link href="/items">
            <Button
              variant="outline"
              className="gap-1.5 cursor-pointer text-gray-700 hover:text-gray-900"
            >
              <Package className="h-4 w-4 text-primary" />
              <span>คลังสินค้า</span>
            </Button>
          </Link>
          <Link href="/items/adjustments">
            <Button
              variant="outline"
              className="gap-1.5 cursor-pointer text-gray-700 hover:text-gray-900"
            >
              <History className="h-4 w-4 text-primary" />
              <span>ประวัติการปรับสต็อก</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Notifications Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : notification.type === 'warning' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
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

      {/* Last Committed Banner */}
      {lastCommittedInfo && !stockCart.length && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold text-emerald-950 text-sm">
                บันทึกการรับเข้าสต็อกเสร็จสมบูรณ์
              </h4>
              <p className="text-xs text-emerald-700">
                เพิ่มสินค้า {lastCommittedInfo.count} รายการ (+{lastCommittedInfo.totalQuantity} ชิ้น) เรียบร้อยแล้ว
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer text-xs"
            onClick={() => setLastCommittedInfo(null)}
          >
            ปิด
          </Button>
        </div>
      )}

      {/* Staged Intake Table */}
      <Card className="overflow-hidden p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[64px]">รูปภาพ</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead className="text-right w-[140px]">สต็อกปัจจุบัน</TableHead>
                <TableHead className="text-center w-[160px]">จำนวนรับเข้า</TableHead>
                <TableHead className="text-right w-[160px]">สต็อกหลังรับเข้า</TableHead>
                <TableHead className="text-center w-[80px]">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockCart.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center text-muted-foreground"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                      <PackagePlus className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      ยังไม่มีรายการรับเข้าสต็อก
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      สแกนบาร์โค้ดด้วยเครื่องสแกนเนอร์เพื่อเตรียมสต็อกเข้าสู่ระบบ
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                stockCart.map((ci) => {
                  const catalogItem = itemsById.get(ci.item_id);
                  const currentStock = catalogItem ? catalogItem.item_amount : 0;
                  const newStock = currentStock + ci.quantity;

                  return (
                    <TableRow key={ci.item_id} className="hover:bg-muted/30">
                      {/* Image Thumbnail */}
                      <TableCell>
                        <div className="h-10 w-10 rounded-md border border-gray-100 bg-white overflow-hidden flex items-center justify-center">
                          {catalogItem?.item_image ? (
                            <img
                              src={catalogItem.item_image}
                              alt={ci.name}
                              className="h-full w-full object-contain p-0.5"
                              loading="lazy"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                      </TableCell>

                      {/* Item Details */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground text-sm">
                            {ci.name}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded border border-border/50">
                              {ci.barcode}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ฿{ci.price?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Current Stock */}
                      <TableCell className="text-right font-mono font-medium text-muted-foreground text-sm">
                        {currentStock} ชิ้น
                      </TableCell>

                      {/* Staged Quantity with Stepper */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => handleUpdateQty(ci.barcode, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-12 text-center font-mono font-semibold text-sm text-emerald-600 bg-emerald-50 py-0.5 rounded border border-emerald-200">
                            +{ci.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-md cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => handleUpdateQty(ci.barcode, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>

                      {/* Resulting Stock Preview */}
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 font-mono text-xs bg-muted/60 border border-border/60 px-2.5 py-1 rounded-md">
                          <span className="text-muted-foreground">{currentStock}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold text-foreground">{newStock}</span>
                        </div>
                      </TableCell>

                      {/* Remove Button */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          onClick={() => handleRemoveRow(ci.barcode, ci.quantity)}
                          title="ลบรายการ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Table Footer with Commit Actions */}
          {stockCart.length > 0 && (
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-muted-foreground">
                กำลังแสดง <strong className="text-foreground">{totalItemCount}</strong> รายการ |
                รวมรับเข้าทั้งหมด <strong className="text-emerald-600 font-bold">+{totalUnitCount}</strong> ชิ้น
                (มูลค่ารวม ฿{totalValue.toLocaleString()})
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={isSubmitting}
                  className="text-xs h-9 cursor-pointer text-muted-foreground hover:text-rose-600 hover:bg-rose-50 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  ล้างรายการ
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmRestock}
                  disabled={isSubmitting}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer gap-1.5 shadow-xs"
                >
                  {isSubmitting ? (
                    'กำลังบันทึก...'
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      ยืนยันการรับเข้าสต็อก (+{totalUnitCount} ชิ้น)
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

