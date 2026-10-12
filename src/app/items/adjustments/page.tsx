import AdjustmentsView from "./adjustments-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "สมุดบันทึกประวัติสต็อก | StoreMate POS",
  description: "ระบบบันทึกประวัติและตรวจสอบความเคลื่อนไหวสต็อกสินค้า (Stock Adjustment Audit Logs)",
};

export default function AdjustmentsPage() {
  return <AdjustmentsView />;
}
