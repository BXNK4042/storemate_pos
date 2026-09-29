'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CashierPage() {
  const [data, setData] = useState('')

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

    fetchData()
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashier Terminal</h1>
        <p className="text-sm text-muted-foreground">Scan barcodes to process customer checkout.</p>
      </div>

      <Card className="w-full">
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
      </Card>
    </div>
  )
}
