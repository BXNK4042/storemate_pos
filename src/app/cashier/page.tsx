'use client'

import { useState, useEffect } from 'react'
import { SummaryCard, type SummaryCardItem } from "@/components/cashier/summary-card"
import { SearchInput } from "@/components/cashier/search-box"
import { ItemCard } from "@/components/cashier/item-card"
import type { Item } from "../../../types/item"

export default function CashierPage() {
  const [data, setData] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const [orderId, setOrderId] = useState<number | string>('')
  const [cart, setCart] = useState<SummaryCardItem[]>([])

  const clearData = async () => {
    await fetch('/api/data', { method: 'DELETE' })
    setData('')
  }

  const handleAddItem = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === item.item_id)
      if (existing) {
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
    setCart((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, quantity: i.quantity + 1 } : i))
    )
  }

  const handleDecrease = (itemId: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.item_id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    )
  }

  const handleConfirmOrder = async () => {
    if (cart.length === 0) return
    const totalPrice = cart.reduce((sum, item) => sum + item.item_price * item.quantity, 0)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, totalPrice }),
      })
      if (res.ok) {
        const orderData = await res.json()
        if (orderData.nextOrderId) {
          setOrderId(orderData.nextOrderId)
        }
        alert('บันทึกคำสั่งซื้อสำเร็จ')
        setCart([])
        const itemRes = await fetch('/api/items')
        const json = await itemRes.json()
        if (Array.isArray(json)) setItems(json)
      }
    } catch (err) {
      console.error(err)
    }
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
            placeholder="ค้นหาชื่อสินค้า หรือ บาร์โค้ด..."
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

        <div className="lg:col-span-1 lg:sticky lg:top-4">
          <SummaryCard
            items={cart}
            orderNumber={orderId ? String(orderId) : undefined}
            barcode={data}
            onClearBarcode={clearData}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onConfirm={handleConfirmOrder}
            onClear={handleClearCart}
          />
        </div>
      </div>
    </div>
  )
}
