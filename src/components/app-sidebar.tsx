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
        <SidebarGroup>
          <Link href="/items">คลังสินค้า</Link>
          <Link href="/cashier">แคชเชียร์</Link>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
