"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "ui/dialog";

import { Button } from "ui/button";
import { Loader } from "lucide-react";
import { Textarea } from "ui/textarea";
import { useEffect, useState } from "react";
import { safe } from "ts-safe";
import { toast } from "sonner";
import { handleErrorWithToast } from "ui/shared-toast";
import { appStore } from "@/app/store";

interface SystemMessagePopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SystemMessagePopup({
  isOpen,
  onOpenChange,
}: SystemMessagePopupProps) {
  const systemPrompt = appStore((state) => state.systemPrompt);
  const mutate = appStore((state) => state.mutate);
  
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    safe(() => setIsLoading(true))
      .map(() => {
        mutate({ systemPrompt: localSystemPrompt });
        return true;
      })
      .watch(() => setIsLoading(false))
      .ifOk(() => toast.success("Default system prompt updated"))
      .ifOk(() => onOpenChange(false))
      .ifFail(handleErrorWithToast);
  };
  
  useEffect(() => {
    if (isOpen) {
      setLocalSystemPrompt(systemPrompt);
    }
  }, [isOpen, systemPrompt]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card w-full sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Default System Prompt</DialogTitle>
          <DialogDescription asChild>
            <div className="py-4">
              <p className="font-semibold mb-2">
                How can the ChatBot best help you with regular chats?
              </p>
              You can ask the ChatBot to focus on a specific topic or to respond
              in a particular tone or format.
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 w-full overflow-x-auto">
          <Textarea
            autoFocus
            id="system-prompt"
            value={localSystemPrompt}
            onChange={(e) => setLocalSystemPrompt(e.target.value)}
            placeholder="e.g. You are a friendly assistant! Keep your responses concise and helpful."
            className="resize-none min-h-[200px] max-h-[400px] w-full"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild disabled={isLoading}>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading || !localSystemPrompt.trim()}
            onClick={handleSave}
            variant={"secondary"}
          >
            {isLoading && <Loader className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 