import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsCreateBranchTool = createTool({
  description: "Create a new branch in an Azure DevOps Git repository",
  parameters: z.object({
    repositoryId: z.string().describe("ID of the Git repository"),
    branchName: z.string().describe("Name of the branch to create (e.g., 'feature/my-feature')"),
    baseBranchName: z.string().describe("Name of the base branch to create from (e.g., 'main', 'develop')"),
  }),
  execute: async ({ repositoryId, branchName, baseBranchName }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Ensure branch names are properly formatted
      const formattedBranchName = branchName.startsWith('refs/heads/') ? branchName : `refs/heads/${branchName}`;
      const formattedBaseBranchName = baseBranchName.startsWith('refs/heads/') ? baseBranchName : `refs/heads/${baseBranchName}`;
      
      // Create branch
      const branch = await client.createBranch(repositoryId, formattedBranchName, formattedBaseBranchName);
      
      return {
        success: true,
        branch,
        message: `Branch '${branchName}' created successfully from '${baseBranchName}'`
      };
    } catch (error: any) {
      console.error("Error creating branch:", error);
      
      return {
        success: false,
        message: `Error creating branch: ${error.message}`
      };
    }
  },
});
