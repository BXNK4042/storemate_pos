"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import storemateLogo from "../../public/storemate_logo.jpg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Package,
  Receipt,
  History,
  LogOut,
  User,
  ShieldCheck,
} from "lucide-react";

interface UserInfo {
  userId: number;
  username: string;
  role: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch {
        // Not logged in or error
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const navItems = [
    {
      title: "แดชบอร์ด",
      url: "/",
      icon: LayoutDashboard,
      roles: ["admin", "cashier"],
    },
    {
      title: "แคชเชียร์",
      url: "/cashier",
      icon: Receipt,
      roles: ["admin", "cashier"],
    },
    {
      title: "ประวัติการขาย",
      url: "/orders",
      icon: History,
      roles: ["admin", "cashier"],
    },
    {
      title: "คลังสินค้า",
      url: "/items",
      icon: Package,
      roles: ["admin"],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    currentUser ? item.roles.includes(currentUser.role) : true
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border/60 p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-gray-200 shadow-xs shrink-0">
            <Image
              src={storemateLogo}
              alt="StoreMate logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold leading-none tracking-tight text-gray-900 truncate">
              StoreMate
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              POS System
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            เมนูหลัก
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="mt-1 gap-1">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={item.title}
                      className="gap-3 px-3 py-2 text-sm font-medium transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-4 space-y-3">
        {currentUser && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-muted/60 text-xs">
            {currentUser.role === "admin" ? (
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground truncate">
                {currentUser.username}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {currentUser.role}
              </span>
            </div>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              <span>ออกจากระบบ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
