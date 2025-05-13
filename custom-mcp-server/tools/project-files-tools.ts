/**
 * Project Files Tools
 * 
 * Tools for interacting with project files stored in Azure Blob Storage
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { azureStorage } from "../../src/lib/azure-storage.js";

export function registerProjectFilesTools(server: McpServer) {
  // Tool to list available project containers
  server.tool(
    "list-project-containers",
    "Get a list of all available project containers",
    {},
    async () => {
      try {
        const projects = await getAvailableProjects();
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "Available project containers",
              projects
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error listing project containers: ${error.message}`
          }]
        };
      }
    }
  );

  // Tool to list files in a project
  server.tool(
    "list-project-files",
    "Get a list of all files in a project container",
    {
      projectId: z.string().describe("ID of the project container")
    },
    async ({ projectId }) => {
      try {
        const files = await azureStorage.listProjectFiles(projectId);
        return {
          content: [{
            type: "text",
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
        return {
          content: [{
            type: "text",
            text: `Error listing files for project ${projectId}: ${error.message}`
          }]
        };
      }
    }
  );

  // Tool to get the content of a file
  server.tool(
    "get-file-content",
    "Get the content of a specific file from a project container",
    {
      projectId: z.string().describe("ID of the project container"),
      blobPath: z.string().describe("Path of the blob within the project container")
    },
    async ({ projectId, blobPath }) => {
      try {
        const content = await azureStorage.getFileContent(projectId, blobPath);
        const metadata = await azureStorage.getFileMetadata(projectId, blobPath);
        
        // Handle different file types appropriately
        const contentType = metadata.contentType || '';
        
        // Check if it's a supported text file type
        const isTextFile = isTextContentType(contentType);
        // Check for JSON files
        const isJsonFile = contentType.includes('json') || metadata.name.endsWith('.json');
        // Check for CSV files
        const isCsvFile = contentType.includes('csv') || metadata.name.endsWith('.csv');
        // Check for PDF files
        const isPdfFile = contentType.includes('pdf') || metadata.name.endsWith('.pdf');
        // Check for image files
        const isImageFile = contentType.includes('image/') || 
          ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].some(ext => metadata.name.toLowerCase().endsWith(ext));
        
        if (isTextFile || isJsonFile || isCsvFile) {
          // For text, JSON, and CSV files, return the content as a string
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                name: metadata.name,
                contentType: metadata.contentType,
                size: metadata.size,
                content: content.toString('utf-8')
              }, null, 2)
            }]
          };
        } else if (isPdfFile || isImageFile) {
          // For PDF and image files, return metadata and a resource URI
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                name: metadata.name,
                contentType: metadata.contentType,
                size: metadata.size,
                fileType: isPdfFile ? 'PDF' : 'Image',
                message: `${isPdfFile ? 'PDF' : 'Image'} file available at the resource URI`,
                resourceUri: `project-files://${projectId}/${blobPath}`
              }, null, 2)
            }]
          };
        } else {
          // For other binary files, just return metadata
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                name: metadata.name,
                contentType: metadata.contentType,
                size: metadata.size,
                message: "Binary file content is not displayed directly",
                resourceUri: `project-files://${projectId}/${blobPath}`
              }, null, 2)
            }]
          };
        }
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error retrieving file ${blobPath} from project ${projectId}: ${error.message}`
          }]
        };
      }
    }
  );

  // Tool to upload a file to a project
  server.tool(
    "upload-project-file",
    "Upload a file to a project container",
    {
      projectId: z.string().describe("ID of the project container"),
      fileId: z.string().optional().describe("ID for the file (if empty, a UUID will be generated)"),
      fileName: z.string().describe("Name of the file"),
      contentType: z.string().optional().describe("MIME type of the file content"),
      content: z.string().describe("Content of the file (text or base64-encoded for binary)"),
      isBinary: z.boolean().optional().describe("Whether the content is binary (base64-encoded)")
    },
    async ({ projectId, fileId, fileName, contentType, content, isBinary }) => {
      try {
        // Generate a UUID if fileId is not provided
        if (!fileId) {
          fileId = generateUuid();
        }
        
        // Default content type based on file extension if not provided
        if (!contentType) {
          contentType = determineContentType(fileName);
        }
        
        // Convert content to Buffer
        const contentBuffer = isBinary 
          ? Buffer.from(content, 'base64')
          : Buffer.from(content);
        
        // Upload the file
        const result = await azureStorage.uploadFile(
          projectId,
          fileId,
          fileName,
          contentBuffer,
          contentType
        );
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: "File uploaded successfully",
              file: {
                id: result.id,
                name: result.name,
                contentType: result.contentType,
                size: result.size,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                resourceUri: `project-files://${projectId}/${fileId}`
              }
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error uploading file to project ${projectId}: ${error.message}`
          }]
        };
      }
    }
  );

  // Tool to delete a file from a project
  server.tool(
    "delete-project-file",
    "Delete a file from a project container",
    {
      projectId: z.string().describe("ID of the project container"),
      blobPath: z.string().describe("Path of the blob within the project container")
    },
    async ({ projectId, blobPath }) => {
      try {
        const success = await azureStorage.deleteFile(projectId, blobPath);
        
        if (success) {
          return {
            content: [{
              type: "text",
              text: `File ${blobPath} deleted successfully from project ${projectId}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `File ${blobPath} not found in project ${projectId}`
            }]
          };
        }
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: `Error deleting file ${blobPath} from project ${projectId}: ${error.message}`
          }]
        };
      }
    }
  );
}

/**
 * Helper function to get available projects
 */
async function getAvailableProjects(): Promise<{ id: string, name: string }[]> {
  try {
    // In a real implementation, you'd query your database for project IDs
    // or list the containers/directories in Azure Storage
    
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
 * Helper function to determine content type based on file extension
 */
function determineContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv': 'text/csv',
    'xml': 'application/xml',
    'zip': 'application/zip',
    'md': 'text/markdown',
    'ts': 'application/typescript',
    'tsx': 'application/typescript',
    'jsx': 'application/javascript',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Helper function to generate a UUID
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
} 