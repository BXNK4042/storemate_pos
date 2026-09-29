'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function CashierPage() {
  const [data, setData] = useState('');

  const clearData = async () => {
    await fetch('/api/data', { method: 'DELETE' });
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/data');
      const json = await res.json();
      setData(json.text);
    };

    fetchData()

  }, []);

  return (
    <div className="my-5">
      <h1 className="text-2xl">Cashier</h1>
      <h3 className="text-md text-gray-500">Barcode: {data}</h3>
      <Button variant="outline" onClick={clearData}>Cancel</Button >
    </div>
  );
}
