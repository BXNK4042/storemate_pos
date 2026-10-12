import WasteView from "./waste-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "จัดการและบันทึกของเสีย (Waste Tracking) | StoreMate POS",
  description: "ระบบบันทึกและติดตามสินค้าชำรุด เน่าเสีย และหมดอายุ พร้อมรายงานมูลค่าความเสียหาย",
};

export default function WastePage() {
  return <WasteView />;
}
