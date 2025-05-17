import { tool as createTool } from "ai";
import { z } from "zod";
import { wait } from "lib/utils";
import { createAzureDevOpsClient } from "lib/azure-devops";

export const azureDevOpsReadFileTool = createTool({
  description: "Read the contents of a file from an Azure DevOps Git repository",
  parameters: z.object({
    repositoryId: z.string().describe("ID of the Git repository"),
    filePath: z.string().describe("Path of the file to read"),
    branchName: z.string().optional().describe("Name of the branch (optional, defaults to the default branch)"),
  }),
  execute: async ({ repositoryId, filePath, branchName }) => {
    await wait(500);

    try {
      // Create Azure DevOps client
      const client = createAzureDevOpsClient();
      
      // Read file
      const file = await client.readFile(repositoryId, filePath, branchName);
      
      // Determine if this is a binary file or text file
      const isTextFile = isTextFileByExtension(filePath);
      
      return {
        success: true,
        file: {
          path: file.path,
          content: file.content,
          isText: isTextFile,
          objectId: file.objectId,
          commitId: file.commitId,
          contentMetadata: file.contentMetadata,
        },
        message: `File '${filePath}' read successfully`
      };
    } catch (error: any) {
      console.error("Error reading file:", error);
      
      return {
        success: false,
        message: `Error reading file: ${error.message}`
      };
    }
  },
});

/**
 * Determine if a file is likely a text file based on its extension
 */
function isTextFileByExtension(filePath: string): boolean {
  const textExtensions = [
    // Code files
    '.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml',
    '.md', '.markdown', '.txt', '.text', '.csv', '.tsv', '.sh', '.bash', '.zsh', '.ps1',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.py', '.rb', '.php', '.go', '.rs', '.swift',
    '.kt', '.kts', '.scala', '.groovy', '.pl', '.pm', '.t', '.sql', '.r',
    
    // Config files
    '.gitignore', '.npmignore', '.editorconfig', '.env', '.ini', '.cfg', '.conf',
    
    // Other common text formats
    '.svg', '.graphql', '.gql', '.proto', '.toml'
  ];
  
  const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return textExtensions.includes(extension);
}
