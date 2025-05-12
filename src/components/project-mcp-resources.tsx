"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "ui/card";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Copy, FileIcon, CheckCircle, AlertCircle, Link2, GanttChartIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "lib/utils";

interface ProjectMCPResourcesProps {
  projectId: string;
}

export function ProjectMCPResources({ projectId }: ProjectMCPResourcesProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [resourceStatus, setResourceStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resource URIs
  const fileListResource = `project://${projectId}/files`;
  const fileContentTemplate = `project://${projectId}/file/{fileId}`;

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };
  
  // Test resource availability
  useEffect(() => {
    const testResources = async () => {
      try {
        // We'll just check if our Azure implementation is working
        const response = await fetch(`/api/project-files/${projectId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch project files: ${response.statusText}`);
        }
        
        setResourceStatus("success");
      } catch (error) {
        console.error("Error testing MCP resources:", error);
        setResourceStatus("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    };
    
    if (projectId) {
      testResources();
    }
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GanttChartIcon size={18} className="text-primary" />
            MCP Resources
          </CardTitle>
          {resourceStatus === "success" && (
            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-600">
              <CheckCircle size={12} className="mr-1" /> Available
            </Badge>
          )}
          {resourceStatus === "error" && (
            <Badge variant="outline" className="bg-red-50 border-red-200 text-red-600">
              <AlertCircle size={12} className="mr-1" /> Unavailable
            </Badge>
          )}
          {resourceStatus === "loading" && (
            <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-600">
              <span className="animate-pulse mr-1">●</span> Checking...
            </Badge>
          )}
        </div>
        <CardDescription>
          These MCP resources are available for AI models to access project files
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {resourceStatus === "error" ? (
          <div className="text-sm text-red-500 p-3 bg-red-50 rounded-md">
            <AlertCircle size={14} className="inline-block mr-1" />
            {errorMessage || "Failed to connect to MCP resources"}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-sm font-medium">List all files</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <pre className="py-1 px-2 text-xs bg-muted rounded-md font-mono">{fileListResource}</pre>
                  <Badge variant="secondary" className="text-xs">
                    <FileIcon size={10} className="mr-1" /> Files List
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-7" 
                  onClick={() => copyToClipboard(fileListResource, "list resource URI")}
                >
                  {copied === "list resource URI" ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Get file content</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <pre className="py-1 px-2 text-xs bg-muted rounded-md font-mono">{fileContentTemplate}</pre>
                  <Badge variant="secondary" className="text-xs">
                    <Link2 size={10} className="mr-1" /> Content URI
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-7" 
                  onClick={() => copyToClipboard(fileContentTemplate, "content resource URI")}
                >
                  {copied === "content resource URI" ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground mt-2">
              <p>To use in chat, ask the AI about your files or reference these resources directly.</p>
              <p className="mt-1">Example: "What files do I have in this project?" or "Read the content of file X"</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 