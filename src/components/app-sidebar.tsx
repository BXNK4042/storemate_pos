import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@/components/ui/sidebar"
import Image from "next/image"
import storemateLogo from "../../public/storemate_logo.jpg"
import { Button } from "@/components/ui/button"
import { LogOut, Box, BanknoteArrowUp } from 'lucide-react'

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/" className="text-xl">
          <div className="flex flex-row items-center gap-2 p-4">
            <Image
              src={ storemateLogo }
              alt="storemate_logo"
              width={64}
              height={64}
              className="rounded-full border"
            />
            <h1>Storemate</h1>
          </div>
        </Link>

      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="gap-4">
          <h1 className="text-gray-800 ml-5 text-md">รายการ</h1>
          <Link href="/items" className="text-gray-400 ml-5 flex gap-3"><Box/>คลังสินค้า</Link>
          <Link href="/cashier" className="text-gray-400 ml-5 flex gap-3"><BanknoteArrowUp/>แคชเชียร์</Link>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="outline">
          <Link href="/" className="text-gray-600 flex gap-2"><LogOut/>ออกจากระบบ</Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  )
}
