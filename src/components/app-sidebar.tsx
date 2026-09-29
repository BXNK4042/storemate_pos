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
        <div>
          <Image
            src={ storemateLogo }
            alt="storemate_logo"
            width={500}
            height={500}
          />
          <Link href="/">Storemate</Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Link href="/items">คลังสินค้า</Link>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
