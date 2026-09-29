'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SummaryCard } from "@/components/cashier/summary-card"
import { SearchInput } from "@/components/cashier/search-box"
import { ItemCard } from "@/components/cashier/item-card"
import type { Item } from "../../../types/item"

export default function CashierPage() {
  const [data, setData] = useState('')
  const [items, setItems] = useState<Item[]>([])

  const clearData = async () => {
    await fetch('/api/data', { method: 'DELETE' })
    setData('')
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data')
        const json = await res.json()
        setData(json.text ?? '')
      } catch (err) {
        console.error(err)
      }
    }

    const fetchItems = async () => {
      try {
        const res = await fetch('/api/items')
        const json = await res.json()
        if (Array.isArray(json)) {
          setItems(json)
        }
      } catch (err) {
        console.error(err)
      }
    }

    fetchData()
    fetchItems()
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashier Terminal</h1>
        <p className="text-sm text-muted-foreground">สแกนบาร์โค้ดเพื่อคิดเงินและชำระค่าสินค้า</p>
      </div>

      <SearchInput/>

      {/*<Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Active Barcode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border bg-muted/40 p-4 font-mono text-xl tracking-wider min-h-14 flex items-center rounded-md">
            {data || <span className="text-muted-foreground text-sm font-sans">No barcode scanned</span>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={clearData}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>*/}
      <SummaryCard />
      {/*map item in items table to each ItemCard*/}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <ItemCard key={item.item_id} item={item} />
        ))}
      </div>
    </div>
  )
}
