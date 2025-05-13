import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";

export const azureDeleteFileTool = createTool({
  description: "Delete a file from Azure Storage (will prompt user to confirm)",
  parameters: z.object({
    projectId: z.string().describe("The ID of the project containing the file"),
    fileId: z.string().describe("The ID of the file to delete"),
    fileName: z.string().describe("The name of the file to delete (for confirmation)"),
    confirmationPrompt: z.string().optional().describe("Optional custom confirmation message to show the user"),
  }),
  execute: async ({ projectId, fileId, fileName, confirmationPrompt }) => {
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

      // Display confirmation dialog to the user
      // Note: This part will be handled on the client side
      // The actual implementation will wait for user confirmation

      return {
        success: true,
        pendingUserConfirmation: true,
        fileToDelete: {
          projectId,
          fileId,
          fileName
        },
        confirmationMessage: confirmationPrompt || `Are you sure you want to delete "${fileName}"?`,
        message: `Requested deletion of "${fileName}". Waiting for user confirmation.`
      };

      // Note: The actual file deletion will be handled by a client-side component
      // that will show a confirmation dialog to the user
    } catch (error: any) {
      return {
        success: false,
        message: `Error preparing file deletion: ${error.message}`
      };
    }
  },
}); 