import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Upload, FileUp, Loader, X } from "lucide-react";
import { AzureStorageClient } from "lib/azure-storage";
import { generateUUID } from "lib/utils";
import { formatBytes } from "lib/utils";

export interface FileUploadProps {
  projectId: string;
  promptMessage?: string;
  onComplete: (success: boolean, message: string, file?: any) => void;
  onClose: () => void;
}

export function FileUpload({
  projectId,
  promptMessage,
  onComplete,
  onClose,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    
    try {
      // Get connection string from environment or config
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        onComplete(false, "Azure Storage connection string is not configured");
        return;
      }
      
      const storageClient = new AzureStorageClient(connectionString);
      const fileId = generateUUID();
      
      // Read the file content
      const fileArrayBuffer = await readFileAsync(selectedFile);
      const content = Buffer.from(fileArrayBuffer);
      
      const uploadedFile = await storageClient.uploadFile(
        projectId,
        fileId,
        selectedFile.name,
        content,
        selectedFile.type || 'application/octet-stream'
      );
      
      onComplete(true, `Successfully uploaded "${selectedFile.name}"`, uploadedFile);
    } catch (error: any) {
      onComplete(false, `Error uploading file: ${error.message}`);
    } finally {
      setIsUploading(false);
      onClose();
    }
  };
  
  // Helper to read file as ArrayBuffer
  const readFileAsync = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload File</CardTitle>
        <CardDescription>
          {promptMessage || "Select or drag a file to upload"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`
            border-2 border-dashed rounded-lg p-12 text-center
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            transition-colors duration-150 ease-in-out
            cursor-pointer
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(selectedFile.size)}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Click to select or drag & drop</p>
              <p className="text-xs text-muted-foreground">
                Supports any file type
              </p>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onClose}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 