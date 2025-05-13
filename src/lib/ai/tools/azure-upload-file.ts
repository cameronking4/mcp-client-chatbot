import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { AzureStorageClient } from "lib/azure-storage";
import { generateUUID } from "lib/utils";

export const azureUploadFileTool = createTool({
  description: "Upload a file to Azure Storage from text content or prompt user to select a file",
  parameters: z.object({
    projectId: z.string().describe("The ID of the project to upload the file to"),
    fileName: z.string().optional().describe("The name to give the uploaded file (if uploading text content)"),
    fileContent: z.string().optional().describe("The content of the file to upload (if uploading text content)"),
    contentType: z.string().optional().default("text/plain").describe("The content type of the file (if uploading text content)"),
    promptUser: z.boolean().optional().default(false).describe("Whether to prompt the user to select a file from their device"),
    promptMessage: z.string().optional().describe("Message to show when prompting the user to select a file"),
  }),
  execute: async ({ projectId, fileName, fileContent, contentType = "text/plain", promptUser = false, promptMessage }) => {
    await wait(500);

    try {
      // Get connection string from environment
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString) {
        return {
          success: false,
          message: "Azure Storage connection string is not configured"
        };
      }

      // If we're prompting the user to select a file
      if (promptUser) {
        return {
          success: true,
          pendingUserAction: true,
          action: "upload",
          projectId,
          promptMessage: promptMessage || "Please select a file to upload",
          message: "Waiting for user to select a file to upload."
        };
      }
      
      // Direct upload of text content
      if (fileContent && fileName) {
        const storageClient = new AzureStorageClient(connectionString);
        const fileId = generateUUID();
        
        const uploadedFile = await storageClient.uploadFile(
          projectId,
          fileId,
          fileName,
          fileContent,
          contentType
        );
        
        return {
          success: true,
          file: uploadedFile,
          message: `Successfully uploaded file "${fileName}" (${uploadedFile.size} bytes) with ID: ${fileId}`
        };
      }
      
      return {
        success: false,
        message: "Either promptUser must be true, or both fileName and fileContent must be provided"
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error uploading file: ${error.message}`
      };
    }
  },
}); 