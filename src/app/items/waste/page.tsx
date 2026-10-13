import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Waste Tracking | StoreMate POS",
  description: "Waste tracking is currently disabled.",
};

export default function WastePage() {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card className="mt-8 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Waste Tracking is disabled</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            การติดตามและบันทึกของเสียถูกปิดการใช้งานในระบบขณะนี้
          </p>
          <Link href="/items">
            <Button variant="default" className="flex items-center gap-2 cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              กลับไปหน้ารายการสินค้า (Back to Items)
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
