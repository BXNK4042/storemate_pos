'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Item } from '@/types/item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PackagePlus,
  Plus,
  Minus,
  Trash2,
  ScanLine,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Search,
  Check,
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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [lastCommittedInfo, setLastCommittedInfo] = useState<{
    count: number;
    totalQuantity: number;
  } | null>(null);

  // Fetch catalog items to resolve current stock
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

  // Manual barcode scanning / adding
  const handleManualAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan',
          mode: 'stock',
          barcode: code,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBarcodeInput('');
        setNotification({
          type: 'success',
          message: `เพิ่ม "${data.name}" (+1) ลงในรายการรับเข้าแล้ว`,
        });
        if (Array.isArray(data.items)) {
          setStockCart(data.items);
        }
      } else {
        setNotification({
          type: 'error',
          message: data.error || `ไม่พบสินค้าบาร์โค้ด: ${code}`,
        });
      }
    } catch {
      setNotification({
        type: 'error',
        message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้',
      });
    }

    setTimeout(() => setNotification(null), 3500);
  };

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
      {/* Sleek High-Contrast Industrial Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-8 opacity-10 pointer-events-none select-none text-slate-100">
          <Layers className="h-48 w-48" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
              <span className="text-xs text-slate-400 font-mono tracking-wider">
                MODE: STOCK_INTAKE
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <PackagePlus className="h-7 w-7 text-emerald-400" />
              Stock Intake / รับเข้าสต็อก
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              สแกนบาร์โค้ดด้วยเครื่องสแกนเนอร์ ESP32 หรือป้อนรหัสบาร์โค้ดโดยตรงเพื่อเพิ่มสต็อกสินค้า
            </p>
          </div>

          {/* Quick Metrics Counter */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                รายการสินค้า
              </span>
              <span className="text-2xl font-black text-white font-mono">
                {totalItemCount}
              </span>
            </div>
            <div className="bg-emerald-950/60 border border-emerald-600/40 rounded-xl px-4 py-2.5 text-center min-w-[110px]">
              <span className="block text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                จำนวนชิ้นรวม
              </span>
              <span className="text-2xl font-black text-emerald-300 font-mono">
                +{totalUnitCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Banner */}
      {notification && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : notification.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
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
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
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

      {/* Manual Barcode Input Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleManualAdd} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <ScanLine className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="สแกนบาร์โค้ด หรือ พิมพ์รหัสบาร์โค้ดแล้วกดเพิ่ม..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-10 pr-4 h-11 text-sm bg-background font-mono"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              disabled={!barcodeInput.trim()}
              className="w-full sm:w-auto h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              เพิ่มเข้ารายการ
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Staged Items Table / Cards */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>รายการรับเข้าสต็อกที่กำลังเตรียมบันทึก (Staged Items)</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-800">
                  {totalItemCount}
                </span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                รายการจะถูกซิงค์แบบสดกับบาร์โค้ดสแกนเนอร์ สามารถปรับจำนวนหรือลบรายการก่อนยืนยันได้
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={stockCart.length === 0 || isSubmitting}
                className="text-xs h-9 text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-300 cursor-pointer gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ล้างรายการทั้งหมด
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRestock}
                disabled={stockCart.length === 0 || isSubmitting}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-1.5 shadow-xs"
              >
                {isSubmitting ? (
                  <>กำลังบันทึก...</>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    ยืนยันรับเข้าสต็อก (+{totalUnitCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {stockCart.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <ScanLine className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                ยังไม่มีรายการรับเข้าสต็อก
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                สแกนบาร์โค้ดด้วยเครื่องอ่าน ESP32 หรือกรอกรหัสบาร์โค้ดด้านบนเพื่อเตรียมสต็อกเข้าสู่ระบบ
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                    <th className="py-3 px-4">สินค้า</th>
                    <th className="py-3 px-4 font-mono">บาร์โค้ด</th>
                    <th className="py-3 px-4 text-right">สต็อกเดิม</th>
                    <th className="py-3 px-4 text-center">จำนวนรับเข้า</th>
                    <th className="py-3 px-4 text-right">สต็อกใหม่</th>
                    <th className="py-3 px-4 text-center w-20">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockCart.map((ci, idx) => {
                    const catalogItem = itemsById.get(ci.item_id);
                    const currentStock = catalogItem ? catalogItem.item_amount : 0;
                    const newStock = currentStock + ci.quantity;

                    return (
                      <tr
                        key={ci.item_id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {ci.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            ราคาขาย: {ci.price?.toLocaleString()} ฿
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-600 text-xs">
                          {ci.barcode}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {currentStock}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-lg cursor-pointer text-slate-600"
                              onClick={() => handleUpdateQty(ci.barcode, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-10 text-center font-mono font-black text-sm text-emerald-600 bg-emerald-50 py-0.5 rounded border border-emerald-200">
                              +{ci.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-lg cursor-pointer text-slate-600"
                              onClick={() => handleUpdateQty(ci.barcode, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-mono">
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                              {newStock}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            onClick={() => handleRemoveRow(ci.barcode, ci.quantity)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {stockCart.length > 0 && (
          <CardFooter className="bg-slate-50/50 border-t border-slate-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              กำลังแสดง <span className="font-bold text-slate-700">{totalItemCount}</span> รายการ
              รวมเพิ่มสต็อกทั้งหมด <span className="font-bold text-emerald-600">+{totalUnitCount}</span> ชิ้น
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={isSubmitting}
                className="text-xs cursor-pointer"
              >
                ล้างรายการ
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRestock}
                disabled={isSubmitting}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-1.5 shadow-xs"
              >
                {isSubmitting ? 'กำลังบันทึก...' : `ยืนยันรับเข้าสต็อก (+${totalUnitCount} ชิ้น)`}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
