/**
 * Project Files MCP Resources
 * 
 * Exposes files stored in Azure Storage as MCP resources.
 * Resources are organized by project ID with the format:
 * - project-files:// - Lists all available projects
 * - project-files://{projectId} - Lists all files in a specific project
 * - project-files://{projectId}/{fileId} - Gets the content of a specific file
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectFilesManager } from "../project-files-implementation.js";

/**
 * Determines the MIME type for the file based on its content type
 * @param contentType The file's content type
 * @returns A string MIME type
 */
function getMimeType(contentType: string | undefined): string {
  if (!contentType) return "application/octet-stream";
  
  // Text-based files should use text/plain or appropriate text format
  if (contentType.startsWith("text/") || 
      contentType.includes("json") || 
      contentType.includes("javascript") || 
      contentType.includes("typescript") || 
      contentType.includes("html") || 
      contentType.includes("css") || 
      contentType.includes("markdown") || 
      contentType.includes("xml")) {
    return contentType;
  }
  
  // Binary files
  return contentType;
}

/**
 * Register project files resources with the MCP server
 */
export function registerProjectFilesResources(server: McpServer) {
  // List available projects resource
  server.resource(
    "project-files-list",
    "project-files://",
    async (uri) => {
      try {
        // In a real implementation, this should be replaced with a call to get all projects
        // that the current user has access to
        const projects = await getAvailableProjects();
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              message: "Available projects",
              projects: projects
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error("Error retrieving projects:", error);
        throw new Error("Failed to retrieve projects");
      }
    }
  );

  // List files in a project resource
  server.resource(
    "project-files-project",
    new ResourceTemplate("project-files://{projectId}", { list: undefined }),
    async (uri, params) => {
      try {
        // Get the project ID from the URI params
        const projectId = params.projectId as string;
        
        // Get all files for this project
        const files = await projectFilesManager.listProjectFiles(projectId);
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              projectId,
              fileCount: files.length,
              files: files.map(file => ({
                id: file.id,
                name: file.name,
                contentType: file.contentType,
                size: file.size,
                createdAt: file.createdAt,
                updatedAt: file.updatedAt
              }))
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error(`Error retrieving files for project ${params.projectId}:`, error);
        throw new Error(`Failed to retrieve files for project: ${params.projectId}`);
      }
    }
  );

  // Get file content resource
  server.resource(
    "project-files-file",
    new ResourceTemplate("project-files://{projectId}/{fileId}", { list: undefined }),
    async (uri, params) => {
      try {
        // Get the project and file IDs from the URI params
        const projectId = params.projectId as string;
        const fileId = params.fileId as string;
        
        // Get the file content
        const result = await projectFilesManager.getFileContent(projectId, fileId);
        
        if (!result.content || !result.file) {
          throw new Error(`Resource not found: ${uri.href}`);
        }
        
        // Determine whether this is a text file that should be returned as text
        // or a binary file that should be returned as base64
        const isTextFile = isTextContentType(result.file.contentType);
        
        if (isTextFile) {
          // Return as text for text-based files
          return {
            contents: [{
              uri: uri.href,
              mimeType: getMimeType(result.file.contentType),
              text: result.content.toString('utf-8')
            }]
          };
        } else {
          // Return as binary for non-text files
          return {
            contents: [{
              uri: uri.href,
              mimeType: getMimeType(result.file.contentType),
              blob: result.content.toString('base64')
            }]
          };
        }
      } catch (error: any) {
        console.error(`Error retrieving file ${params.fileId} from project ${params.projectId}:`, error);
        if (error.message?.includes("Resource not found")) {
          throw error;
        }
        throw new Error(`Failed to retrieve file ${params.fileId} from project ${params.projectId}`);
      }
    }
  );
}

/**
 * Helper function to determine if a content type is text-based
 */
function isTextContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
    'application/xhtml+xml',
    'application/x-sh',
    'application/x-httpd-php',
    'application/x-yaml'
  ];
  
  return textTypes.some(type => contentType.startsWith(type));
}

/**
 * Helper function to retrieve available projects
 * For demonstration, this returns a sample list of projects
 */
async function getAvailableProjects(): Promise<{ id: string, name: string }[]> {
  // In a real implementation, this would fetch projects from your database
  // For now, returning a sample list
  return [
    { id: "project-1", name: "Sample Project 1" },
    { id: "project-2", name: "Sample Project 2" },
    { id: "project-3", name: "Sample Project 3" }
  ];
} 