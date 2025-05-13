import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { AzureStorageClient } from "lib/azure-storage";

export const azureSearchFilesTool = createTool({
  description: "Search for files in Azure Storage by name, content type, or file extension",
  parameters: z.object({
    projectId: z.string().describe("The ID of the project to search files in"),
    searchTerm: z.string().describe("The term to search for in file names"),
    caseSensitive: z.boolean().optional().default(false).describe("Whether the search should be case-sensitive"),
    contentType: z.string().optional().describe("Filter by content type (e.g., 'text/csv', 'application/json')"),
    extension: z.string().optional().describe("Filter by file extension (e.g., '.csv', '.json')"),
    limit: z.number().optional().describe("Maximum number of files to return (defaults to all)"),
  }),
  execute: async ({ projectId, searchTerm, caseSensitive = false, contentType, extension, limit }) => {
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
      const allFiles = await storageClient.listProjectFiles(projectId);

      // Apply filters based on search criteria
      const searchTermLower = caseSensitive ? searchTerm : searchTerm.toLowerCase();
      
      const filteredFiles = allFiles.filter(file => {
        // Check file name match
        const nameMatch = caseSensitive 
          ? file.name.includes(searchTerm)
          : file.name.toLowerCase().includes(searchTermLower);
        
        // Check content type if specified
        const contentTypeMatch = !contentType || file.contentType.includes(contentType);
        
        // Check extension if specified
        const extensionMatch = !extension || 
          file.name.toLowerCase().endsWith(extension.toLowerCase());
        
        return nameMatch && contentTypeMatch && extensionMatch;
      });

      // Apply limit if specified
      const limitedFiles = limit ? filteredFiles.slice(0, limit) : filteredFiles;

      return {
        success: true,
        files: limitedFiles,
        totalMatches: filteredFiles.length,
        returnedMatches: limitedFiles.length,
        message: `Found ${filteredFiles.length} file(s) matching "${searchTerm}"${
          limitedFiles.length !== filteredFiles.length ? `, showing ${limitedFiles.length}` : ""
        }`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error searching files: ${error.message}`
      };
    }
  },
}); 