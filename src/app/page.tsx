import { getDashboardStats } from "@/lib/analytics";
import DashboardView from "./dashboard-view";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = getDashboardStats();

  return <DashboardView initialStats={stats} />;
}
