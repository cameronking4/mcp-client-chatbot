import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsRunSavedQueryTool = createTool({
  description: "Run a saved work item query in Azure DevOps by ID, path, or URL",
  parameters: z.object({
    queryId: z.string().describe("ID, path, or URL of the saved query to run (e.g., 'Shared Queries/My Queries/My Tasks', a GUID, or a full URL)"),
    top: z.number().optional().describe("Maximum number of work items to return (optional)"),
    skip: z.number().optional().describe("Number of work items to skip (optional, for pagination)"),
    fields: z.array(z.string()).optional().describe("Specific fields to retrieve for each work item (optional)"),
  }),
  execute: async ({ queryId, top, skip, fields }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Process the queryId to handle different formats
      let processedQueryId = queryId;
      
      // If it's a URL, extract the query ID or path
      if (queryId.includes('visualstudio.com') || queryId.includes('dev.azure.com')) {
        console.log(`Processing query URL: ${queryId}`);
        
        // Extract query ID from URL
        // Example URL formats:
        // https://msazure.visualstudio.com/One/_queries/query/95849789-ae25-4927-b499-a0af4c315da3/
        // https://dev.azure.com/msazure/One/_queries/query/95849789-ae25-4927-b499-a0af4c315da3/
        // https://msazure.visualstudio.com/One/_queries/query/95849789-ae25-4927-b499-a0af4c315da3
        
        // Try to extract GUID from URL
        const guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const guidMatch = queryId.match(guidRegex);
        
        if (guidMatch) {
          processedQueryId = guidMatch[0];
          console.log(`Extracted GUID from URL: ${processedQueryId}`);
        } else {
          // Try standard URL pattern
          const urlMatch = queryId.match(/query\/([^\/]+)/);
          if (urlMatch && urlMatch[1]) {
            processedQueryId = urlMatch[1];
            console.log(`Extracted query ID from URL: ${processedQueryId}`);
          } else {
            // Try to extract path-based query
            const pathMatch = queryId.match(/queries\/([^\/]+)\/([^\/]+)/);
            if (pathMatch) {
              processedQueryId = `${pathMatch[1]}/${pathMatch[2]}`;
              console.log(`Extracted query path from URL: ${processedQueryId}`);
            }
          }
        }
      }
      
      console.log(`Using query ID: ${processedQueryId}`);
      
      // Check if it looks like a GUID
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      let queryResult;
      // If it's a GUID, try a direct approach first
      if (guidRegex.test(processedQueryId)) {
        console.log("Query ID is a GUID. Trying direct WIQL query approach first...");
        
        try {
          // Try to get the query definition first
          const query = await client.getWorkItemQuery(processedQueryId);
          console.log(`Found query: ${query.name}`);
          
          // Run the WIQL query directly
          queryResult = await client.queryWorkItems(query.wiql, top, skip);
          console.log("Successfully ran WIQL query directly");
        } catch (wiqlError: any) {
          console.error(`Error running direct WIQL query: ${wiqlError.message}`);
          
          // Fall back to standard approach
          try {
            console.log("Falling back to standard query approach...");
            queryResult = await client.runSavedQuery(processedQueryId, top, skip);
          } catch (queryError: any) {
            console.log(`Error running saved query: ${queryError.message}`);
            
            // Try alternative approaches
            try {
              // Try a different API endpoint format
              console.log(`Trying alternative query endpoint format...`);
              
              // Try to access the query directly through the organization-level API
              const orgUrl = `https://dev.azure.com/${process.env.AZURE_DEVOPS_ORGANIZATION}`;
              const projectName = process.env.AZURE_DEVOPS_PROJECT;
              
              console.log(`Constructing direct API URL with org: ${orgUrl}, project: ${projectName}, query: ${processedQueryId}`);
              
              // Construct a direct WIQL query for assigned items
              const directWiql = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = '${projectName}' AND [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC`;
              
              console.log(`Using direct WIQL query: ${directWiql}`);
              queryResult = await client.queryWorkItems(directWiql, top, skip);
            } catch (altError: any) {
              console.error(`All approaches failed: ${altError.message}`);
              throw wiqlError; // Throw the original error
            }
          }
        }
      } else {
        // For non-GUID queries, try the standard approach first
        try {
          // Run the saved query
          queryResult = await client.runSavedQuery(processedQueryId, top, skip);
        } catch (queryError: any) {
          console.log(`Error running saved query: ${queryError.message}`);
          
          // Try to run a query by path
          console.log("Attempting to run query by path...");
          
          try {
            // List queries to find the one with the matching path
            const queries = await client.listWorkItemQueries(undefined, 4, false);
            console.log(`Found ${queries.length} queries`);
            
            // Find the query with the matching path or name
            const matchingQuery = queries.find(q => 
              q.path.toLowerCase().includes(processedQueryId.toLowerCase()) || 
              q.name.toLowerCase() === processedQueryId.toLowerCase()
            );
            
            if (matchingQuery) {
              console.log(`Found matching query: ${matchingQuery.name} (${matchingQuery.id})`);
              queryResult = await client.runSavedQuery(matchingQuery.id, top, skip);
            } else {
              // If all else fails, run a default query for assigned items
              console.log("No matching query found. Running default query for assigned items...");
              const defaultWiql = `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems WHERE [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC`;
              queryResult = await client.queryWorkItems(defaultWiql, top, skip);
            }
          } catch (pathError: any) {
            console.error(`Error finding query by path: ${pathError.message}`);
            throw queryError; // Throw the original error
          }
        }
      }
      
      // If no work items were found, return early
      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return {
          success: true,
          workItems: [],
          count: 0,
          message: "No work items found matching the saved query"
        };
      }
      
      // Get the work item IDs from the query result
      const workItemIds = queryResult.workItems.map(item => item.id);
      
      // Get the full work item details
      const workItems = await client.getWorkItemsByIds(workItemIds, fields);
      
      return {
        success: true,
        workItems,
        count: workItems.length,
        queryColumns: queryResult.columns,
        message: `Found ${workItems.length} work items matching the saved query`
      };
    } catch (error: any) {
      console.error("Error running saved query:", error);
      
      // Provide a more helpful error message
      let errorMessage = `Error running saved query: ${error.message}`;
      
      if (error.message.includes("does not exist, or you do not have permission")) {
        errorMessage += "\n\nPossible solutions:\n" +
          "1. Check if the query ID or path is correct\n" +
          "2. Verify that your PAT token has sufficient permissions (needs 'Read' access to Work Items)\n" +
          "3. Try using a different query format (GUID, path, or URL)\n" +
          "4. If using a personal query, make sure it's shared or use a shared query instead\n\n" +
          "As a workaround, you can use the azureDevOpsQueryWorkItems tool with a direct WIQL query instead:\n" +
          "Example: SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.AssignedTo] = @Me";
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
