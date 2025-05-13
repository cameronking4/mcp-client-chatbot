import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { AzureStorageClient } from "lib/azure-storage";

export const azureListFilesTool = createTool({
  description: "List all files in Azure Storage for a specific project",
  parameters: z.object({
    projectId: z.string().describe("The ID of the project to list files for"),
    limit: z.number().optional().describe("Maximum number of files to return (defaults to all)"),
    sortBy: z.enum(["name", "createdAt", "updatedAt", "size"]).optional().default("updatedAt").describe("Sort files by this field"),
    sortDirection: z.enum(["asc", "desc"]).optional().default("desc").describe("Sort direction (ascending or descending)"),
  }),
  execute: async ({ projectId, limit, sortBy = "updatedAt", sortDirection = "desc" }) => {
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

      const storageClient = new AzureStorageClient(connectionString);
      const files = await storageClient.listProjectFiles(projectId);

      // Sort the files
      files.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "createdAt":
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "updatedAt":
            comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            break;
          case "size":
            comparison = a.size - b.size;
            break;
        }
        
        return sortDirection === "desc" ? -comparison : comparison;
      });

      // Apply limit if specified
      const limitedFiles = limit ? files.slice(0, limit) : files;

      return {
        success: true,
        files: limitedFiles,
        totalCount: files.length,
        returnedCount: limitedFiles.length,
        message: `Found ${files.length} file(s)${limitedFiles.length !== files.length ? `, showing ${limitedFiles.length}` : ""}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error listing files: ${error.message}`
      };
    }
  },
}); 