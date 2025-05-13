import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AzureStorageClient } from "lib/azure-storage";
import { Loader, Trash2 } from "lucide-react";

export interface FileDeleteConfirmationProps {
  projectId: string;
  fileId: string;
  fileName: string;
  confirmationMessage?: string;
  onComplete: (success: boolean, message: string) => void;
  onClose: () => void;
}

export function FileDeleteConfirmation({
  projectId,
  fileId,
  fileName,
  confirmationMessage,
  onComplete,
  onClose,
}: FileDeleteConfirmationProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      // Get connection string from environment or config
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        onComplete(false, "Azure Storage connection string is not configured");
        return;
      }
      
      const storageClient = new AzureStorageClient(connectionString);
      const success = await storageClient.deleteFile(projectId, fileId);
      
      if (success) {
        onComplete(true, `Successfully deleted file "${fileName}"`);
      } else {
        onComplete(false, `Failed to delete file "${fileName}"`);
      }
    } catch (error: any) {
      onComplete(false, `Error deleting file: ${error.message}`);
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>
            {confirmationMessage || `Are you sure you want to delete "${fileName}"? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={onClose}>Cancel</Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            variant="destructive"
          >
            {isDeleting ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 