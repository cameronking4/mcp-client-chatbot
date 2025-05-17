import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient, WorkItemRelation } from "lib/azure-devops";

export const azureDevOpsCreateWorkItemTool = createTool({
  description: "Create a new work item in Azure DevOps",
  parameters: z.object({
    workItemType: z.string().describe("The type of work item to create (e.g., 'Bug', 'Task', 'User Story', 'Feature', etc.)"),
    fields: z.record(z.any()).describe("Object containing field names and values for the new work item"),
    relations: z.array(
      z.object({
        rel: z.string().describe("Relation type (e.g., 'System.LinkTypes.Hierarchy-Forward')"),
        url: z.string().describe("URL of the related work item"),
        attributes: z.object({
          name: z.string().optional().describe("Optional name for the relation"),
        }).passthrough().describe("Optional relation attributes"),
      })
    ).optional().describe("Relations to add to the work item (optional)"),
  }),
  execute: async ({ workItemType, fields, relations }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Create work item
      const workItem = await client.createWorkItem(
        workItemType,
        fields,
        relations as WorkItemRelation[]
      );
      
      return {
        success: true,
        workItem,
        message: `Work item created successfully with ID ${workItem.id}`
      };
    } catch (error: any) {
      console.error("Error creating work item:", error);
      
      return {
        success: false,
        message: `Error creating work item: ${error.message}`
      };
    }
  },
});
