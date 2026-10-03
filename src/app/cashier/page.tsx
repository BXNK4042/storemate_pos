'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Item } from '@/types/item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';

interface CartItem {
  item: Item;
  quantity: number;
}

export default function CashierPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    id: string;
    total: number;
  } | null>(null);

  // Load items from API
  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/items');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Cart operations
  const addToCart = useCallback((item: Item) => {
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.item.item_id === item.item_id);
      if (existing) {
        return prevCart.map((ci) =>
          ci.item.item_id === item.item_id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      }
      return [...prevCart, { item, quantity: 1 }];
    });
    setCompletedOrder(null);
  }, []);

  const updateQuantity = (itemId: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((ci) => {
          if (ci.item.item_id === itemId) {
            const nextQty = ci.quantity + delta;
            return nextQty > 0 ? { ...ci, quantity: nextQty } : null;
          }
          return ci;
        })
        .filter((ci): ci is CartItem => ci !== null)
    );
  };

  const removeFromCart = (itemId: number) => {
    setCart((prevCart) => prevCart.filter((ci) => ci.item.item_id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setCompletedOrder(null);
  };

  // Poll barcode scanner and auto-add item
  const checkBarcodeScanner = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const json = await res.json();
      const scannedCode = (json.text || '').trim();

      if (!scannedCode || scannedCode === 'No data') return;

      const matched = items.find(
        (it) => it.item_barcode.toLowerCase() === scannedCode.toLowerCase()
      );

      if (matched) {
        addToCart(matched);
        setNotification({
          type: 'success',
          message: `สแกนบาร์โค้ดสำเร็จ: เพิ่ม "${matched.item_name}" แล้ว`,
        });
      } else {
        setNotification({
          type: 'error',
          message: `ไม่พบสินค้าตรงกับบาร์โค้ด: ${scannedCode}`,
        });
      }

      await fetch('/api/data', { method: 'DELETE' });

      setTimeout(() => {
        setNotification(null);
      }, 3500);
    } catch (err) {
      console.error('Barcode scanner check failed:', err);
    }
  }, [items, addToCart]);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(checkBarcodeScanner, 1200);
    return () => clearInterval(interval);
  }, [items, checkBarcodeScanner]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.item_name.toLowerCase().includes(q) ||
        it.item_barcode.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Calculate totals
  const totalAmount = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.item.item_price * ci.quantity, 0),
    [cart]
  );
  const totalItemsCount = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.quantity, 0),
    [cart]
  );

  // Confirm order
  const handleConfirmOrder = async () => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const payload = cart.map((ci) => ({
        item_id: ci.item.item_id,
        item_name: ci.item.item_name,
        item_price: ci.item.item_price,
        quantity: ci.quantity,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });

      const data = await res.json();
      if (data.success) {
        setCompletedOrder({
          id: data.order.order_name,
          total: data.order.order_price,
        });
        setCart([]);
        setNotification({
          type: 'success',
          message: `ชำระเงินสำเร็จ! เลขที่ ${data.order.order_name}`,
        });
        loadItems();
      } else {
        setNotification({
          type: 'error',
          message: `เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถบันทึกรายการได้'}`,
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อบันทึกรายการได้',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header - Clean without border/card wrapper */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">แคชเชียร์</h1>
        <p className="text-sm text-muted-foreground">
          ค้นหาหรือสแกนบาร์โค้ดเพื่อเพิ่มสินค้าลงในรายการ
        </p>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
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

      {/* Completed Order Banner */}
      {completedOrder && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-emerald-900">บันทึกการขายสำเร็จ</h4>
              <p className="text-xs text-emerald-700">
                เลขที่: {completedOrder.id} • ยอดชำระ: {completedOrder.total.toLocaleString()} ฿
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            onClick={() => setCompletedOrder(null)}
          >
            เริ่มรายการใหม่
          </Button>
        </div>
      )}

      {/* Main Grid: Left = Search + Products, Right = Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Search + Products (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ค้นหาชื่อสินค้า หรือ รหัสบาร์โค้ด..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-10 text-sm bg-white"
            />
          </div>

          {/* Product Cards Grid - Compact Layout */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <Card
                key={item.item_id}
                className="p-0 py-0 gap-0 overflow-hidden flex flex-col justify-between hover:border-gray-400 transition-colors"
              >
                {/* Product Image - 400x400 white bg */}
                <div className="relative h-20 w-full bg-white flex items-center justify-center overflow-hidden">
                  {item.item_image ? (
                    <img
                      src={item.item_image}
                      alt={item.item_name}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 stroke-[1.5] text-muted-foreground/50" />
                  )}
                </div>

                <div className="p-2.5 pt-2 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      #{item.item_barcode}
                    </div>
                    <h3 className="text-xs font-semibold leading-tight line-clamp-1 mt-0.5 text-foreground">
                      {item.item_name}
                    </h3>
                    <div className="text-[10px] text-muted-foreground">
                      คงเหลือ: {item.item_amount} ชิ้น
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-base font-black text-foreground tracking-tight">
                      {item.item_price.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">฿</span>
                    </span>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[11px] cursor-pointer"
                      onClick={() => addToCart(item)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      เพิ่ม
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <p className="text-sm">ไม่พบสินค้าที่ตรงกับการค้นหา &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Summary Card (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">รายการสินค้า</CardTitle>
                <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                  {totalItemsCount} ชิ้น
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  ยังไม่มีสินค้าในรายการ
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {cart.map((ci) => (
                    <div
                      key={ci.item.item_id}
                      className="flex items-center justify-between gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {ci.item.item_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ci.item.item_price.toLocaleString()} ฿ × {ci.quantity}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => updateQuantity(ci.item.item_id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-semibold">
                          {ci.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 cursor-pointer"
                          onClick={() => updateQuantity(ci.item.item_id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                          onClick={() => removeFromCart(ci.item.item_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex-col gap-4 border-t p-4 pt-4">
              <div className="flex justify-between items-baseline w-full">
                <span className="text-sm font-medium text-muted-foreground">ยอดรวม</span>
                <span className="text-2xl font-bold tracking-tight">
                  {totalAmount.toLocaleString()} ฿
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={clearCart}
                  disabled={cart.length === 0 || isProcessing}
                >
                  ล้างรายการ
                </Button>
                <Button
                  className="cursor-pointer"
                  onClick={handleConfirmOrder}
                  disabled={cart.length === 0 || isProcessing}
                >
                  {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันรายการ'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
