import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsQueryWorkItemsTool = createTool({
  description: "Query work items in Azure DevOps using WIQL (Work Item Query Language)",
  parameters: z.object({
    wiqlQuery: z.string().describe("WIQL query string (e.g., 'SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me')"),
    top: z.number().optional().describe("Maximum number of work items to return (optional)"),
    skip: z.number().optional().describe("Number of work items to skip (optional, for pagination)"),
    fields: z.array(z.string()).optional().describe("Specific fields to retrieve for each work item (optional)"),
  }),
  execute: async ({ wiqlQuery, top, skip, fields }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Process the WIQL query to ensure it's properly formatted
      let processedQuery = wiqlQuery.trim();
      
      // If the query doesn't start with SELECT, add a basic SELECT clause
      if (!processedQuery.toUpperCase().startsWith('SELECT')) {
        console.log("Query doesn't start with SELECT, adding basic SELECT clause");
        processedQuery = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE ${processedQuery}`;
      }
      
      console.log(`Running WIQL query: ${processedQuery}`);
      
      // Run the WIQL query
      const queryResult = await client.queryWorkItems(processedQuery, top, skip);
      
      // If no work items were found, return early
      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return {
          success: true,
          workItems: [],
          count: 0,
          message: "No work items found matching the query"
        };
      }
      
      // Get the work item IDs from the query result
      const workItemIds = queryResult.workItems.map(item => item.id);
      console.log(`Found ${workItemIds.length} work item IDs from query`);
      
      // Get the full work item details
      const workItems = await client.getWorkItemsByIds(workItemIds, fields);
      
      return {
        success: true,
        workItems,
        count: workItems.length,
        queryColumns: queryResult.columns,
        message: `Found ${workItems.length} work items matching the query`
      };
    } catch (error: any) {
      console.error("Error querying work items:", error);
      
      // Provide a more helpful error message
      let errorMessage = `Error querying work items: ${error.message}`;
      
      if (error.message.includes("TF51005")) {
        errorMessage += "\n\nThe WIQL query syntax is invalid. Please check your query syntax.";
      } else if (error.message.includes("TF401232")) {
        errorMessage += "\n\nThe field name in the query is invalid. Please check field names.";
      } else if (error.message.includes("401")) {
        errorMessage += "\n\nAuthentication failed. Please check your PAT token.";
      } else if (error.message.includes("403")) {
        errorMessage += "\n\nYou don't have permission to perform this operation. Please check your permissions.";
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
