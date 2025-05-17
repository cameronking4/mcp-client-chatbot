import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsCreatePRTool = createTool({
  description: "Create a pull request in an Azure DevOps Git repository",
  parameters: z.object({
    repositoryId: z.string().describe("ID of the Git repository"),
    sourceBranch: z.string().describe("Name of the source branch (e.g., 'feature/my-feature')"),
    targetBranch: z.string().describe("Name of the target branch (e.g., 'main', 'develop')"),
    title: z.string().describe("Title of the pull request"),
    description: z.string().optional().describe("Description of the pull request (optional)"),
    reviewers: z.array(z.string()).optional().describe("Array of reviewer IDs (optional)"),
  }),
  execute: async ({ repositoryId, sourceBranch, targetBranch, title, description, reviewers }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Create pull request
      const pullRequest = await client.createPullRequest(
        repositoryId,
        sourceBranch,
        targetBranch,
        title,
        description,
        reviewers
      );
      
      return {
        success: true,
        pullRequest,
        message: `Pull request created successfully: ${title}`
      };
    } catch (error: any) {
      console.error("Error creating pull request:", error);
      
      return {
        success: false,
        message: `Error creating pull request: ${error.message}`
      };
    }
  },
});
