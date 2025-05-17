import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsGetWorkItemTool = createTool({
  description: "Get details of a specific work item from Azure DevOps by ID",
  parameters: z.object({
    workItemId: z.number().describe("The ID of the work item to retrieve"),
    includeRelations: z.boolean().optional().default(true).describe("Whether to include work item relations (default: true)"),
    fields: z.array(z.string()).optional().describe("Specific fields to retrieve (optional, if not provided all fields will be returned)"),
  }),
  execute: async ({ workItemId, includeRelations = true, fields }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Get work item
      const workItem = await client.getWorkItem(workItemId, includeRelations);
      
      // If specific fields were requested, filter the response
      if (fields && fields.length > 0) {
        const filteredFields: Record<string, any> = {};
        
        for (const field of fields) {
          if (workItem.fields[field] !== undefined) {
            filteredFields[field] = workItem.fields[field];
          }
        }
        
        return {
          success: true,
          workItem: {
            id: workItem.id,
            rev: workItem.rev,
            fields: filteredFields,
            relations: includeRelations ? workItem.relations : undefined,
            url: workItem.url,
          }
        };
      }
      
      return {
        success: true,
        workItem
      };
    } catch (error: any) {
      console.error("Error retrieving work item:", error);
      
      return {
        success: false,
        message: `Error retrieving work item: ${error.message}`
      };
    }
  },
});
