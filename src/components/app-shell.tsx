"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="flex-1 w-full min-h-screen flex items-center justify-center p-4">{children}</main>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full m-4 lg:m-7">
        <AppSidebar />
        <main className="flex-1 w-full px-4 lg:px-8">
          <SidebarTrigger className="mb-4" />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
