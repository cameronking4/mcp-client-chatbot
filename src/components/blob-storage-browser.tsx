"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "ui/card";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Copy, FileIcon, CheckCircle, AlertCircle, FolderIcon, ArrowLeft, Database } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "ui/skeleton";

interface BlobContainer {
  id: string;
  name: string;
  properties: {
    lastModified: string;
    publicAccess?: string;
    leaseStatus?: string;
  };
}

interface BlobItem {
  id: string;
  name: string;
  contentType?: string;
  contentLength?: number;
  createdOn?: string;
  lastModified?: string;
}

export function BlobStorageBrowser() {
  const [containers, setContainers] = useState<BlobContainer[]>([]);
  const [blobs, setBlobs] = useState<BlobItem[]>([]);
  const [currentContainer, setCurrentContainer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fetch containers
  const fetchContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/blob-resources?action=listContainers');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Failed to list containers');
      }
      
      setContainers(data.containers || []);
    } catch (err: any) {
      console.error('Error fetching containers:', err);
      setError(err.message || 'Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch blobs in a container
  const fetchBlobs = async (containerName: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/blob-resources?action=listBlobs&container=${containerName}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || `Failed to list blobs in ${containerName}`);
      }
      
      setBlobs(data.blobs || []);
      setCurrentContainer(containerName);
    } catch (err: any) {
      console.error(`Error fetching blobs in ${containerName}:`, err);
      setError(err.message || `Failed to fetch blobs in ${containerName}`);
    } finally {
      setLoading(false);
    }
  };

  // Load containers on component mount
  useEffect(() => {
    fetchContainers();
  }, []);

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

  // Get resource URI for a blob
  const getBlobResourceUri = (containerName: string, blobName: string, format: "blob" | "project-files" = "blob") => {
    if (format === "blob") {
      return `blob://${containerName}/${blobName}`;
    } else {
      return `project-files://${containerName}/${blobName}`;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderIcon size={18} className="text-primary" />
            Azure Blob Storage
          </CardTitle>
          {error ? (
            <Badge variant="outline" className="bg-red-50 border-red-200 text-red-600">
              <AlertCircle size={12} className="mr-1" /> Error
            </Badge>
          ) : loading ? (
            <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-600">
              <span className="animate-pulse mr-1">●</span> Loading...
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-600">
              <CheckCircle size={12} className="mr-1" /> Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          {currentContainer 
            ? `Viewing blobs in container "${currentContainer}"`
            : "Browse Azure Storage containers and blobs"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 p-3 bg-red-50 rounded-md">
            <AlertCircle size={14} className="inline-block mr-1" />
            {error}
          </div>
        )}
        
        <div className="text-sm p-3 bg-blue-50 text-blue-700 rounded-md mb-4">
          <div className="font-medium mb-1">MCP Resource Usage:</div>
          <p className="mb-1">• Use <code className="bg-blue-100 px-1 rounded">blob://container/blobname</code> to access any blob directly</p>
          {currentContainer === "project-files" && (
            <p>• For project files, use <code className="bg-blue-100 px-1 rounded">project-files://projectId/fileId</code> format for better integration</p>
          )}
        </div>
        
        {currentContainer && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs mb-4"
            onClick={() => {
              setCurrentContainer(null);
              fetchContainers();
            }}
          >
            <ArrowLeft size={14} className="mr-1" /> Back to Containers
          </Button>
        )}
        
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6 rounded-md" />
                <Skeleton className="h-6 flex-1 rounded-md" />
              </div>
            ))}
          </div>
        ) : currentContainer ? (
          // Show blobs in the current container
          <div className="space-y-2">
            {blobs.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No blobs found in this container
              </div>
            ) : (
              blobs.map((blob) => (
                <div key={blob.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-lg">{getFileIcon(blob.contentType, blob.name)}</span>
                    <div className="truncate">
                      <div className="text-sm font-medium truncate" title={blob.name}>
                        {blob.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{formatFileSize(blob.contentLength)}</span>
                        {blob.contentType && (
                          <Badge variant="outline" className="text-[10px] px-1 h-4">
                            {blob.contentType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="size-7" 
                      title="Copy blob:// Resource URI"
                      onClick={() => copyToClipboard(getBlobResourceUri(currentContainer, blob.name, "blob"), blob.name)}
                    >
                      {copied === blob.name ? (
                        <CheckCircle className="size-3.5 text-green-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                    {currentContainer === "project-files" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-7" 
                        title="Copy project-files:// Resource URI"
                        onClick={() => copyToClipboard(getBlobResourceUri(currentContainer, blob.name, "project-files"), `${blob.name} (project-files URI)`)}
                      >
                        <Database className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Show containers list
          <div className="space-y-2">
            {containers.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No containers found
              </div>
            ) : (
              containers.map((container) => (
                <div 
                  key={container.id} 
                  className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/30 cursor-pointer"
                  onClick={() => fetchBlobs(container.name)}
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon size={18} className="text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{container.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Last modified: {new Date(container.properties.lastModified).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchBlobs(container.name);
                    }}
                  >
                    View Blobs
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 