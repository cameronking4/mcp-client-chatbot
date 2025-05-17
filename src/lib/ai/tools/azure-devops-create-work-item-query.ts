import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsCreateWorkItemQueryTool = createTool({
  description: "Create a new saved work item query in Azure DevOps",
  parameters: z.object({
    name: z.string().describe("Name of the query to create"),
    wiqlQuery: z.string().describe("WIQL query string (e.g., 'SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me')"),
    path: z.string().describe("Path where to create the query (e.g., '/Shared Queries/My Folder')"),
    isPublic: z.boolean().optional().default(true).describe("Whether the query should be public (default: true)"),
  }),
  execute: async ({ name, wiqlQuery, path, isPublic = true }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Create work item query
      const query = await client.createWorkItemQuery(name, wiqlQuery, path, isPublic);
      
      return {
        success: true,
        query,
        message: `Work item query '${name}' created successfully`
      };
    } catch (error: any) {
      console.error("Error creating work item query:", error);
      
      return {
        success: false,
        message: `Error creating work item query: ${error.message}`
      };
    }
  },
});
