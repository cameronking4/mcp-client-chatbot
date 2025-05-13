import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { AzureStorageClient, azureStorage } from "lib/azure-storage";
import { BlobSASPermissions, BlobServiceClient, SASProtocol } from "@azure/storage-blob";

export const azureImportFileTool = createTool({
  description: "Import file content from Azure Storage into the chat as a message",
  parameters: z.object({
    projectId: z.string().describe("The ID of the project containing the file"),
    fileId: z.string().describe("The ID of the file to import"),
    fileName: z.string().describe("The name of the file (for display purposes)"),
    maxSize: z.number().optional().default(1024 * 1024).describe("Maximum file size to import in bytes (default: 1MB)"),
    includeDownloadLink: z.boolean().optional().default(true).describe("Include a download link for the file (default: true)"),
  }),
  execute: async ({ projectId, fileId, fileName, maxSize = 1024 * 1024, includeDownloadLink = true }) => {
    await wait(500);

    try {
      // Get connection string from environment
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      
      // Generate a download URL regardless of import success
      let downloadUrl: string | undefined = undefined;
      
      if (includeDownloadLink) {
        if (connectionString) {
          // Real Azure storage - generate SAS token
          try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient('project-files');
            const blobName = `${projectId}/${fileId}`;
            const blobClient = containerClient.getBlobClient(blobName);

            // Set expiration time - 24 hours
            const expiresOn = new Date();
            expiresOn.setHours(expiresOn.getHours() + 24);

            // Generate SAS token with read permission
            downloadUrl = await blobClient.generateSasUrl({
              permissions: BlobSASPermissions.parse("r"),
              expiresOn,
              contentDisposition: `attachment; filename="${fileName}"`,
              protocol: SASProtocol.Https,
            });
            
            console.log(`Generated SAS URL for file download: ${fileName}`);
          } catch (error) {
            console.error("Error generating download link:", error);
          }
        } else {
          // Mock storage - use API endpoint
          downloadUrl = `/api/project-files/${projectId}/${fileId}/download`;
          console.log(`Using mock API endpoint for file download: ${fileName}`);
        }
      }
      
      if (!connectionString) {
        return {
          success: false,
          downloadUrl,
          message: "Azure Storage connection string is not configured, but a download link has been provided.",
          importAction: downloadUrl ? "download-file" : "error"
        };
      }

      const storageClient = new AzureStorageClient(connectionString);
      
      try {
        // Get file metadata first to check size
        const metadata = await storageClient.getFileMetadata(projectId, fileId);
        const fileSize = metadata.size || 0;
        
        // Check size limit before downloading the content
        if (fileSize > maxSize) {
          return {
            success: true,
            fileName,
            fileSize,
            downloadUrl,
            isText: false,
            importAction: "download-file",
            message: `File "${fileName}" is too large (${fileSize} bytes) to import directly. A download link has been provided instead.`
          };
        }
        
        // Get the file content
        const fileContent = await storageClient.getFileContent(projectId, fileId);
        
        // Determine if this is a text file we can display directly
        const isTextFile = fileName.match(/\.(txt|csv|json|md|js|ts|html|css|xml|yaml|yml)$/i);
        
        if (isTextFile) {
          const textContent = fileContent.toString('utf-8');
          
          return {
            success: true,
            fileName,
            fileContent: textContent,
            fileSize: fileContent.length,
            isText: true,
            downloadUrl,
            importAction: "add-to-message",
            message: `Imported text file "${fileName}" (${fileContent.length} bytes)`
          };
        } else {
          // For binary files, we'll return a base64 representation
          // This is not ideal for very large files, but works for small binary files
          const base64Content = fileContent.toString('base64');
          
          return {
            success: true,
            fileName,
            fileContent: base64Content,
            fileSize: fileContent.length,
            isText: false,
            contentType: metadata.contentType || "application/octet-stream",
            downloadUrl,
            importAction: "add-to-message",
            message: `Imported binary file "${fileName}" (${fileContent.length} bytes)`
          };
        }
      } catch (error: any) {
        return {
          success: false,
          downloadUrl,
          message: `Error retrieving file content: ${error.message}. ${downloadUrl ? "A download link has been provided instead." : ""}`,
          importAction: downloadUrl ? "download-file" : "error"
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Error importing file: ${error.message}`
      };
    }
  },
}); 