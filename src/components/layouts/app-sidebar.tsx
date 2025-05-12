"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "ui/sidebar";
import Link from "next/link";

import { useEffect } from "react";
import { getStorageManager } from "lib/browser-stroage";

import { AppSidebarMenus } from "./app-sidebar-menus";
import { AppSidebarThreads } from "./app-sidebar-threads";
import { AppSidebarUser } from "./app-sidebar-user";
import { MCPIcon } from "ui/mcp-icon";
import { AppSidebarProjects } from "./app-sidebar-projects";
const browserSidebarStorage = getStorageManager<boolean>("sidebar_state");

export function AppSidebar() {
  const { open } = useSidebar();

  useEffect(() => {
    browserSidebarStorage.set(open);
  }, [open]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarRail />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-0.5">
            <SidebarMenuButton asChild>
              <Link href="/">
                <MCPIcon className="size-4 fill-foreground" />
                <h4 className="font-bold">mcp/workbench</h4>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="mt-2">
        <AppSidebarMenus isOpen={open} />
        <AppSidebarProjects />
        <AppSidebarThreads />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarUser />
      </SidebarFooter>
    </Sidebar>
  );
}
