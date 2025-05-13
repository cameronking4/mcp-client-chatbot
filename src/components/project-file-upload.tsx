"use client";

import { useState, useRef } from "react";
import { Button } from "ui/button";
import { Loader2, X, FileUp, File as FileIcon, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/utils";

interface ProjectFile {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectFileUploadProps {
  projectId: string;
  children?: React.ReactNode;
  onFileUploaded?: () => void;
  maxSizeMB?: number;
}

export function ProjectFileUpload({
  projectId,
  children,
  onFileUploaded,
  maxSizeMB = 100, // Default max size is 10MB
}: ProjectFileUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();

  // Fetch project files when dialog opens
  const fetchFiles = async () => {
    if (!isOpen) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/project-files/${projectId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch project files");
      }
      
      const data = await response.json();
      setFiles(data.files);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast.error("Failed to load project files");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      setSelectedFile(null);
      return;
    }
    
    const file = selectedFiles[0];
    
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds maximum limit of ${maxSizeMB}MB`);
      setSelectedFile(null);
      e.target.value = "";
      return;
    }
    
    setSelectedFile(file);
  };

  // Notify MCP server of file changes
  const notifyMcpFileChange = async (fileId: string, changeType: 'create' | 'update' | 'delete') => {
    try {
      // Call the MCP server notification endpoint
      const response = await fetch(`/api/mcp/notify-file-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          fileId,
          changeType,
          silent: true // Use silent mode to avoid verbose responses
        }),
      });
      
      if (!response.ok) {
        console.warn("Failed to notify MCP server of file change");
      }
    } catch (error) {
      console.warn("Error notifying MCP server:", error);
      // Don't throw - this is a non-critical operation
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 300);
      
      const response = await fetch(`/api/project-files/${projectId}`, {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }
      
      const data = await response.json();
      console.log('data', data);
      
      // Notify MCP server of file creation
      if (data?.file?.id) {
        await notifyMcpFileChange(data.file.id, 'create');
      }
      
      // Reset state
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      toast.success("File uploaded successfully");
      
      // Refresh file list
      fetchFiles();
      
      // Callback for parent component
      if (onFileUploaded) {
        onFileUploaded();
      }
      
      // Refresh the page to update the MCP context
      router.refresh();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/project-files/${projectId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete file");
      }
      
      // Notify MCP server of file deletion
      await notifyMcpFileChange(fileId, 'delete');
      
      // Remove file from state
      setFiles((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
      
      toast.success("File deleted successfully");
      
      // Refresh the page to update the MCP context
      router.refresh();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) {
        fetchFiles();
      }
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button className="rounded-full bg-secondary font-semibold">
            <FileUp className="size-3.5 mr-2" />
            Upload File
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project Files</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* File Upload Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium mb-2">Upload New File</h3>
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="block w-full text-sm
                  file:mr-4 file:py-2 file:px-4 file:rounded-full
                  file:border-0 file:text-sm file:font-semibold
                  file:bg-secondary file:text-foreground
                  hover:file:bg-muted cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-md">
                  <FileIcon className="size-4 text-primary" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}
              
              {isUploading && uploadProgress > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                  <div
                    className="bg-primary h-1.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
              
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="size-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* File List Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-sm font-medium mb-2">Project Files</h3>
            
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No files uploaded yet
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md group"
                  >
                    <FileIcon className="size-4 text-primary" />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(file.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 