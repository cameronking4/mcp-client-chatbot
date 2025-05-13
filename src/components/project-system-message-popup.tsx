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
import { updateProjectAction } from "@/app/api/chat/actions";
import { toast } from "sonner";
import { handleErrorWithToast } from "ui/shared-toast";

interface ProjectSystemMessagePopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (systemPrompt: string) => void;
  projectId: string;
  beforeSystemMessage?: string;
}

export function ProjectSystemMessagePopup({
  isOpen,
  onOpenChange,
  onSave,
  projectId,
  beforeSystemMessage,
}: ProjectSystemMessagePopupProps) {
  const [systemPrompt, setSystemPrompt] = useState(beforeSystemMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    safe(() => setIsLoading(true))
      .map(() =>
        updateProjectAction(projectId, { instructions: { systemPrompt } }),
      )
      .watch(() => setIsLoading(false))
      .ifOk(() => onSave(systemPrompt))
      .ifOk(() => toast.success("Project instructions updated"))
      .ifOk(() => onOpenChange(false))
      .ifFail(handleErrorWithToast);
  };
  useEffect(() => {
    if (isOpen) {
      setSystemPrompt(beforeSystemMessage || "");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card w-full sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Project Instructions</DialogTitle>
          <DialogDescription asChild>
            <div className="py-4">
              <p className="font-semibold mb-2">
                How can the ChatBot best help you with this project?
              </p>
              These instructions will only be used for this project.
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 w-full overflow-x-auto">
          <Textarea
            autoFocus
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. You are a Korean travel guide ChatBot. Respond only in Korean, include precise times for every itinerary item, and present transportation, budget, and dining recommendations succinctly in a table format."
            className="resize-none min-h-[200px] max-h-[400px] w-full"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild disabled={isLoading}>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading || !systemPrompt.trim()}
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
