"use client";
import {
  ChevronRight,
  FlaskConical,
  Loader,
  Pencil,
  RotateCw,
  Settings,
  Trash,
  Wrench,
  Link as LinkIcon,
  Copy,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import { Button } from "ui/button";
import { Card, CardContent, CardHeader } from "ui/card";
import JsonView from "ui/json-view";
import { Separator } from "ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { mutate } from "swr";
import { safe } from "ts-safe";
import { handleErrorWithToast } from "ui/shared-toast";
import {
  connectMcpClientAction,
  disconnectMcpClientAction,
  refreshMcpClientAction,
  removeMcpClientAction,
} from "@/app/api/mcp/actions";
import type { MCPServerInfo, MCPToolInfo, MCPResourceInfo } from "app-types/mcp";
import { Switch } from "ui/switch";
import { Label } from "ui/label";
import { ToolDetailPopup } from "./tool-detail-popup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { toast } from "sonner";

// Tools list component
const ToolsList = memo(({ tools }: { tools: MCPToolInfo[] }) => (
  <div className="space-y-2 pr-2">
    {tools.map((tool) => (
      <ToolDetailPopup key={tool.name} tool={tool}>
        <div className="flex cursor-pointer bg-secondary rounded-md p-2 hover:bg-input transition-colors">
          <div className="flex-1 w-full">
            <p className="font-medium text-sm mb-1">{tool.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {tool.description}
            </p>
          </div>
          <div className="flex items-center px-1 justify-center self-stretch">
            <ChevronRight size={16} />
          </div>
        </div>
      </ToolDetailPopup>
    ))}
  </div>
));

ToolsList.displayName = "ToolsList";

// Error alert component
const ErrorAlert = memo(({ error }: { error: string }) => (
  <div className="px-6 pb-2">
    <Alert variant="destructive" className="border-destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  </div>
));

ErrorAlert.displayName = "ErrorAlert";

// Resource detail popup component
const ResourceDetailPopup = memo(
  ({ children, resource }: { children: React.ReactNode; resource: MCPResourceInfo }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <div onClick={() => setIsOpen(true)}>{children}</div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">Resource: {resource.name}</DialogTitle>
              <DialogDescription className="text-xs">
                Resource URI details
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-1">URI</h3>
                <div className="bg-muted p-2 rounded-md text-sm font-mono overflow-auto">
                  {resource.uri}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(resource.uri);
                    toast.success("Resource URI copied to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy URI
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

ResourceDetailPopup.displayName = "ResourceDetailPopup";

// Resources list component
const ResourcesList = memo(({ resources }: { resources: MCPResourceInfo[] }) => (
  <div className="space-y-2 pr-2">
    {resources.map((resource) => (
      <ResourceDetailPopup key={resource.uri} resource={resource}>
        <div className="flex cursor-pointer bg-secondary rounded-md p-2 hover:bg-input transition-colors">
          <div className="flex-1 w-full">
            <p className="font-medium text-sm mb-1">{resource.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {resource.uri}
            </p>
          </div>
          <div className="flex items-center px-1 justify-center self-stretch">
            <ChevronRight size={16} />
          </div>
        </div>
      </ResourceDetailPopup>
    ))}
  </div>
));

ResourcesList.displayName = "ResourcesList";

// Main MCPCard component
export const MCPCard = memo(function MCPCard({
  config,
  error,
  status,
  name,
  toolInfo,
  resourceInfo,
}: MCPServerInfo) {
  const [isProcessing, setIsProcessing] = useState(false);

  const isLoading = useMemo(() => {
    return isProcessing || status === "loading";
  }, [isProcessing, status]);

  const errorMessage = useMemo(() => {
    if (error) {
      return JSON.stringify(error);
    }
    return null;
  }, [error]);

  const pipeProcessing = useCallback(
    async (fn: () => Promise<any>) =>
      safe(() => setIsProcessing(true))
        .ifOk(fn)
        .ifOk(() => mutate("mcp-list"))
        .ifFail(handleErrorWithToast)
        .watch(() => setIsProcessing(false)),
    [],
  );

  const handleRefresh = useCallback(
    () => pipeProcessing(() => refreshMcpClientAction(name)),
    [name],
  );

  const handleDelete = useCallback(async () => {
    await pipeProcessing(() => removeMcpClientAction(name));
  }, [name]);

  const handleToggleConnection = useCallback(async () => {
    await pipeProcessing(() =>
      status === "connected"
        ? disconnectMcpClientAction(name)
        : connectMcpClientAction(name),
    );
  }, [name, status]);

  return (
    <Card className="relative hover:border-foreground/20 transition-colors">
      {isLoading && (
        <div className="animate-pulse z-10 absolute inset-0 bg-background/50 flex items-center justify-center w-full h-full" />
      )}
      <CardHeader className="flex items-center gap-1 mb-2">
        {isLoading && <Loader className="size-4 z-20 animate-spin mr-1" />}

        <h4 className="font-bold text-lg ">{name}</h4>
        <div className="flex-1" />

        <Label
          htmlFor={`mcp-card-switch-${name}`}
          className="mr-2 text-xs text-muted-foreground"
        >
          {status === "connected" ? "enabled" : "disabled"}
        </Label>
        <Switch
          id={`mcp-card-switch-${name}`}
          checked={status === "connected"}
          onCheckedChange={handleToggleConnection}
          className="mr-2"
        />
        <div className="h-4">
          <Separator orientation="vertical" />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/mcp/test/${encodeURIComponent(name)}`}
              className="cursor-pointer"
            >
              <Button variant="ghost" size="icon">
                <FlaskConical className="size-3.5" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Tools Test</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RotateCw className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={handleDelete}>
              <Trash className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={`/mcp/modify/${encodeURIComponent(name)}`}
              className="cursor-pointer"
            >
              <Button variant="ghost" size="icon">
                <Pencil className="size-3.5" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit</p>
          </TooltipContent>
        </Tooltip>
      </CardHeader>

      {errorMessage && <ErrorAlert error={errorMessage} />}

      <div className="relative">
        <CardContent className="flex min-w-0 h-full flex-row gap-4 text-sm max-h-[240px] overflow-y-auto">
          <div className="w-1/2 min-w-0 flex flex-col h-full pr-2 border-r">
            <div className="flex items-center gap-2 mb-2 pt-2 pb-1 z-10">
              <Settings size={14} className="text-muted-foreground" />
              <h5 className="text-muted-foreground text-sm font-medium">
                Configuration
              </h5>
            </div>
            <JsonView data={config} />
          </div>

          <div className="w-1/2 min-w-0  flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 pt-2 pb-1 z-10">
              <Wrench size={14} className="text-muted-foreground" />
              <h5 className="text-muted-foreground text-sm font-medium">
                Available Tools ({toolInfo.length})
              </h5>
            </div>

            {toolInfo.length > 0 ? (
              <ToolsList tools={toolInfo} />
            ) : (
              <div className="bg-secondary/30 rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  No tools available
                </p>
              </div>
            )}
            
            {/* Resources section */}
            <div className="flex items-center gap-2 mt-6 mb-2 pt-2 pb-1 z-10">
              <LinkIcon size={14} className="text-muted-foreground" />
              <h5 className="text-muted-foreground text-sm font-medium">
                Available Resources ({resourceInfo?.length || 0})
              </h5>
            </div>
            
            {resourceInfo && resourceInfo.length > 0 ? (
              <ResourcesList resources={resourceInfo} />
            ) : (
              <div className="bg-secondary/30 rounded-md p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  No resources available
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
});
