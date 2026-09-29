import Link from "next/link"
import Image from "next/image"
import storemateLogo from "../../public/storemate_logo.jpg"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { LogOut, Box, BanknoteArrowUp } from "lucide-react"

export function AppSidebar() {
  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={storemateLogo}
            alt="StoreMate Logo"
            width={36}
            height={36}
            className="border object-cover rounded-full"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">StoreMate</span>
            <span className="text-xs text-muted-foreground">POS System</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Menu
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/items" />}>
                <Box className="h-4 w-4" />
                <span>คลังสินค้า (Inventory)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/cashier" />}>
                <BanknoteArrowUp className="h-4 w-4" />
                <span>แคชเชียร์ (Cashier)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <Button
          variant="outline"
          nativeButton={false}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          render={<Link href="/" />}
        >
          <LogOut className="h-4 w-4" />
          <span>ออกจากระบบ</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
