'use client'

import { useState, useEffect } from 'react'
import { SummaryCard, type SummaryCardItem } from "@/components/cashier/summary-card"
import { SearchInput } from "@/components/cashier/search-box"
import { ItemCard } from "@/components/cashier/item-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Item } from "../../../types/item"
import { CheckCircle2, CreditCard, Banknote, QrCode, Printer, RotateCcw } from 'lucide-react'

export default function CashierPage() {
  const [data, setData] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const [orderId, setOrderId] = useState<number | string>('')
  const [cart, setCart] = useState<SummaryCardItem[]>([])

  // Checkout & Payment State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'promptpay'>('cash')
  const [cashTendered, setCashTendered] = useState<string>('')
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: number | string
    items: SummaryCardItem[]
    totalPrice: number
    paymentMethod: 'cash' | 'promptpay'
    cashTendered?: number
    change?: number
    createdAt: string
  } | null>(null)

  const clearData = async () => {
    await fetch('/api/data', { method: 'DELETE' })
    setData('')
  }

  const handleAddItem = (item: Item) => {
    if (item.item_amount <= 0) {
      alert(`สินค้า "${item.item_name}" สินค้าหมดในสต็อก`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === item.item_id)
      if (existing) {
        if (existing.quantity >= item.item_amount) {
          alert(`สินค้าในคลังมีเพียง ${item.item_amount} ชิ้น`)
          return prev
        }
        return prev.map((i) =>
          i.item_id === item.item_id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          item_id: item.item_id,
          item_name: item.item_name,
          item_price: item.item_price,
          quantity: 1,
        },
      ]
    })
  }

  const reloadItems = async () => {
    try {
      const itemRes = await fetch('/api/items')
      const loadedItems = (await itemRes.json()) as Item[]
      if (Array.isArray(loadedItems)) {
        setItems(loadedItems)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const initCashier = async () => {
      try {
        const itemRes = await fetch('/api/items')
        const loadedItems = (await itemRes.json()) as Item[]
        if (Array.isArray(loadedItems)) {
          setItems(loadedItems)

          const dataRes = await fetch('/api/data')
          const dataJson = await dataRes.json()
          const scanned = (dataJson.text ?? '').trim()
          if (scanned && scanned !== 'No data') {
            const matched = loadedItems.find(
              (i) => i.item_barcode.toLowerCase() === scanned.toLowerCase()
            )
            if (matched) {
              handleAddItem(matched)
              await fetch('/api/data', { method: 'DELETE' })
            } else {
              setData(scanned)
            }
          }

          const ordersRes = await fetch('/api/orders')
          const ordersJson = await ordersRes.json()
          if (ordersJson.nextOrderId) {
            setOrderId(ordersJson.nextOrderId)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }

    initCashier()
  }, [])

  const handleClearCart = () => {
    setCart([])
  }

  const handleIncrease = (itemId: number) => {
    const target = items.find((i) => i.item_id === itemId)
    setCart((prev) =>
      prev.map((i) => {
        if (i.item_id === itemId) {
          if (target && i.quantity >= target.item_amount) {
            alert(`สินค้ามีในคลังเพียง ${target.item_amount} ชิ้น`)
            return i
          }
          return { ...i, quantity: i.quantity + 1 }
        }
        return i
      })
    )
  }

  const handleDecrease = (itemId: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    )
  }

  // Barcode / Search Enter key handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const query = search.trim().toLowerCase()
      if (!query) return

      const matched = items.find(
        (i) => i.item_barcode.toLowerCase() === query || i.item_name.toLowerCase() === query
      )

      if (matched) {
        handleAddItem(matched)
        setSearch('')
      }
    }
  }

  const totalCartPrice = cart.reduce((sum, item) => sum + item.item_price * item.quantity, 0)
  const numericTendered = parseFloat(cashTendered) || 0
  const changeAmount = numericTendered - totalCartPrice

  const handleOpenCheckout = () => {
    if (cart.length === 0) return
    setCashTendered(String(totalCartPrice))
    setIsCheckoutOpen(true)
  }

  const handleProcessPayment = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'cash' && numericTendered < totalCartPrice) {
      alert('จำนวนเงินที่รับมาน้อยกว่ายอดชำระ')
      return
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, totalPrice: totalCartPrice }),
      })

      if (res.ok) {
        const orderData = await res.json()
        const completedId = orderData.order_id || orderId
        if (orderData.nextOrderId) {
          setOrderId(orderData.nextOrderId)
        }

        setCompletedOrder({
          orderId: completedId,
          items: [...cart],
          totalPrice: totalCartPrice,
          paymentMethod,
          cashTendered: paymentMethod === 'cash' ? numericTendered : totalCartPrice,
          change: paymentMethod === 'cash' ? Math.max(0, changeAmount) : 0,
          createdAt: new Date().toISOString(),
        })

        setIsCheckoutOpen(false)
        setCart([])
        await reloadItems()
      } else {
        const err = await res.json()
        alert(err.error || 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ')
      }
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
  }

  const handleStartNewOrder = () => {
    setCompletedOrder(null)
    setCashTendered('')
    setPaymentMethod('cash')
  }

  const filteredItems = items.filter(
    (item) =>
      item.item_name.toLowerCase().includes(search.toLowerCase()) ||
      item.item_barcode.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashier Terminal</h1>
        <p className="text-sm text-muted-foreground">สแกนบาร์โค้ดเพื่อคิดเงินและชำระค่าสินค้า</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Search and Product Catalog */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="ค้นหาชื่อสินค้า หรือ สแกนบาร์โค้ดแล้วกด Enter..."
          />

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <ItemCard key={item.item_id} item={item} onAdd={handleAddItem} />
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground border rounded-lg">
              ไม่พบรายการสินค้าที่ตรงกับคำค้นหา
            </div>
          )}
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-1 lg:sticky lg:top-4">
          <SummaryCard
            items={cart}
            orderNumber={orderId ? String(orderId) : undefined}
            barcode={data}
            onClearBarcode={clearData}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onConfirm={handleOpenCheckout}
            onClear={handleClearCart}
          />
        </div>
      </div>

      {/* Payment / Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>ชำระเงิน (Checkout)</span>
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsCheckoutOpen(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            <div className="p-6 space-y-5">
              {/* Total amount highlight */}
              <div className="p-4 rounded-lg bg-muted/40 border text-center space-y-1">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  ยอดที่ต้องชำระทั้งหมด
                </span>
                <div className="text-3xl font-extrabold font-mono text-primary">
                  {totalCartPrice.toLocaleString()} ฿
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('cash')}
                  className="gap-2"
                >
                  <Banknote className="h-4 w-4" />
                  <span>เงินสด (Cash)</span>
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === 'promptpay' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('promptpay')}
                  className="gap-2"
                >
                  <QrCode className="h-4 w-4" />
                  <span>QR PromptPay</span>
                </Button>
              </div>

              {paymentMethod === 'cash' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">
                      จำนวนเงินที่รับมา (บาท)
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="ใส่จำนวนเงินที่รับ"
                      className="text-lg font-mono"
                      autoFocus
                    />
                  </div>

                  {/* Quick cash suggestions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setCashTendered(String(totalCartPrice))}
                    >
                      พอดี ({totalCartPrice}฿)
                    </Button>
                    {[50, 100, 500, 1000].map((denom) => {
                      if (denom >= totalCartPrice || denom === 1000) {
                        return (
                          <Button
                            key={denom}
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setCashTendered(String(denom))}
                          >
                            +{denom}฿
                          </Button>
                        )
                      }
                      return null
                    })}
                  </div>

                  {/* Change calculation */}
                  <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">เงินทอน:</span>
                    <span
                      className={`text-lg font-mono font-bold ${
                        changeAmount < 0 ? 'text-destructive' : 'text-emerald-600'
                      }`}
                    >
                      {changeAmount < 0
                        ? `ขาดอีก ${Math.abs(changeAmount).toLocaleString()} ฿`
                        : `${changeAmount.toLocaleString()} ฿`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/20 space-y-3">
                  <div className="w-36 h-36 border-2 border-primary rounded-lg flex flex-col items-center justify-center bg-white p-2">
                    <QrCode className="h-28 w-28 text-slate-800" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold">Thai QR Payment / PromptPay</div>
                    <div className="text-xs text-muted-foreground">สแกนชำระ {totalCartPrice.toLocaleString()} บาท</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-muted/20 flex gap-2">
              <Button
                variant="outline"
                className="w-1/3"
                onClick={() => setIsCheckoutOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="w-2/3"
                disabled={paymentMethod === 'cash' && numericTendered < totalCartPrice}
                onClick={handleProcessPayment}
              >
                ยืนยันการรับเงิน
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Order Receipt Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b flex items-center justify-between bg-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="font-semibold text-base">ชำระเงินสำเร็จแล้ว</h3>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleStartNewOrder}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            {/* Paper Receipt */}
            <div className="p-6 font-mono text-xs space-y-3 bg-card">
              <div className="text-center space-y-0.5">
                <div className="font-bold text-base font-sans tracking-wider uppercase">StoreMate POS</div>
                <div className="text-muted-foreground text-[11px]">ร้านสะดวกซื้อและสินค้าคุณภาพ</div>
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="flex justify-between">
                <span>คำสั่งซื้อ:</span>
                <span className="font-bold">#{completedOrder.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span>วันที่:</span>
                <span>{new Date(completedOrder.createdAt).toLocaleString('th-TH')}</span>
              </div>
              <div className="flex justify-between">
                <span>วิธีชำระ:</span>
                <span className="uppercase">{completedOrder.paymentMethod}</span>
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="space-y-1.5">
                {completedOrder.items.map((it) => (
                  <div key={it.item_id} className="flex justify-between">
                    <span className="truncate flex-1 pr-2">
                      {it.item_name} x {it.quantity}
                    </span>
                    <span className="font-mono font-semibold">
                      {(it.item_price * it.quantity).toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="flex justify-between text-sm font-bold">
                <span>ยอดรวม (Total):</span>
                <span>{completedOrder.totalPrice.toLocaleString()} ฿</span>
              </div>

              {completedOrder.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>รับเงินมา:</span>
                    <span>{(completedOrder.cashTendered || 0).toLocaleString()} ฿</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>เงินทอน:</span>
                    <span>{(completedOrder.change || 0).toLocaleString()} ฿</span>
                  </div>
                </>
              )}

              <div className="border-t border-dashed my-2" />
              <div className="text-center text-[10px] text-muted-foreground pt-1">
                ขอบคุณที่ใช้บริการ / Thank you
              </div>
            </div>

            <div className="p-4 border-t bg-muted/20 flex gap-2">
              <Button
                variant="outline"
                className="w-1/2 gap-1.5"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                <span>พิมพ์ใบเสร็จ</span>
              </Button>
              <Button
                className="w-1/2 gap-1.5"
                onClick={handleStartNewOrder}
              >
                <RotateCcw className="h-4 w-4" />
                <span>เริ่มรายการใหม่</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
