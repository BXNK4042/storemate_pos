'use client'

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Item } from '@/types/item';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Printer,
  AlertTriangle,
  Clock,
  Tag,
  Percent,
} from 'lucide-react';
import { ReceiptModal, type ReceiptOrder } from '@/components/receipt-modal';
import { PaymentDialog } from '@/components/payment-dialog';
import { getExpiryStatus, formatExpiryDate } from '@/lib/expiry';
import { getEffectiveThreshold } from '@/lib/stock-alerts-eval';

interface CartItem {
  item: Item;
  quantity: number;
  discountType?: 'percentage' | 'fixed' | 'none';
  discountValue?: number;
}

export default function CashierPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [defaultThreshold, setDefaultThreshold] = useState<number>(5);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    id: string;
    total: number;
  } | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrder | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [expiredItemToConfirm, setExpiredItemToConfirm] = useState<Item | null>(null);

  // Discount states
  const [orderDiscountType, setOrderDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [orderDiscountValue, setOrderDiscountValue] = useState<number>(0);
  const [orderDiscountDialogOpen, setOrderDiscountDialogOpen] = useState(false);
  const [tempOrderDiscountType, setTempOrderDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [tempOrderDiscountValue, setTempOrderDiscountValue] = useState<string>('');

  // Item discount modal states
  const [itemDiscountTarget, setItemDiscountTarget] = useState<CartItem | null>(null);
  const [tempItemDiscountType, setTempItemDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [tempItemDiscountValue, setTempItemDiscountValue] = useState<string>('');

  // Load items and stock settings from API
  const loadItems = useCallback(async () => {
    try {
      const [itemsRes, settingsRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/settings/stock'),
      ]);
      const data = await itemsRes.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (typeof settingsData.defaultThreshold === 'number') {
          setDefaultThreshold(settingsData.defaultThreshold);
        }
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [itemsRes, settingsRes] = await Promise.all([
          fetch('/api/items'),
          fetch('/api/settings/stock'),
        ]);
        const data = await itemsRes.json();
        if (!cancelled && data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
        if (!cancelled && settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (typeof settingsData.defaultThreshold === 'number') {
            setDefaultThreshold(settingsData.defaultThreshold);
          }
        }
      } catch (err) {
        console.error('Failed to load items:', err);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cart operations with stock validation and expiry check
  const addToCart = useCallback((item: Item, force = false) => {
    if (item.item_amount <= 0) {
      setNotification({
        type: 'error',
        message: `สินค้า "${item.item_name}" สินค้าหมด`,
      });
      return;
    }

    const expiry = getExpiryStatus(item.expiry_date);
    if (expiry.status === 'expired' && !force) {
      setExpiredItemToConfirm(item);
      return;
    }

    const effective = getEffectiveThreshold(item.low_stock_threshold, defaultThreshold);

    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.item.item_id === item.item_id);
      const currentCartQty = existing ? existing.quantity : 0;
      const nextQty = currentCartQty + 1;

      if (nextQty > item.item_amount) {
        setNotification({
          type: 'error',
          message: `สินค้า "${item.item_name}" มีสต็อกเพียง ${item.item_amount} ชิ้น`,
        });
        return prevCart;
      }

      const remaining = item.item_amount - nextQty;
      if (remaining <= effective && remaining > 0) {
        setNotification({
          type: 'warning',
          message: `แจ้งเตือนสต็อก: "${item.item_name}" สต็อกใกล้หมด (เหลือ ${remaining} ชิ้น)`,
        });
        setTimeout(() => setNotification(null), 3000);
      }

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
  }, [defaultThreshold]);

  const updateQuantity = (itemId: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((ci) => {
          if (ci.item.item_id === itemId) {
            const nextQty = ci.quantity + delta;
            if (delta > 0 && nextQty > ci.item.item_amount) {
              setNotification({
                type: 'error',
                message: `สินค้า "${ci.item.item_name}" มีสต็อกเพียง ${ci.item.item_amount} ชิ้น`,
              });
              return ci;
            }
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
    setOrderDiscountType('none');
    setOrderDiscountValue(0);
    setCompletedOrder(null);
  };

  const openItemDiscountDialog = (cartItem: CartItem) => {
    setItemDiscountTarget(cartItem);
    setTempItemDiscountType(cartItem.discountType === 'percentage' ? 'percentage' : 'fixed');
    setTempItemDiscountValue(cartItem.discountValue ? String(cartItem.discountValue) : '');
  };

  const applyItemDiscount = () => {
    if (!itemDiscountTarget) return;
    const val = parseFloat(tempItemDiscountValue) || 0;
    setCart((prevCart) =>
      prevCart.map((ci) => {
        if (ci.item.item_id === itemDiscountTarget.item.item_id) {
          if (val <= 0) {
            return { ...ci, discountType: 'none', discountValue: 0 };
          }
          return {
            ...ci,
            discountType: tempItemDiscountType,
            discountValue: val,
          };
        }
        return ci;
      })
    );
    setItemDiscountTarget(null);
  };

  const removeItemDiscount = (itemId: number) => {
    setCart((prevCart) =>
      prevCart.map((ci) =>
        ci.item.item_id === itemId
          ? { ...ci, discountType: 'none', discountValue: 0 }
          : ci
      )
    );
  };

  const openOrderDiscountDialog = () => {
    setTempOrderDiscountType(orderDiscountType === 'percentage' ? 'percentage' : 'fixed');
    setTempOrderDiscountValue(orderDiscountValue > 0 ? String(orderDiscountValue) : '');
    setOrderDiscountDialogOpen(true);
  };

  const applyOrderDiscount = () => {
    const val = parseFloat(tempOrderDiscountValue) || 0;
    if (val <= 0) {
      setOrderDiscountType('none');
      setOrderDiscountValue(0);
    } else {
      setOrderDiscountType(tempOrderDiscountType);
      setOrderDiscountValue(val);
    }
    setOrderDiscountDialogOpen(false);
  };

  const removeOrderDiscount = () => {
    setOrderDiscountType('none');
    setOrderDiscountValue(0);
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
        const expiry = getExpiryStatus(matched.expiry_date);
        if (expiry.status === 'expired') {
          setExpiredItemToConfirm(matched);
          setNotification({
            type: 'error',
            message: `คำเตือน: สแกนพบสินค้าหมดอายุ "${matched.item_name}" (${formatExpiryDate(matched.expiry_date)})`,
          });
        } else {
          addToCart(matched);
          setNotification({
            type: 'success',
            message: `สแกนบาร์โค้ดสำเร็จ: เพิ่ม "${matched.item_name}" แล้ว`,
          });
        }
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

  // Calculate totals with item-level and order-level discounts
  const { rawSubtotal, itemDiscountsTotal, subtotalAfterItemDiscounts, orderDiscountAmount, grandTotal } = useMemo(() => {
    let raw = 0;
    let itemDiscounts = 0;

    cart.forEach((ci) => {
      const lineRaw = ci.item.item_price * ci.quantity;
      raw += lineRaw;

      let lineDiscount = 0;
      if (ci.discountType === 'percentage') {
        lineDiscount = (lineRaw * (ci.discountValue || 0)) / 100;
      } else if (ci.discountType === 'fixed') {
        lineDiscount = ci.discountValue || 0;
      }
      lineDiscount = Math.min(lineRaw, Math.max(0, lineDiscount));
      itemDiscounts += lineDiscount;
    });

    const afterItemDiscounts = Math.max(0, raw - itemDiscounts);

    let orderDiscount = 0;
    if (orderDiscountType === 'percentage') {
      orderDiscount = (afterItemDiscounts * (orderDiscountValue || 0)) / 100;
    } else if (orderDiscountType === 'fixed') {
      orderDiscount = orderDiscountValue || 0;
    }
    orderDiscount = Math.min(afterItemDiscounts, Math.max(0, orderDiscount));

    const grand = Math.max(0, Math.round((afterItemDiscounts - orderDiscount) * 100) / 100);

    return {
      rawSubtotal: raw,
      itemDiscountsTotal: Math.round(itemDiscounts * 100) / 100,
      subtotalAfterItemDiscounts: Math.round(afterItemDiscounts * 100) / 100,
      orderDiscountAmount: Math.round(orderDiscount * 100) / 100,
      grandTotal: grand,
    };
  }, [cart, orderDiscountType, orderDiscountValue]);

  const totalItemsCount = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.quantity, 0),
    [cart]
  );

  // Confirm and proceed to payment
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = async (paymentInfo: {
    method: 'cash' | 'promptpay';
    amountPaid: number;
    change: number;
    promptpayType?: 'dynamic' | 'static';
    promptpayRef?: string;
    promptpayPayload?: string;
  }) => {
    setIsProcessing(true);
    try {
      const payload = cart.map((ci) => ({
        item_id: ci.item.item_id,
        item_name: ci.item.item_name,
        item_price: ci.item.item_price,
        quantity: ci.quantity,
        discount_type: ci.discountType && ci.discountType !== 'none' ? ci.discountType : undefined,
        discount_value: ci.discountValue || undefined,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payload,
          payment_method: paymentInfo.method,
          amount_paid: paymentInfo.amountPaid,
          change_amount: paymentInfo.change,
          discount_type: orderDiscountType !== 'none' ? orderDiscountType : undefined,
          discount_value: orderDiscountValue > 0 ? orderDiscountValue : undefined,
          promptpay_type: paymentInfo.promptpayType,
          promptpay_ref: paymentInfo.promptpayRef,
          promptpay_payload: paymentInfo.promptpayPayload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const orderSummary: ReceiptOrder = {
          order_id: data.order.order_id,
          order_name: data.order.order_name,
          order_price: data.order.order_price,
          subtotal: data.order.subtotal ?? subtotalAfterItemDiscounts,
          discount_type: data.order.discount_type ?? (orderDiscountType !== 'none' ? orderDiscountType : null),
          discount_value: data.order.discount_value ?? orderDiscountValue,
          discount_amount: data.order.discount_amount ?? orderDiscountAmount,
          payment_method: paymentInfo.method,
          amount_paid: data.order.amount_paid ?? paymentInfo.amountPaid,
          change_amount: data.order.change_amount ?? paymentInfo.change,
          promptpay_type: data.order.promptpay_type ?? paymentInfo.promptpayType,
          promptpay_ref: data.order.promptpay_ref ?? paymentInfo.promptpayRef,
          promptpay_payload: data.order.promptpay_payload ?? paymentInfo.promptpayPayload,
          created_at: new Date().toISOString(),
          items: cart.map((ci) => {
            const rawSub = ci.item.item_price * ci.quantity;
            let dAmt = 0;
            if (ci.discountType === 'percentage') {
              dAmt = (rawSub * (ci.discountValue || 0)) / 100;
            } else if (ci.discountType === 'fixed') {
              dAmt = ci.discountValue || 0;
            }
            dAmt = Math.min(rawSub, Math.max(0, dAmt));
            return {
              item_id: ci.item.item_id,
              item_name: ci.item.item_name,
              item_price: ci.item.item_price,
              quantity: ci.quantity,
              subtotal: rawSub,
              discount_type: ci.discountType !== 'none' ? ci.discountType : null,
              discount_value: ci.discountValue,
              discount_amount: dAmt,
              final_price: rawSub - dAmt,
            };
          }),
        };

        setPaymentDialogOpen(false);
        setReceiptOrder(orderSummary);
        setReceiptModalOpen(true);
        setCompletedOrder({
          id: data.order.order_name,
          total: data.order.order_price,
        });
        setCart([]);
        setOrderDiscountType('none');
        setOrderDiscountValue(0);
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
    } catch {
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

      {/* Completed Order Banner */}
      {completedOrder && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PackageCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-emerald-900">บันทึกการขายสำเร็จ</h4>
              <p className="text-xs text-emerald-700">
                เลขที่: {completedOrder.id} • ยอดชำระ: {completedOrder.total.toLocaleString()} ฿
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 gap-1.5"
              onClick={() => setReceiptModalOpen(true)}
            >
              <Printer className="h-4 w-4" />
              ดูใบเสร็จ
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setCompletedOrder(null);
                setReceiptOrder(null);
              }}
            >
              เริ่มรายการใหม่
            </Button>
          </div>
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
            {filteredItems.map((item) => {
              const expiry = getExpiryStatus(item.expiry_date);
              const isExpired = expiry.status === 'expired';
              const isExpiringSoon = expiry.status === 'expiring_soon';
              const effectiveThreshold = getEffectiveThreshold(item.low_stock_threshold, defaultThreshold);
              const isOutOfStock = item.item_amount <= 0;
              const isLowStock = !isOutOfStock && item.item_amount <= effectiveThreshold;

              return (
                <Card
                  key={item.item_id}
                  className={`p-0 py-0 gap-0 overflow-hidden flex flex-col justify-between hover:border-gray-400 transition-colors ${
                    isOutOfStock
                      ? 'border-rose-200 bg-rose-50/20 opacity-75'
                      : isLowStock
                      ? 'border-amber-300 bg-amber-50/10'
                      : isExpired
                      ? 'border-rose-300 bg-rose-50/20'
                      : ''
                  }`}
                >
                  {/* Product Image - 400x400 white bg */}
                  <div className="relative h-20 w-full bg-white flex items-center justify-center overflow-hidden">
                    {/* Stock Badges */}
                    {isOutOfStock ? (
                      <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm flex items-center gap-0.5">
                        <AlertCircle className="h-2.5 w-2.5" />
                        หมด
                      </span>
                    ) : isLowStock ? (
                      <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white shadow-sm flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        เหลือน้อย ({item.item_amount})
                      </span>
                    ) : null}

                    {/* Expiry Badge */}
                    {isExpired && (
                      <span className="absolute top-1.5 right-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        หมดอายุ
                      </span>
                    )}
                    {isExpiringSoon && !isExpired && (
                      <span className="absolute top-1.5 right-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-sm flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        ใกล้หมดอายุ
                      </span>
                    )}

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
                      <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>คงเหลือ: {item.item_amount} ชิ้น</span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            หมด
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            เหลือน้อย
                          </span>
                        ) : isExpired ? (
                          <span className="text-[9px] font-semibold text-rose-600">
                            หมดอายุ
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="text-[9px] font-semibold text-amber-600">
                            {expiry.diffDays === 0 ? 'หมดอายุวันนี้' : `อีก ${expiry.diffDays} วัน`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-base font-black text-foreground tracking-tight">
                        {item.item_price.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">฿</span>
                      </span>
                      <Button
                        size="sm"
                        className={`h-6 px-2 text-[11px] cursor-pointer ${
                          isExpired ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''
                        }`}
                        onClick={() => addToCart(item)}
                        disabled={isOutOfStock}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        {isOutOfStock ? "หมด" : isExpired ? "หมดอายุ" : "เพิ่ม"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

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
                  {cart.map((ci) => {
                    const isCartItemExpired = getExpiryStatus(ci.item.expiry_date).status === 'expired';
                    const rawLineTotal = ci.item.item_price * ci.quantity;
                    let lineDiscount = 0;
                    if (ci.discountType === 'percentage') {
                      lineDiscount = (rawLineTotal * (ci.discountValue || 0)) / 100;
                    } else if (ci.discountType === 'fixed') {
                      lineDiscount = ci.discountValue || 0;
                    }
                    lineDiscount = Math.min(rawLineTotal, Math.max(0, lineDiscount));
                    const finalLineTotal = rawLineTotal - lineDiscount;
                    const hasItemDiscount = lineDiscount > 0;

                    return (
                      <div
                        key={ci.item.item_id}
                        className="space-y-1 pb-3 border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">
                              <span className="truncate">{ci.item.item_name}</span>
                              {isCartItemExpired && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 shrink-0">
                                  หมดอายุ
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>
                                {ci.item.item_price.toLocaleString()} ฿ × {ci.quantity}
                              </span>
                              {hasItemDiscount && (
                                <span className="line-through text-muted-foreground/60 text-[11px]">
                                  {rawLineTotal.toLocaleString()} ฿
                                </span>
                              )}
                              <span className="font-semibold text-foreground text-xs">
                                = {finalLineTotal.toLocaleString()} ฿
                              </span>
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
                              disabled={ci.quantity >= ci.item.item_amount}
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

                        {/* Item discount tag or trigger */}
                        <div className="flex items-center justify-between text-[11px] pt-0.5 pl-1">
                          {hasItemDiscount ? (
                            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                              <Tag className="h-3 w-3" />
                              <span>
                                ลด {ci.discountType === 'percentage' ? `${ci.discountValue}%` : `${ci.discountValue} ฿`} (-{lineDiscount.toLocaleString()} ฿)
                              </span>
                              <button
                                type="button"
                                onClick={() => openItemDiscountDialog(ci)}
                                className="text-rose-600 underline font-medium hover:text-rose-800 ml-1 cursor-pointer"
                              >
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItemDiscount(ci.item.item_id)}
                                className="text-rose-400 hover:text-rose-600 ml-0.5 cursor-pointer font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openItemDiscountDialog(ci)}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer"
                            >
                              <Tag className="h-3 w-3" />
                              <span>+ ใส่ส่วนลดรายการ</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex-col gap-3 border-t p-4 pt-4">
              {/* Pricing breakdown */}
              <div className="w-full space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>ยอดรวมสินค้า</span>
                  <span className="font-mono text-foreground font-medium">
                    {rawSubtotal.toLocaleString()} ฿
                  </span>
                </div>

                {itemDiscountsTotal > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>ส่วนลดรวมสินค้า</span>
                    <span className="font-mono font-medium">
                      -{itemDiscountsTotal.toLocaleString()} ฿
                    </span>
                  </div>
                )}

                {/* Overall Order Discount row & button */}
                <div className="flex items-center justify-between pt-1 border-t border-dashed">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground font-medium">ส่วนลดท้ายบิล</span>
                    {orderDiscountAmount > 0 && (
                      <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200 font-medium">
                        {orderDiscountType === 'percentage' ? `${orderDiscountValue}%` : `${orderDiscountValue} ฿`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {orderDiscountAmount > 0 ? (
                      <>
                        <span className="text-rose-600 font-mono font-bold">
                          -{orderDiscountAmount.toLocaleString()} ฿
                        </span>
                        <button
                          type="button"
                          onClick={openOrderDiscountDialog}
                          className="text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={removeOrderDiscount}
                          className="text-[11px] text-muted-foreground hover:text-rose-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={openOrderDiscountDialog}
                        disabled={cart.length === 0}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + ใส่ส่วนลดท้ายบิล
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-baseline w-full pt-1 border-t">
                <span className="text-sm font-bold text-foreground">ยอดสุทธิ</span>
                <span className="text-2xl font-black tracking-tight text-primary">
                  {grandTotal.toLocaleString()} ฿
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full pt-1">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={clearCart}
                  disabled={cart.length === 0 || isProcessing}
                >
                  ล้างรายการ
                </Button>
                <Button
                  className="cursor-pointer font-bold"
                  onClick={handleOpenPayment}
                  disabled={cart.length === 0 || isProcessing}
                >
                  {isProcessing ? 'กำลังบันทึก...' : 'ชำระเงิน'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!expiredItemToConfirm}
        onOpenChange={(open) => {
          if (!open) setExpiredItemToConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-rose-700">
                คำเตือน: สินค้าหมดอายุแล้ว
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              สินค้าชิ้นนี้หมดอายุแล้ว เพื่อความปลอดภัยของผู้บริโภค กรุณาตรวจสอบก่อนขาย
            </DialogDescription>
          </DialogHeader>

          {expiredItemToConfirm && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1.5 text-rose-900">
              <div className="font-semibold text-sm">
                {expiredItemToConfirm.item_name}
              </div>
              <div className="flex justify-between text-rose-800">
                <span>รหัสบาร์โค้ด: {expiredItemToConfirm.item_barcode}</span>
                <span className="font-bold">
                  วันหมดอายุ: {formatExpiryDate(expiredItemToConfirm.expiry_date)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setExpiredItemToConfirm(null)}
              className="cursor-pointer text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (expiredItemToConfirm) {
                  addToCart(expiredItemToConfirm, true);
                  setExpiredItemToConfirm(null);
                }
              }}
              className="cursor-pointer text-xs"
            >
              ยืนยันเพิ่มสินค้านี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        totalAmount={grandTotal}
        onConfirm={handlePaymentSubmit}
        isSubmitting={isProcessing}
      />

      {/* Item Discount Dialog */}
      <Dialog
        open={!!itemDiscountTarget}
        onOpenChange={(open) => {
          if (!open) setItemDiscountTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-primary" />
              ส่วนลดรายการ
            </DialogTitle>
            <DialogDescription className="text-xs truncate">
              {itemDiscountTarget?.item.item_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex rounded-md border border-input p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setTempItemDiscountType('fixed')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors cursor-pointer ${
                  tempItemDiscountType === 'fixed'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                บาท (฿)
              </button>
              <button
                type="button"
                onClick={() => setTempItemDiscountType('percentage')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors cursor-pointer ${
                  tempItemDiscountType === 'percentage'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                เปอร์เซ็นต์ (%)
              </button>
            </div>

            <div className="relative">
              <Input
                type="number"
                min="0"
                step={tempItemDiscountType === 'percentage' ? '1' : '0.01'}
                max={tempItemDiscountType === 'percentage' ? '100' : undefined}
                placeholder={tempItemDiscountType === 'percentage' ? 'เช่น 10 (10%)' : 'เช่น 20 (20฿)'}
                value={tempItemDiscountValue}
                onChange={(e) => setTempItemDiscountValue(e.target.value)}
                className="pr-8 text-sm"
                autoFocus
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {tempItemDiscountType === 'percentage' ? '%' : '฿'}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItemDiscountTarget(null)}
              className="text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={applyItemDiscount}
              className="text-xs font-semibold"
            >
              ใช้ส่วนลด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Discount Dialog */}
      <Dialog
        open={orderDiscountDialogOpen}
        onOpenChange={setOrderDiscountDialogOpen}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-primary" />
              ส่วนลดท้ายบิล
            </DialogTitle>
            <DialogDescription className="text-xs">
              ส่วนลดสำหรับยอดรวมทั้งบิล (คิดหลังหักส่วนลดรายการแล้ว)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex rounded-md border border-input p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setTempOrderDiscountType('fixed')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors cursor-pointer ${
                  tempOrderDiscountType === 'fixed'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                บาท (฿)
              </button>
              <button
                type="button"
                onClick={() => setTempOrderDiscountType('percentage')}
                className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors cursor-pointer ${
                  tempOrderDiscountType === 'percentage'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                เปอร์เซ็นต์ (%)
              </button>
            </div>

            <div className="relative">
              <Input
                type="number"
                min="0"
                step={tempOrderDiscountType === 'percentage' ? '1' : '0.01'}
                max={tempOrderDiscountType === 'percentage' ? '100' : undefined}
                placeholder={tempOrderDiscountType === 'percentage' ? 'เช่น 5 (5%)' : 'เช่น 50 (50฿)'}
                value={tempOrderDiscountValue}
                onChange={(e) => setTempOrderDiscountValue(e.target.value)}
                className="pr-8 text-sm"
                autoFocus
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {tempOrderDiscountType === 'percentage' ? '%' : '฿'}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrderDiscountDialogOpen(false)}
              className="text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={applyOrderDiscount}
              className="text-xs font-semibold"
            >
              ใช้ส่วนลด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        order={receiptOrder}
      />
    </div>
  );
}
