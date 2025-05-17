import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsListFilesTool = createTool({
  description: "List files in an Azure DevOps Git repository with configurable depth",
  parameters: z.object({
    repositoryId: z.string().describe("ID of the Git repository"),
    path: z.string().optional().default('/').describe("Path to list files from (default: '/')"),
    branchName: z.string().optional().describe("Name of the branch (optional, defaults to the default branch)"),
    recursionLevel: z.enum(['none', 'oneLevel', 'full']).optional().default('oneLevel').describe("Recursion level (none, oneLevel, or full)"),
  }),
  execute: async ({ repositoryId, path = '/', branchName, recursionLevel = 'oneLevel' }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // List files
      const items = await client.listFiles(repositoryId, path, branchName, recursionLevel);
      
      // Organize items into a hierarchical structure if recursion is used
      if (recursionLevel === 'full') {
        const fileTree = buildFileTree(items, path);
        
        return {
          success: true,
          items,
          fileTree,
          count: items.length,
          message: `Found ${items.length} items in repository at path '${path}'`
        };
      }
      
      return {
        success: true,
        items,
        count: items.length,
        message: `Found ${items.length} items in repository at path '${path}'`
      };
    } catch (error: any) {
      console.error("Error listing files:", error);
      
      return {
        success: false,
        message: `Error listing files: ${error.message}`
      };
    }
  },
});

/**
 * Build a hierarchical file tree from a flat list of items
 */
function buildFileTree(items: any[], basePath: string) {
  const tree: Record<string, any> = {};
  
  // Sort items so folders come first
  const sortedItems = [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.path.localeCompare(b.path);
  });
  
  // Process each item
  for (const item of sortedItems) {
    // Skip the base path itself
    if (item.path === basePath) continue;
    
    // Remove the base path prefix
    let relativePath = item.path;
    if (basePath !== '/' && relativePath.startsWith(basePath)) {
      relativePath = relativePath.substring(basePath.length);
    }
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    
    // Split the path into segments
    const segments = relativePath.split('/');
    
    // Navigate the tree and create nodes as needed
    let currentLevel = tree;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Skip empty segments
      if (!segment) continue;
      
      // If this is the last segment, add the item
      if (i === segments.length - 1) {
        currentLevel[segment] = {
          name: segment,
          path: item.path,
          isFolder: item.isFolder,
          objectId: item.objectId,
          gitObjectType: item.gitObjectType,
        };
      } 
      // Otherwise, create or navigate to a folder
      else {
        if (!currentLevel[segment]) {
          currentLevel[segment] = {
            name: segment,
            isFolder: true,
            children: {},
          };
        }
        currentLevel = currentLevel[segment].children;
      }
    }
  }
  
  return tree;
}
