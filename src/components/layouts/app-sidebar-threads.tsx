"use client";

import { SidebarGroupLabel, SidebarMenuSub } from "ui/sidebar";
import Link from "next/link";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarMenuSubItem,
} from "ui/sidebar";
import { SidebarGroupContent, SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroup } from "ui/sidebar";
import { ThreadDropdown } from "../thread-dropdown";
import { Eye, MoreHorizontal, Search, Trash, WandSparkles } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { appStore } from "@/app/store";
import { Button } from "ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import {
  deleteThreadsAction,
  selectThreadListByUserIdAction,
} from "@/app/api/chat/actions";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { CreateProjectWithThreadPopup } from "../create-project-with-thread-popup";

export function AppSidebarThreads() {
  const mounted = useMounted();
  const router = useRouter();
  const [storeMutate, currentThreadId] = appStore(
    useShallow((state) => [state.mutate, state.currentThreadId]),
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: threadList,
    isLoading,
    error,
  } = useSWR("threads", selectThreadListByUserIdAction, {
    onError: handleErrorWithToast,
    fallbackData: [],
    onSuccess: (data) => storeMutate({ threadList: data }),
  });
  
  const handleDeleteAllThreads = async () => {
    await toast.promise(deleteThreadsAction(), {
      loading: "Deleting all threads...",
      success: () => {
        storeMutate({ threadList: [] });
        mutate("threads");
        router.push("/");
        return "All threads deleted";
      },
      error: "Failed to delete all threads",
    });
  };
  
  useEffect(() => {
    if (error) {
      signOut({
        redirectTo: "/login",
      });
    }
  }, [error]);

  const filteredThreads = searchQuery
    ? threadList?.filter((thread) =>
        thread.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threadList || [];

  // const handleNavigateToChat = (threadId: string) => {
  //   router.push(`/chat/${threadId}`);
  //   setSearchOpen(false);
  // };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/threads">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarGroupLabel className="">
              <h4 className="text-xs text-muted-foreground">Recent Chats</h4>
              <div className="flex-1" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover/threads:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleDeleteAllThreads}
                  >
                    <Trash />
                    Delete All Chats
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover/threads:opacity-100 transition-opacity"
                onClick={() => setSearchOpen(true)}
              >
                <Search />
              </Button>
            </SidebarGroupLabel>

            {isLoading ? (
              Array.from({ length: 12 }).map(
                (_, index) => mounted && <SidebarMenuSkeleton key={index} />,
              )
            ) : threadList?.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No conversations yet
                </p>
              </div>
            ) : (
              threadList?.map((thread) => (
                <SidebarMenuSub key={thread.id} className={"group/thread mr-0"}>
                  <SidebarMenuSubItem>
                    <SidebarMenuButton
                      asChild
                      isActive={currentThreadId === thread.id}
                    >
                      <Link
                        href={`/chat/${thread.id}`}
                        className="flex items-center"
                      >
                        <p className="truncate ">{thread.title}</p>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction className="opacity-0 group-hover/thread:opacity-100">
                      <ThreadDropdown
                        side="right"
                        threadId={thread.id}
                        beforeTitle={thread.title}
                      >
                        <MoreHorizontal />
                      </ThreadDropdown>
                    </SidebarMenuAction>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              ))
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search Chats"
        description="Search through your chat history"
      >
        <CommandInput 
          placeholder="Search chats..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {searchQuery !== "" && filteredThreads.length === 0 && (
            <CommandEmpty>No chats found.</CommandEmpty>
          )}
          {searchQuery === "" && filteredThreads.length === 0 && (
            <CommandEmpty>No chats available.</CommandEmpty>
          )}
          {filteredThreads.length > 0 && (
            <CommandGroup heading="Chats">
              {filteredThreads.map((thread) => (
                <>
                <CommandItem
                  key={thread.id}
                  // onSelect={() => handleNavigateToChat(thread.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <p>{thread.title}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/chat/${thread.id}`);
                        setSearchOpen(false);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <CreateProjectWithThreadPopup
                      threadId={thread.id}
                      onClose={() => setSearchOpen(false)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <WandSparkles className="h-4 w-4" />
                      </Button>
                    </CreateProjectWithThreadPopup>
                    <ThreadDropdown
                      side="bottom"
                      threadId={thread.id}
                      beforeTitle={thread.title}
                      onDeleted={() => {
                        if (filteredThreads.length <= 1) {
                          setSearchOpen(false);
                        }
                        setSearchQuery("");
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </ThreadDropdown>
                  </div>
                </CommandItem>
                <CommandSeparator/>
                </>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </SidebarGroup>
  );
}
