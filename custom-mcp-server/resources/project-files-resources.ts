/**
 * Project Files MCP Resources
 * 
 * Directly exposes Azure Storage blobs as MCP resources.
 * Resources are organized by project ID with the format:
 * - project-files:// - Lists all available project containers
 * - project-files://{projectId} - Lists all files in a specific project
 * - project-files://{projectId}/{blobPath} - Gets the content of a specific blob
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azureStorage } from "../../src/lib/azure-storage.js";

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
 * Register project files resources with the MCP server
 */
export function registerProjectFilesResources(server: McpServer) {
  // List available projects resource (container listing)
  server.resource(
    "project-files-list",
    "project-files://",
    async (uri) => {
      try {
        console.log(`[MCP] Retrieving available project containers`);
        
        // Get available projects from the database or directly from Azure Storage
        let projects;
        try {
          projects = await getAvailableProjects();
          console.log(`[MCP] Found ${projects.length} project containers`);
        } catch (projectsError: any) {
          console.error(`[MCP] Error getting available projects: ${projectsError.message}`);
          throw projectsError;
        }
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              message: "Available project containers",
              projects: projects
            }, null, 2)
          }]
        };
      } catch (error: any) {
        console.error(`[MCP] Error retrieving project containers:`, error);
        
        // Return a proper error response instead of throwing
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              error: true,
              message: `Failed to retrieve project containers: ${error.message}`,
              code: error.code || 'UNKNOWN_ERROR'
            }, null, 2)
          }]
        };
      }
    }
  );

  // List blobs in a project container
  server.resource(
    "project-files-project",
    new ResourceTemplate("project-files://{projectId}", { list: undefined }),
    async (uri, params) => {
      try {
        // Get the project ID from the URI params
        const projectId = params.projectId as string;
        
        console.log(`[MCP] Listing files for project: ${projectId}`);
        
        // Get all files for this project directly from Azure Storage
        let files;
        try {
          files = await azureStorage.listProjectFiles(projectId);
          console.log(`[MCP] Successfully listed ${files.length} files for project ${projectId}`);
        } catch (listError: any) {
          console.error(`[MCP] Error listing files for project ${projectId}: ${listError.message}`);
          throw listError;
        }
        
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
        console.error(`[MCP] Error retrieving files for project ${params.projectId}:`, error);
        
        // Return a proper error response instead of throwing
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              error: true,
              message: `Failed to list files for project ${params.projectId}: ${error.message}`,
              code: error.code || 'UNKNOWN_ERROR'
            }, null, 2)
          }]
        };
      }
    }
  );

  // Get blob content directly
  server.resource(
    "project-files-blob",
    new ResourceTemplate("project-files://{projectId}/{blobPath*}", { list: undefined }),
    async (uri, params) => {
      try {
        // Get the project ID and blob path from the URI params
        const projectId = params.projectId as string;
        const blobPath = params.blobPath as string;
        
        console.log(`[MCP] Attempting to fetch blob at project: ${projectId}, path: ${blobPath}`);
        
        // Get the file content directly from Azure Storage
        let result, metadata;
        try {
          result = await azureStorage.getFileContent(projectId, blobPath);
          console.log(`[MCP] Successfully got content of size: ${result ? result.length : 0} bytes`);
        } catch (contentError: any) {
          console.error(`[MCP] Error getting blob content: ${contentError.message}`);
          throw contentError;
        }
        
        try {
          metadata = await azureStorage.getFileMetadata(projectId, blobPath);
          console.log(`[MCP] Successfully got metadata: ${JSON.stringify(metadata)}`);
        } catch (metadataError: any) {
          console.error(`[MCP] Error getting blob metadata: ${metadataError.message}`);
          throw metadataError;
        }
        
        if (!result || !metadata) {
          console.error(`[MCP] Resource not found: ${uri.href}`);
          throw new Error(`Resource not found: ${uri.href}`);
        }
        
        // Determine whether this is a text file that should be returned as text
        // or a binary file that should be returned as base64
        const isTextFile = isTextContentType(metadata.contentType);
        console.log(`[MCP] File type detected as ${isTextFile ? 'text' : 'binary'}`);
        
        if (isTextFile) {
          // Return as text for text-based files
          return {
            contents: [{
              uri: uri.href,
              mimeType: getMimeType(metadata.contentType),
              text: result.toString('utf-8')
            }]
          };
        } else {
          // Return as binary for non-text files
          return {
            contents: [{
              uri: uri.href,
              mimeType: getMimeType(metadata.contentType),
              blob: result.toString('base64')
            }]
          };
        }
      } catch (error: any) {
        console.error(`[MCP] Error retrieving blob ${params.blobPath} from project ${params.projectId}:`, error);
        
        // Return a proper error response instead of throwing
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              error: true,
              message: `Failed to retrieve blob: ${error.message}`,
              code: error.code || 'UNKNOWN_ERROR'
            }, null, 2)
          }]
        };
      }
    }
  );
}

/**
 * Helper function to get available projects directly from storage or database
 */
async function getAvailableProjects(): Promise<{ id: string, name: string }[]> {
  try {
    // In a real implementation, you'd query your database for project IDs
    // or list the containers/directories in Azure Storage
    // For now, using a sample implementation that could be extended
    
    // This is where you would implement container listing from Azure Storage
    // or query the database to get all project IDs that map to your containers
    
    // Sample implementation - replace with your actual implementation
    return [
      { id: "271d69a8-1997-4542-ae0e-a48686680733", name: "Project 1" },
      { id: "d504c722-47da-4a9e-bf12-b342ca749192", name: "Project 2" },
      { id: "dc04d4b3-d607-47fa-8141-52be0ea9b122", name: "Project 3" },
      { id: "default", name: "Default Project" }
    ];
  } catch (error) {
    console.error("Error fetching available projects:", error);
    return [];
  }
} 