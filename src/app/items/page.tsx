import { getItems } from "@/lib/items";
import ItemsView from "./items-view";

export const dynamic = "force-dynamic";

export default function ItemsPage() {
  const result = getItems();
  return <ItemsView initialItems={result.data || []} />;
}
