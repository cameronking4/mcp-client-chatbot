import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient, WorkItemRelation } from "lib/azure-devops";

export const azureDevOpsUpdateWorkItemTool = createTool({
  description: "Update fields of an existing work item in Azure DevOps",
  parameters: z.object({
    workItemId: z.number().describe("The ID of the work item to update"),
    fields: z.record(z.any()).describe("Object containing field names and values to update"),
    addRelations: z.array(
      z.object({
        rel: z.string().describe("Relation type (e.g., 'System.LinkTypes.Hierarchy-Forward')"),
        url: z.string().describe("URL of the related work item"),
        attributes: z.object({
          name: z.string().optional().describe("Optional name for the relation"),
        }).passthrough().describe("Optional relation attributes"),
      })
    ).optional().describe("Relations to add to the work item (optional)"),
    removeRelationUrls: z.array(z.string()).optional().describe("URLs of relations to remove from the work item (optional)"),
  }),
  execute: async ({ workItemId, fields, addRelations, removeRelationUrls }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Prepare relations object if either add or remove relations are provided
      let relations: { add?: WorkItemRelation[], remove?: string[] } | undefined;
      
      if (addRelations || removeRelationUrls) {
        relations = {};
        
        if (addRelations && addRelations.length > 0) {
          relations.add = addRelations as WorkItemRelation[];
        }
        
        if (removeRelationUrls && removeRelationUrls.length > 0) {
          relations.remove = removeRelationUrls;
        }
      }
      
      // Update work item
      const updatedWorkItem = await client.updateWorkItem(workItemId, fields, relations);
      
      return {
        success: true,
        workItem: updatedWorkItem,
        message: `Work item ${workItemId} updated successfully`
      };
    } catch (error: any) {
      console.error("Error updating work item:", error);
      
      return {
        success: false,
        message: `Error updating work item: ${error.message}`
      };
    }
  },
});
