"use client";

import { appStore } from "@/app/store";
import { useChat, UseChatHelpers } from "@ai-sdk/react";
import { cn } from "lib/utils";

import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "ui/drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import PromptInput from "./prompt-input";
import { PreviewMessage } from "./message";
import { X } from "lucide-react";
import { Separator } from "ui/separator";
import { useLatest } from "@/hooks/use-latest";
import { UIMessage } from "ai";
import { useShallow } from "zustand/shallow";
import { MessageCirclePlus } from "lucide-react";

export default function TemporaryChat({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [model, systemPrompt] = appStore(
    useShallow((state) => [state.model, state.systemPrompt])
  );

  const {
    messages,
    input,
    setInput,
    append,
    status,
    reload,
    setMessages,
    stop,
  } = useChat({
    api: "/api/chat/temporary",
    experimental_throttle: 100,
    body: {
      model,
      systemPrompt,
    },
    onError: (error) => {
      toast.error("An error occurred, please try again!");
      
      // Also append the error message to the chat as a system message for specific errors
      if (error.message && error.message.includes("too many tools")) {
        setMessages([
          ...messages,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "I'm currently equipped with too many tools to process your request. Please try a more specific query or contact your administrator to optimize the tool configuration.",
          }
        ]);
      }
    },
  });

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const latestRef = useLatest(isLoading);

  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          (e.metaKey || e.ctrlKey) &&
          e.key.toLowerCase() === "e" &&
          !latestRef.current
        ) {
          e.preventDefault();
          e.stopPropagation();
          setMessages([]);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open]);

  return (
    <Drawer direction="right" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children ?? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  setOpen(!open);
                }}
               className="w-full justify-between border border-ring/80 font-semibold border-dashed hover:bg-primary/80 hover:text-primary-foreground" 
               variant={open ? "secondary" : "ghost"}
              >
                Temporary Chat
                <MessageCirclePlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" side="bottom">
              <p>Temporary Chat</p>
            </TooltipContent>
          </Tooltip>
        )}
      </DrawerTrigger>
      <DrawerContent className="w-full md:w-2xl px-2 flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <p>Temporary Chat</p>

            <div className="flex-1" />
            <Button
              variant={"secondary"}
              className="rounded-full"
              onClick={() => setMessages([])}
              disabled={isLoading}
            >
              Reset Chat
              <Separator orientation="vertical" />
              <span className="text-xs text-muted-foreground ml-1">⌘E</span>
            </Button>
            <DrawerClose asChild>
              <Button
                variant={"secondary"}
                className="flex items-center gap-1 rounded-full"
              >
                <X />
                <Separator orientation="vertical" />
                <span className="text-xs text-muted-foreground ml-1">ESC</span>
              </Button>
            </DrawerClose>
          </DrawerTitle>
        </DrawerHeader>
        <DrawerTemporaryContent
          isLoading={isLoading}
          messages={messages}
          input={input}
          setInput={setInput}
          append={append}
          setMessages={setMessages}
          reload={reload}
          stop={stop}
          status={status}
        />
      </DrawerContent>
    </Drawer>
  );
}

function DrawerTemporaryContent({
  messages,
  input,
  setInput,
  append,
  status,
  isLoading,
  setMessages,
  reload,
  stop,
}: {
  messages: UIMessage[];
  input: string;
  setInput: (input: string) => void;
  append: UseChatHelpers["append"];
  status: "submitted" | "streaming" | "ready" | "error";
  isLoading: boolean;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  stop: UseChatHelpers["stop"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const autoScrollRef = useRef(false);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current?.scrollHeight,
    });
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      containerRef.current?.scrollTo({
        top: containerRef.current?.scrollHeight,
      });
    }
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      autoScrollRef.current = true;
      const handleScroll = () => {
        const el = containerRef.current!;
        const isAtBottom =
          el.scrollHeight - el.scrollTop - el.clientHeight < 20;
        if (!isAtBottom) {
          autoScrollRef.current = false;
        }
      };
      containerRef.current?.addEventListener("scroll", handleScroll);
      return () => {
        containerRef.current?.removeEventListener("scroll", handleScroll);
      };
    }
  }, [isLoading]);

  return (
    <div
      className={cn("flex flex-col min-w-0 h-full flex-1 overflow-y-hidden")}
    >
      {!messages.length && (
        <div className="flex-1 items-center flex">
          <div className="max-w-3xl mx-auto my-4">
            {" "}
            <div className="rounded-xl p-6 flex flex-col gap-2 leading-relaxed text-center">
              <h1 className="text-4xl font-semibold ">
                This chat won&apos;t be saved.
              </h1>
            </div>
          </div>
        </div>
      )}
      <div
        className={"flex flex-col gap-2 overflow-y-auto py-6"}
        ref={containerRef}
      >
        {messages.map((message, index) => {
          const isLastMessage = messages.length - 1 === index;
          return (
            <PreviewMessage
              messageIndex={index}
              key={index}
              message={message}
              status={status}
              isLoading={isLoading}
              isLastMessage={isLastMessage}
              setMessages={setMessages}
              reload={reload}
            />
          );
        })}
      </div>

      <div className={"w-full my-6 mt-auto"}>
        <PromptInput
          input={input}
          append={append}
          ownerId={""}
          toolDisabled
          placeholder="Feel free to ask anything temporarily"
          setInput={setInput}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
}
