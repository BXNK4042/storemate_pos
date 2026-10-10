export interface OrderLineItem {
  item_id: number;
  quantity: number;
  item_name: string;
  item_price: number;
  item_images?: string | null;
  item_barcode?: string;
}

export interface Order {
  order_id: number;
  order_name: string;
  order_price: number;
  created_at?: string;
  items?: OrderLineItem[];
}
