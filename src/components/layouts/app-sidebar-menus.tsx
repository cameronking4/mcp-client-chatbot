import { TooltipContent } from "ui/tooltip";
import { SidebarMenuButton } from "ui/sidebar";
import { Tooltip, TooltipTrigger } from "ui/tooltip";
import { SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroupContent } from "ui/sidebar";
import { cn } from "lib/utils";
import { SidebarGroup } from "ui/sidebar";
import { TooltipProvider } from "ui/tooltip";
import Link from "next/link";
import { Library, MessageCirclePlus, Server } from "lucide-react";
import TemporaryChat from "../temporary-chat";

export function AppSidebarMenus({ isOpen }: { isOpen: boolean }) {

  return (
    <SidebarGroup className={cn(isOpen && "px-4")}>
      <SidebarGroupContent>
        <SidebarMenu className="mb-3">
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem>
                <Link href="/">
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        isOpen && "flex justify-between w-full",
                        "border border-ring/80 font-semibold hover:bg-primary/80 hover:text-primary-foreground",
                        "p-4"
                      )}
                    >
                      New Chat
                      <MessageCirclePlus />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>New Chat</p>
                  </TooltipContent>
                </Link>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
        <SidebarMenu className="my-3">
          <TemporaryChat />
        </SidebarMenu>
        <SidebarMenu>
          <TooltipProvider>
            <Tooltip>
              <SidebarMenuItem>
                <Link href="/mcp">
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      // isActive
                      className={cn(
                        isOpen &&
                          "flex justify-between font-semibold bg-primary text-primary-foreground p-4 hover:bg-primary/80 hover:text-primary-foreground/80",
                      )}
                    >
                      {!isOpen && <Library />}
                      MCP Servers
                      <Server />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>MCP Configuration</p>
                  </TooltipContent>
                </Link>
              </SidebarMenuItem>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
