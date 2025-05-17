import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient, GitChange } from "lib/azure-devops";

export const azureDevOpsCommitChangesTool = createTool({
  description: "Commit changes to a branch in an Azure DevOps Git repository",
  parameters: z.object({
    repositoryId: z.string().describe("ID of the Git repository"),
    branchName: z.string().describe("Name of the branch to commit to (e.g., 'feature/my-feature')"),
    commitMessage: z.string().describe("Commit message"),
    changes: z.array(
      z.object({
        changeType: z.enum(['add', 'edit', 'delete']).describe("Type of change (add, edit, or delete)"),
        path: z.string().describe("Path of the file to change (e.g., '/src/file.ts')"),
        content: z.string().optional().describe("Content of the file (required for add and edit changes)"),
        contentType: z.enum(['rawtext', 'base64encoded']).optional().default('rawtext').describe("Content type (default: rawtext)"),
      })
    ).describe("Array of file changes to commit"),
  }),
  execute: async ({ repositoryId, branchName, commitMessage, changes }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Format the changes for the API
      const formattedChanges: GitChange[] = changes.map(change => {
        const gitChange: GitChange = {
          changeType: change.changeType,
          item: {
            path: change.path,
          }
        };
        
        // Add content for add and edit changes
        if (change.changeType !== 'delete' && change.content) {
          gitChange.newContent = {
            content: change.content,
            contentType: change.contentType || 'rawtext',
          };
        }
        
        return gitChange;
      });
      
      // Commit changes
      const result = await client.commitChanges(
        repositoryId,
        branchName,
        formattedChanges,
        commitMessage
      );
      
      return {
        success: true,
        commitId: result.commits[0]?.commitId,
        pushId: result.pushId,
        message: `Changes committed successfully to branch '${branchName}'`
      };
    } catch (error: any) {
      console.error("Error committing changes:", error);
      
      return {
        success: false,
        message: `Error committing changes: ${error.message}`
      };
    }
  },
});
