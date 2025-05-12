"use client";

import { ChevronDown, CornerRightUp, Paperclip, Pause, X } from "lucide-react";
import { ReactNode, useMemo, useState, useRef, useEffect } from "react";
import { Button } from "ui/button";
import { notImplementedToast } from "ui/shared-toast";
import { PastesContentCard } from "./pasts-content";
import { UseChatHelpers } from "@ai-sdk/react";
import { SelectModel } from "./select-model";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { customModelProvider } from "lib/ai/models";
import { createMCPToolId } from "lib/ai/mcp/mcp-tool-id";
import { ChatMessageAnnotation } from "app-types/chat";
import dynamic from "next/dynamic";
import { ToolChoiceDropDown } from "./tool-choice-dropdown";

import { MCPServerBindingSelector } from "./mcp-server-binding";
import { MCPServerBinding } from "app-types/mcp";
import { toast } from "sonner";

interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  ownerType?: MCPServerBinding["ownerType"];
  ownerId: string;
  append: UseChatHelpers["append"];
  toolDisabled?: boolean;
  isLoading?: boolean;
}

// Helper function to get text preview from text files
export function TextFilePreview({ file }: { file: File }) {
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      setContent(typeof text === "string" ? text.slice(0, 100) : "");
    };
    reader.readAsText(file);
  }, [file]);

  return (
    <div>
      {content}
      {content.length >= 100 && "..."}
    </div>
  );
}

const MentionInput = dynamic(() => import("./mention-input"), {
  ssr: false,
  loading() {
    return <div className="h-[2rem] w-full animate-pulse"></div>;
  },
});

export default function PromptInput({
  placeholder = "What do you want to know?",
  append,
  input,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  ownerType = "thread",
  ownerId,
}: PromptInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [appStoreMutate, model, mcpList] = appStore(
    useShallow((state) => [state.mutate, state.model, state.mcpList]),
  );

  const [toolMentionItems, setToolMentionItems] = useState<
    { id: string; label: ReactNode; [key: string]: any }[]
  >([]);

  const modelList = useMemo(() => {
    return customModelProvider.modelsInfo;
  }, []);

  const [pastedContents, setPastedContents] = useState<string[]>([]);

  const toolList = useMemo(() => {
    return (
      mcpList
        ?.filter((mcp) => mcp.status === "connected")
        .flatMap((mcp) => [
          {
            id: mcp.name,
            label: mcp.name,
            type: "server",
          },
          ...mcp.toolInfo.map((tool) => {
            const id = createMCPToolId(mcp.name, tool.name);
            return {
              id,
              label: id,
              type: "tool",
            };
          }),
        ]) ?? []
    );
  }, [mcpList]);

  // Handle file upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle files selected from the file dialog
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      const validFiles = Array.from(selectedFiles).filter(
        (file) =>
          file.type.startsWith("image/") || 
          file.type.startsWith("text/") || 
          file.type.startsWith("application/")
      );

      if (validFiles.length === selectedFiles.length) {
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        toast("Only image, text, and document files are allowed");
      }
    }
  };

  // Handle paste events (for images)
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (text.length > 500) {
      setPastedContents([...pastedContents, text]);
      e.preventDefault();
      return;
    }

    const items = e.clipboardData?.items;
    if (items) {
      const fileItems = Array.from(items)
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (fileItems.length > 0) {
        const validFiles = fileItems.filter(
          (file) =>
            file.type.startsWith("image/") || file.type.startsWith("text/")
        );

        if (validFiles.length === fileItems.length) {
          const dataTransfer = new DataTransfer();
          validFiles.forEach((file) => dataTransfer.items.add(file));
          setFiles(dataTransfer.files);
          e.preventDefault();
        } else {
          toast("Only image and text files are allowed from clipboard");
        }
      }
    }
  };

  // Handle drag over events
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  // Handle drag leave events
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  // Handle drop events
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    
    const droppedFiles = event.dataTransfer.files;
    const droppedFilesArray = Array.from(droppedFiles);

    if (droppedFilesArray.length > 0) {
      const validFiles = droppedFilesArray.filter(
        (file) =>
          file.type.startsWith("image/") ||
          file.type.startsWith("text/") ||
          file.type.startsWith("application/")
      );

      if (validFiles.length === droppedFilesArray.length) {
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        toast("Only image, text, and document files are allowed!");
      }
    }
    setIsDragging(false);
  };

  // Clear files
  const clearFiles = () => {
    setFiles(null);
  };

  const submit = () => {
    if (isLoading) return;
    const userMessage = input?.trim() || "";

    const pastedContentsParsed = pastedContents.map((content) => ({
      type: "text" as const,
      text: content,
    }));

    if (userMessage.length === 0 && pastedContentsParsed.length === 0 && (!files || files.length === 0)) {
      return;
    }

    const annotations: ChatMessageAnnotation[] = [];
    if (toolMentionItems.length > 0) {
      annotations.push({
        requiredTools: toolMentionItems.map((item) => item.id),
      });
    }

    // Create options object with attachments if available
    const options = files ? { experimental_attachments: files } : undefined;

    setPastedContents([]);
    setToolMentionItems([]);
    setInput("");
    setFiles(null);
    append!(
      {
        role: "user",
        content: "",
        annotations,
        parts: [
          ...pastedContentsParsed,
          {
            type: "text",
            text: userMessage,
          },
        ],
      },
      options
    );
  };

  return (
    <div 
      className="max-w-3xl mx-auto fade-in animate-in"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 pointer-events-none dark:bg-zinc-900/90 rounded-2xl z-10 flex flex-col justify-center items-center gap-1 bg-zinc-100/90">
          <div>Drag and drop files here</div>
          <div className="text-sm dark:text-zinc-400 text-zinc-500">
            {"(images, text, and documents)"}
          </div>
        </div>
      )}

      {/* File previews */}
      {files && files.length > 0 && (
        <div className="flex flex-row gap-2 overflow-x-auto max-w-full pb-2 mb-2">
          {Array.from(files).map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative group"
            >
              {file.type.startsWith("image/") ? (
                <div className="relative w-14 h-14">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-14 h-14 object-cover rounded-md border border-border"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFiles();
                    }}
                    className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="relative w-14 h-14 flex items-center justify-center bg-muted/30 rounded-md border border-border text-xs text-muted-foreground overflow-hidden">
                  <div className="p-1 truncate text-center">
                    {file.name.length > 10 ? `${file.name.substring(0, 10)}...` : file.name}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFiles();
                    }}
                    className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        multiple
        accept="image/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="z-10 mx-auto w-full max-w-3xl relative">
        <fieldset className="flex w-full min-w-0 max-w-full flex-col px-2">
          <div className="rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/40 relative flex w-full flex-col cursor-text z-10 border items-stretch focus-within:border-muted-foreground hover:border-muted-foreground p-3">
            <div className="flex flex-col gap-3.5 px-1">
              <div className="relative min-h-[2rem]">
                <MentionInput
                  input={input}
                  onChange={setInput}
                  onChangeMention={setToolMentionItems}
                  onEnter={submit}
                  placeholder={placeholder}
                  onPaste={handlePaste}
                  items={toolList}
                />
              </div>
              <div className="flex w-full items-center gap-2">
                {pastedContents.map((content, index) => (
                  <PastesContentCard
                    key={index}
                    initialContent={content}
                    deleteContent={() => {
                      setPastedContents((prev) => {
                        const newContents = [...prev];
                        newContents.splice(index, 1);
                        return newContents;
                      });
                    }}
                    updateContent={(content) => {
                      setPastedContents((prev) => {
                        const newContents = [...prev];
                        newContents[index] = content;
                        return newContents;
                      });
                    }}
                  />
                ))}
              </div>
              <div className="flex w-full items-center z-30 gap-1.5">
                <div
                  className="cursor-pointer text-muted-foreground border rounded-full p-2 bg-transparent hover:bg-muted transition-all duration-200"
                  onClick={handleUploadClick}
                >
                  <Paperclip className={`size-4 ${files && files.length > 0 ? "text-primary" : ""}`} />
                </div>

                {!toolDisabled && (
                  <>
                    <ToolChoiceDropDown />
                    <MCPServerBindingSelector
                      ownerId={ownerId}
                      ownerType={ownerType}
                      align="start"
                      side="top"
                    />
                  </>
                )}
                <div className="flex-1" />

                <SelectModel
                  onSelect={(model) => {
                    appStoreMutate({ model });
                  }}
                  providers={modelList}
                  model={model}
                >
                  <Button variant={"ghost"} className="rounded-full">
                    {model}
                    <ChevronDown className="size-3" />
                  </Button>
                </SelectModel>

                <div
                  onClick={() => {
                    if (isLoading) {
                      onStop();
                    } else {
                      submit();
                    }
                  }}
                  className="cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200"
                >
                  {isLoading ? (
                    <Pause
                      size={16}
                      className="fill-muted-foreground text-muted-foreground"
                    />
                  ) : (
                    <CornerRightUp size={16} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
