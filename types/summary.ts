export interface SummaryCardItem {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
}

export interface SummaryCardProp {
  items?: SummaryCardItem[];
  orderNumber?: string;
  barcode?: string;
  onClearBarcode?: () => void;
  onIncrease?: (itemId: number) => void;
  onDecrease?: (itemId: number) => void;
  onConfirm?: () => void;
  onClear?: () => void;
}
