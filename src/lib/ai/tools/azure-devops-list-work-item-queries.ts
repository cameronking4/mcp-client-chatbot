import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsListWorkItemQueriesTool = createTool({
  description: "List saved work item queries in Azure DevOps",
  parameters: z.object({
    path: z.string().optional().describe("Path to filter queries (optional, e.g., 'Shared Queries/My Folder')"),
    depth: z.number().optional().default(1).describe("Depth of query hierarchy to retrieve (default: 1)"),
    includeDeleted: z.boolean().optional().default(false).describe("Whether to include deleted queries (default: false)"),
  }),
  execute: async ({ path, depth = 1, includeDeleted = false }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // List work item queries
      const queries = await client.listWorkItemQueries(path, depth, includeDeleted);
      
      return {
        success: true,
        queries,
        count: queries.length,
        message: `Found ${queries.length} work item queries`
      };
    } catch (error: any) {
      console.error("Error listing work item queries:", error);
      
      return {
        success: false,
        message: `Error listing work item queries: ${error.message}`
      };
    }
  },
});
