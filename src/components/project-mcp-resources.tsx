"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "ui/card";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Copy, FileIcon, CheckCircle, AlertCircle, GanttChartIcon, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface ProjectFile {
  id: string;
  name: string;
  contentType?: string;
  size: number;
  sizeFormatted?: string;
  createdAt: Date;
  updatedAt: Date;
  fileListUri?: string;
  fileByIdUri?: string;
  fileByNameUri?: string;
  directUrl?: string;
}

interface ProjectMCPResourcesProps {
  projectId: string;
}

export function ProjectMCPResources({ projectId }: ProjectMCPResourcesProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [resourceStatus, setResourceStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  

  // Resource URIs
  // const fileListResource = `project://${projectId}/files`;
  // const fileByIdTemplate = `project://${projectId}/file/{fileId}`;
  // const fileByNameTemplate = `project://${projectId}/filename/{fileName}`;

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };
  
  // Fetch project files
  const fetchFiles = async () => {
    try {
      setResourceStatus("loading");
      // Test the direct files endpoint 
      const response = await fetch(`/api/project-files/${projectId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch project files: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFiles(data.files || []);
      setResourceStatus("success");
    } catch (error) {
      console.error("Error fetching project files:", error);
      
      // Try the debug endpoint we just created
      try {
        const debugResponse = await fetch(`/api/project-files/${projectId}/list-mcp-resources`);
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          if (debugData.files && debugData.files.length > 0) {
            setFiles(debugData.files);
            setResourceStatus("success");
            return;
          }
        }
      } catch (debugError) {
        console.error("Debug endpoint also failed:", debugError);
      }
      
      setResourceStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };
  
  // Load files on component mount
  useEffect(() => {
    if (projectId) {
      fetchFiles();
    }
  }, [projectId]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get icon for file type
  const getFileIcon = (contentType?: string, fileName?: string) => {
    if (!contentType && !fileName) return <FileIcon className="size-4" />;
    
    // Check content type first
    if (contentType) {
      if (contentType.startsWith('image/')) return "🖼️";
      if (contentType === 'application/pdf') return "📄";
      if (contentType.includes('spreadsheet') || contentType.includes('csv')) return "📊";
      if (contentType.includes('word') || contentType.includes('document')) return "📝";
      if (contentType.includes('presentation')) return "📑";
    }
    
    // Check file extension
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') return "📄";
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return "🖼️";
      if (['csv', 'xlsx', 'xls'].includes(ext || '')) return "📊";
      if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return "📝";
      if (['ppt', 'pptx'].includes(ext || '')) return "📑";
      if (['mp3', 'wav', 'ogg'].includes(ext || '')) return "🎵";
      if (['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) return "🎬";
    }
    
    return <FileIcon className="size-4" />;
  };

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
            {/* <div className="space-y-2">
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
              <div className="text-xs text-muted-foreground">
                Lists all files in the project with metadata and access URIs.
              </div>
            </div> */}
            
            {/* <div className="space-y-2">
              <div className="text-sm font-medium">Get file by ID</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <pre className="py-1 px-2 text-xs bg-muted rounded-md font-mono">{fileByIdTemplate}</pre>
                  <Badge variant="secondary" className="text-xs">
                    <Link2 size={10} className="mr-1" /> Content by ID
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-7" 
                  onClick={() => copyToClipboard(fileByIdTemplate, "file by ID URI")}
                >
                  {copied === "file by ID URI" ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Get file content by its unique ID. Replace {"{fileId}"} with the actual file ID.
              </div>
            </div> */}
            
            {/* <div className="space-y-2">
              <div className="text-sm font-medium">Get file by name (Recommended)</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <pre className="py-1 px-2 text-xs bg-muted rounded-md font-mono">{fileByNameTemplate}</pre>
                  <Badge variant="secondary" className="text-xs">
                    <FileText size={10} className="mr-1" /> Content by Name
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="size-7" 
                  onClick={() => copyToClipboard(fileByNameTemplate, "file by name URI")}
                >
                  {copied === "file by name URI" ? (
                    <CheckCircle className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Get file content by name (more intuitive for AI). Replace {"{fileName}"} with the file name.
              </div>
            </div> */}
            
            {files.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Available Files ({files.length})</h3>
                  <Button
                    variant="ghost" 
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setShowFiles(!showFiles)}
                  >
                    {showFiles ? "Hide Files" : "Show Files"}
                    <FolderOpen className="ml-1 size-3.5" />
                  </Button>
                </div>
                
                {showFiles && (
                  <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                    {files.map(file => (
                      <div key={file.id} className="text-xs border rounded-md p-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {getFileIcon(file.contentType, file.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{file.name}</div>
                            <div className="text-muted-foreground">{file.contentType} • {file.sizeFormatted || formatFileSize(file.size)}</div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-6" 
                            onClick={() => copyToClipboard(`project://${projectId}/filename/${encodeURIComponent(file.name)}`, `${file.name} URI`)}
                          >
                            {copied === `${file.name} URI` ? (
                              <CheckCircle className="size-3.5 text-green-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <pre 
                            className="py-0.5 px-1.5 text-[10px] bg-muted rounded-md font-mono cursor-pointer" 
                            onClick={() => copyToClipboard(`project://${projectId}/filename/${encodeURIComponent(file.name)}`, `${file.name} URI`)}
                          >
                            project://{projectId}/filename/{file.name}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                <p className="mb-1 font-medium">Usage examples:</p>
                <p>• Ask: &ldquo;What files do I have in this project?&rdquo;</p>
                <p>• Ask: &ldquo;Show me the content of file X&rdquo;</p>
                <p>• Reference directly: &ldquo;Check project://{projectId}/filename/example.txt for details&rdquo;</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
} 